import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { asStringArray, num, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "@/lib/redis/serialize";
import { parseStats } from "@/lib/redis/repositories/project.repository";
import { searchField, searchText } from "@/lib/redis/repositories/search.repository";
import { ConflictError } from "@/lib/errors";
import { newId } from "@/lib/utils";
import { MODULE_STATUSES, type Module, type ModuleWithStats } from "@/types/module";

function parseModule(hash: RawHash): Module {
  return {
    id: str(hash, "id"),
    projectId: str(hash, "projectId"),
    name: str(hash, "name"),
    description: str(hash, "description"),
    status: oneOf(hash.status, MODULE_STATUSES, "PLANNED"),
    ownerId: strOrNull(hash, "ownerId"),
    order: num(hash, "order"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
  };
}

export async function getModule(moduleId: string): Promise<Module | null> {
  const hash = toRawHash(await redis().hgetall(keys.module(moduleId)));
  return hash ? parseModule(hash) : null;
}

/** All modules of a project in display order, with progress stats, in one round trip. */
export async function listModules(projectId: string): Promise<ModuleWithStats[]> {
  const r = redis();
  const ids = asStringArray(await r.zrange(keys.projectModules(projectId), 0, -1));
  if (ids.length === 0) return [];
  const pipe = r.pipeline();
  for (const id of ids) {
    pipe.hgetall(keys.module(id));
    pipe.hgetall(keys.moduleStats(id));
  }
  const results = (await pipe.exec()) as unknown[];
  const modules: ModuleWithStats[] = [];
  ids.forEach((_, i) => {
    const hash = toRawHash(results[i * 2]);
    if (hash) modules.push({ ...parseModule(hash), stats: parseStats(results[i * 2 + 1]) });
  });
  return modules;
}

export interface ModuleInput {
  name: string;
  description: string;
  status: Module["status"];
  ownerId: string | null;
}

export async function createModule(projectId: string, input: ModuleInput): Promise<Module> {
  const r = redis();
  const id = newId();
  const now = Date.now();
  const last = asStringArray(await r.zrange(keys.projectModules(projectId), -1, -1, { withScores: true }));
  const order = last.length === 2 ? Number(last[1]) + 1 : 0;
  const mod: Module = { id, projectId, ...input, order, createdAt: now, updatedAt: now };
  const tx = r.multi();
  tx.hset(keys.module(id), toHash({ ...mod }));
  tx.hset(keys.moduleStats(id), { total: "0", done: "0" });
  tx.zadd(keys.projectModules(projectId), { score: order, member: id });
  tx.hset(keys.projectSearch(projectId), { [searchField("module", id)]: searchText(mod.name, mod.description) });
  await tx.exec();
  return mod;
}

export async function updateModule(mod: Module, patch: Partial<ModuleInput>): Promise<void> {
  const next = { ...mod, ...patch };
  const tx = redis().multi();
  tx.hset(keys.module(mod.id), toHash({ ...patch, updatedAt: Date.now() }));
  tx.hset(keys.projectSearch(mod.projectId), {
    [searchField("module", mod.id)]: searchText(next.name, next.description),
  });
  await tx.exec();
}

/** Persist a full ordering. Ids not belonging to the project are ignored. */
export async function reorderModules(projectId: string, orderedIds: readonly string[]): Promise<void> {
  const r = redis();
  const existing = new Set(asStringArray(await r.zrange(keys.projectModules(projectId), 0, -1)));
  const tx = r.multi();
  orderedIds
    .filter((id) => existing.has(id))
    .forEach((id, index) => {
      tx.zadd(keys.projectModules(projectId), { score: index, member: id });
      tx.hset(keys.module(id), { order: String(index) });
    });
  await tx.exec();
}

/** Modules can only be deleted once empty, so no task is ever orphaned. */
export async function deleteModule(mod: Module): Promise<void> {
  const r = redis();
  const count = await r.zcard(keys.moduleTasks(mod.id));
  if (count > 0) {
    throw new ConflictError("Move or delete the tasks in this module before deleting it.");
  }
  const tx = r.multi();
  tx.zrem(keys.projectModules(mod.projectId), mod.id);
  tx.hdel(keys.projectSearch(mod.projectId), searchField("module", mod.id));
  tx.del(keys.module(mod.id), keys.moduleTasks(mod.id), keys.moduleStats(mod.id));
  await tx.exec();
}
