"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { LandingPreview } from "@/components/landing-preview";
import { WorkerLab } from "@/components/worker-lab";
import { loadProject } from "@/lib/demo/storage";
import type { StudioProject } from "@/lib/domain/schemas";
import { projectApi, serverPersistenceEnabled } from "@/lib/client/api";

export function FullPreview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<StudioProject | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (serverPersistenceEnabled) void projectApi.get(projectId).then(({ project }) => setProject(project)); else setProject(loadProject(projectId)); });
    return () => window.clearTimeout(timer);
  }, [projectId]);
  if (!project?.pageSpec) return <main className="full-preview"><Link className="back-link" href={`/projects/${projectId}`}><ArrowLeft size={14} />Back to studio</Link><div className="empty-card">No generated page is available yet.</div></main>;
  return <main className="full-preview"><div style={{ maxWidth: 1440, margin: "0 auto 14px" }}><Link className="back-link" href={`/projects/${projectId}`}><ArrowLeft size={14} />Back to studio</Link></div><LandingPreview spec={project.pageSpec} projectId={projectId} /><div className="full-preview-lab"><WorkerLab project={project} /></div></main>;
}
