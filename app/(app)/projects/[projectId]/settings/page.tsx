import { notFound } from "next/navigation";
import { loadProjectPage, loadStructure } from "@/lib/domain/project-data";
import { canDeleteProject, canEditProject, isWritable } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ArchiveControl, DeleteProjectControl, ProjectDetailsForm } from "@/components/project/project-settings-forms";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, role } = await loadProjectPage(projectId);
  if (!canEditProject(role)) notFound();
  const structure = await loadStructure(project.id);
  const taskCount = structure.reduce((n, m) => n + m.stats.total, 0);
  const archived = !isWritable(project);

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Detail proyek" />
        <div className="px-4 py-4">
          <ProjectDetailsForm project={project} disabled={archived} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={archived ? "Aktifkan kembali proyek" : "Arsipkan proyek"}
          description={
            archived
              ? "Proyek dapat diubah lagi dan muncul kembali di sidebar."
              : "Proyek menjadi hanya-baca dan disembunyikan dari sidebar. Bisa diaktifkan kembali kapan saja. Ini cara paling aman untuk menutup proyek."
          }
          action={<ArchiveControl project={project} />}
        />
      </Card>

      {canDeleteProject(role) ? (
        <Card className="border-danger/30">
          <CardHeader
            title="Hapus proyek"
            description="Menghapus proyek beserta seluruh isinya secara permanen. Pertimbangkan untuk mengarsipkan saja."
            action={<DeleteProjectControl project={project} taskCount={taskCount} />}
          />
        </Card>
      ) : null}
    </div>
  );
}
