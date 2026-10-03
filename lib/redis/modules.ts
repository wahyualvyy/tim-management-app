import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, num, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "./serialize";
import { parseStats } from "./projects";
import { searchMembers } from "./search";
import { deleteTask, getTasks } from "./tasks";
import { newId } from "@/lib/utils";
import { nodeTerms } from "@/lib/search-terms";
import { STRUCTURE_STATUSES, type Module, type ModuleWithStats, type SubModule, type SubModuleWithStats } from "@/types/module";

export function parseModule(hash: RawHash): Module {
  return {
    id: str(hash, "id"),
    projectId: str(hash, "projectId"),
    name: str(hash, "name"),
    description: str(hash, "description"),
    status: oneOf(hash.status, STRUCTURE_STATUSES, "PLANNED"),
    leadId: strOrNull(hash, "leadId"),
    order: num(hash, "order"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
  };
}

export function parseSubModule(hash: RawHash): SubModule {
  return { ...parseModule(hash), moduleId: str(hash, "moduleId") };
}

export async function getModule(moduleId: string): Promise<Module | null> {
  const hash = toRawHash(await redis().hgetall(keys.module(moduleId)));
  return hash?.id ? parseModule(hash) : null;
}

/**
 * The whole module → sub module tree of a project with progress and tracked
 * time for every node, in three pipelined round trips.
 */
export async function listProjectStructure(projectId: string): Promise<ModuleWithStats[]> {
  const r = redis();
  const moduleIds = asStringArray(await r.zrange(keys.projectModules(projectId), 0, -1));
  if (moduleIds.length === 0) return [];

  const pipe = r.pipeline();
  for (const id of moduleIds) {
    pipe.hgetall(keys.module(id));
    pipe.hgetall(keys.moduleStats(id));
    pipe.hget(keys.moduleTime(id), "total");
    pipe.zrange(keys.moduleSubModules(id), 0, -1);
  }
  const results = (await pipe.exec()) as unknown[];
  const subIdsByModule = moduleIds.map((_, i) => asStringArray(results[i * 4 + 3]));
  const allSubIds = subIdsByModule.flat();

  const subPipe = r.pipeline();
  for (const id of allSubIds) {
    subPipe.hgetall(keys.subModule(id));
    subPipe.hgetall(keys.subModuleStats(id));
    subPipe.hget(keys.subModuleTime(id), "total");
  }
  const subResults = allSubIds.length > 0 ? ((await subPipe.exec()) as unknown[]) : [];
  const subMap = new Map<string, SubModuleWithStats>();
  allSubIds.forEach((id, i) => {
    const hash = toRawHash(subResults[i * 3]);
    if (hash?.id) {
      subMap.set(id, {
        ...parseSubModule(hash),
        stats: parseStats(subResults[i * 3 + 1]),
        trackedSeconds: Math.max(0, Number(subResults[i * 3 + 2]) || 0),
      });
    }
  });

  const modules: ModuleWithStats[] = [];
  moduleIds.forEach((_, i) => {
    const hash = toRawHash(results[i * 4]);
    if (!hash?.id) return;
    modules.push({
      ...parseModule(hash),
      stats: parseStats(results[i * 4 + 1]),
      trackedSeconds: Math.max(0, Number(results[i * 4 + 2]) || 0),
      subModules: (subIdsByModule[i] ?? []).flatMap((sid) => {
        const s = subMap.get(sid);
        return s ? [s] : [];
      }),
    });
  });
  return modules;
}

export interface StructureInput {
  name: string;
  description: string;
  status: Module["status"];
  leadId: string | null;
}

async function nextOrder(listKey: string): Promise<number> {
  const last = asStringArray(await redis().zrange(listKey, -1, -1, { withScores: true }));
  return last.length === 2 ? Number(last[1]) + 1 : 0;
}

export async function createModule(projectId: string, input: StructureInput): Promise<Module> {
  const r = redis();
  const id = newId();
  const now = Date.now();
  const order = await nextOrder(keys.projectModules(projectId));
  const mod: Module = { id, projectId, ...input, order, createdAt: now, updatedAt: now };
  const tx = r.multi();
  tx.hset(keys.module(id), toHash({ ...mod }));
  tx.hset(keys.moduleStats(id), { total: "0", done: "0" });
  tx.zadd(keys.projectModules(projectId), { score: order, member: id });
  for (const member of searchMembers("module", id, nodeTerms(mod.name))) tx.zadd(keys.projectSearch(projectId), { score: 0, member });
  await tx.exec();
  return mod;
}

/** Swap a node's search entries when its name changes. */
function reindexNode(tx: ReturnType<ReturnType<typeof redis>["multi"]>, projectId: string, kind: "module" | "submodule", id: string, before: string, after: string): void {
  if (before === after) return;
  const old = searchMembers(kind, id, nodeTerms(before));
  if (old.length > 0) tx.zrem(keys.projectSearch(projectId), ...old);
  for (const member of searchMembers(kind, id, nodeTerms(after))) tx.zadd(keys.projectSearch(projectId), { score: 0, member });
}

export async function updateModule(mod: Module, patch: Partial<StructureInput>): Promise<void> {
  const tx = redis().multi();
  tx.hset(keys.module(mod.id), toHash({ ...patch, updatedAt: Date.now() }));
  reindexNode(tx, mod.projectId, "module", mod.id, mod.name, patch.name ?? mod.name);
  await tx.exec();
}

/** Persist a full ordering. Ids not in the list's current members are ignored. */
async function reorder(listKey: string, recordKey: (id: string) => string, orderedIds: readonly string[]): Promise<void> {
  const r = redis();
  const existing = new Set(asStringArray(await r.zrange(listKey, 0, -1)));
  const tx = r.multi();
  orderedIds
    .filter((id) => existing.has(id))
    .forEach((id, index) => {
      tx.zadd(listKey, { score: index, member: id });
      tx.hset(recordKey(id), { order: String(index) });
    });
  await tx.exec();
}

export async function reorderModules(projectId: string, orderedIds: readonly string[]): Promise<void> {
  await reorder(keys.projectModules(projectId), keys.module, orderedIds);
}

/** Deletes every task in the given index one by one, keeping all counters correct. */
async function deleteTasksIn(listKey: string, projectId: string): Promise<number> {
  const r = redis();
  const [ids, projectKey] = await Promise.all([r.zrange(listKey, 0, -1), r.hget<string>(keys.project(projectId), "key")]);
  const tasks = await getTasks(asStringArray(ids));
  for (const task of tasks) await deleteTask(task, projectKey ?? "");
  return tasks.length;
}

/** Delete a module with its sub modules and tasks. Returns how many tasks were removed. */
export async function deleteModuleCascade(mod: Module): Promise<number> {
  const r = redis();
  const removed = await deleteTasksIn(keys.moduleTasks(mod.id), mod.projectId);
  const subIds = asStringArray(await r.zrange(keys.moduleSubModules(mod.id), 0, -1));
  const subNames: unknown[] = subIds.length > 0 ? ((await (() => {
    const pipe = r.pipeline();
    for (const s of subIds) pipe.hget(keys.subModule(s), "name");
    return pipe.exec();
  })()) as unknown[]) : [];
  const tx = r.multi();
  tx.zrem(keys.projectModules(mod.projectId), mod.id);
  const entries = [
    ...searchMembers("module", mod.id, nodeTerms(mod.name)),
    ...subIds.flatMap((s, i) => searchMembers("submodule", s, nodeTerms(String(subNames[i] ?? "")))),
  ];
  if (entries.length > 0) tx.zrem(keys.projectSearch(mod.projectId), ...entries);
  for (const s of subIds) {
    tx.del(keys.subModule(s), keys.subModuleTasks(s), keys.subModuleStats(s), keys.subModuleTime(s));
  }
  tx.del(
    keys.module(mod.id),
    keys.moduleSubModules(mod.id),
    keys.moduleTasks(mod.id),
    keys.moduleDirectTasks(mod.id),
    keys.moduleStats(mod.id),
    keys.moduleTime(mod.id),
  );
  await tx.exec();
  return removed;
}

// Sub modules

export async function getSubModule(subModuleId: string): Promise<SubModule | null> {
  const hash = toRawHash(await redis().hgetall(keys.subModule(subModuleId)));
  return hash?.id ? parseSubModule(hash) : null;
}

export async function createSubModule(mod: Module, input: StructureInput): Promise<SubModule> {
  const r = redis();
  const id = newId();
  const now = Date.now();
  const order = await nextOrder(keys.moduleSubModules(mod.id));
  const sub: SubModule = { id, projectId: mod.projectId, moduleId: mod.id, ...input, order, createdAt: now, updatedAt: now };
  const tx = r.multi();
  tx.hset(keys.subModule(id), toHash({ ...sub }));
  tx.hset(keys.subModuleStats(id), { total: "0", done: "0" });
  tx.zadd(keys.moduleSubModules(mod.id), { score: order, member: id });
  for (const member of searchMembers("submodule", id, nodeTerms(sub.name))) tx.zadd(keys.projectSearch(mod.projectId), { score: 0, member });
  await tx.exec();
  return sub;
}

export async function updateSubModule(sub: SubModule, patch: Partial<StructureInput>): Promise<void> {
  const tx = redis().multi();
  tx.hset(keys.subModule(sub.id), toHash({ ...patch, updatedAt: Date.now() }));
  reindexNode(tx, sub.projectId, "submodule", sub.id, sub.name, patch.name ?? sub.name);
  await tx.exec();
}

export async function reorderSubModules(moduleId: string, orderedIds: readonly string[]): Promise<void> {
  await reorder(keys.moduleSubModules(moduleId), keys.subModule, orderedIds);
}

/** Delete a sub module and its tasks. Returns how many tasks were removed. */
export async function deleteSubModuleCascade(sub: SubModule): Promise<number> {
  const removed = await deleteTasksIn(keys.subModuleTasks(sub.id), sub.projectId);
  const tx = redis().multi();
  tx.zrem(keys.moduleSubModules(sub.moduleId), sub.id);
  const entries = searchMembers("submodule", sub.id, nodeTerms(sub.name));
  if (entries.length > 0) tx.zrem(keys.projectSearch(sub.projectId), ...entries);
  tx.del(keys.subModule(sub.id), keys.subModuleTasks(sub.id), keys.subModuleStats(sub.id), keys.subModuleTime(sub.id));
  await tx.exec();
  return removed;
}
