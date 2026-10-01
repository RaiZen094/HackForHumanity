"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight, ChartLineUp, CheckCircle, CircleNotch, ClockCounterClockwise,
  Headset, Megaphone, Microphone, PencilLine, Plus, Sparkle, UserFocus,
} from "@phosphor-icons/react";
import { Brand } from "@/components/brand";
import { createProject } from "@/lib/domain/project";
import type { StudioProject } from "@/lib/domain/schemas";
import { loadProjects, saveProject } from "@/lib/demo/storage";
import { projectApi, serverPersistenceEnabled } from "@/lib/client/api";

const stageLabel: Record<StudioProject["stage"], string> = {
  DESCRIBE: "Ready to describe", CLARIFYING: "Needs one answer", RECOMMENDING: "Finding workers",
  AWAITING_APPROVAL: "Awaiting approval", BUILDING: "Building", PREVIEW: "Preview ready",
  REVISING: "Revising", FAILED: "Needs attention",
};

const workers = [
  { name: "Voice", icon: Microphone }, { name: "Support", icon: Headset },
  { name: "Content", icon: PencilLine }, { name: "Campaign", icon: Megaphone },
  { name: "Success", icon: UserFocus }, { name: "Growth", icon: ChartLineUp },
];

export function ProjectDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (serverPersistenceEnabled) void projectApi.list().then(({ projects }) => setProjects(projects)).catch((reason: Error) => setError(reason.message)).finally(() => setReady(true));
      else { setProjects(loadProjects()); setReady(true); }
    });
    return () => window.clearTimeout(timer);
  }, []);

  async function startProject() {
    setCreating(true); setError(null);
    try {
      const project = serverPersistenceEnabled ? (await projectApi.create()).project : saveProject(createProject());
      router.push(`/projects/${project.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the project.");
      setCreating(false);
    }
  }

  return <div className="app-shell home-shell">
    <header className="topbar home-topbar">
      <Brand />
      <nav className="home-nav" aria-label="Home navigation">
        <a href="#workers">Workers</a><a href="#projects">Projects</a>
        <button className="button button-primary button-small nav-build-button" aria-label="Start building" onClick={startProject} disabled={creating}><span>Start building</span><ArrowRight size={15} /></button>
      </nav>
    </header>

    <main className="home-main">
      <section className="home-hero" aria-labelledby="home-title">
        <Image className="home-hero-image" src="/images/worker-studio-hero.png" alt="Hackathon participants shaping a service together around a laptop and sketches" fill priority sizes="(max-width: 700px) 100vw, 1240px" />
        <div className="home-hero-shade" />
        <div className="home-hero-copy">
          <p className="eyebrow">Build for the room</p>
          <h1 id="home-title">Turn one idea into a working demo.</h1>
          <p>Bring any civic or environmental challenge. Seven AI workers shape a solution you can present.</p>
          <button className="button button-primary home-hero-cta" onClick={startProject} disabled={creating}>{creating ? <CircleNotch className="spin" size={18} /> : <Plus size={18} weight="bold" />}{creating ? "Opening your studio" : "Build a project"}</button>
        </div>
      </section>
      {error && <div className="home-error" role="alert">{error}<button type="button" onClick={startProject}>Try again</button></div>}

      <section className="outcome-strip" aria-label="How Worker Studio works">
        <div><strong>Prompt your idea</strong><p>Start with the people, problem, and outcome.</p></div>
        <ArrowRight className="outcome-arrow" size={19} />
        <div><strong>Approve the team</strong><p>Choose exactly which specialists can contribute.</p></div>
        <ArrowRight className="outcome-arrow" size={19} />
        <div><strong>Demo the solution</strong><p>Present the site and run every approved worker live.</p></div>
      </section>

      <section className="home-workers" id="workers">
        <div className="manager-feature">
          <div className="manager-icon"><Sparkle size={25} weight="fill" /></div>
          <div><p>Landing Page Manager</p><h2>One coordinator keeps the whole build coherent.</h2><p className="manager-copy">It interprets the idea, recommends a team, builds the site, and safely applies revisions while specialists handle the real work.</p></div>
          <span className="manager-state"><CheckCircle size={15} weight="fill" />Live</span>
        </div>
        <div className="worker-rail" aria-label="Six specialist workers">
          {workers.map(({ name, icon: Icon }) => <div className="worker-rail-item" key={name}><Icon size={19} /><span>{name}</span></div>)}
        </div>
      </section>

      <section className="home-projects" id="projects">
        <div className="section-head home-section-head">
          <div><h2>{projects.length ? "Continue building" : "Your builds start here"}</h2><p>{serverPersistenceEnabled ? "Every project and worker result is restored from SQL Server." : "Projects stay on this device in demo mode."}</p></div>
          {projects.length > 0 && <span className="status-chip"><ClockCounterClockwise size={13} />Refresh safe</span>}
        </div>
        <div className="project-grid">
          {!ready ? <><ProjectSkeleton /><ProjectSkeleton /></> : projects.length === 0 ? (
            <button className="project-empty" onClick={startProject} disabled={creating}><span><Plus size={22} /></span><strong>Create your first project</strong><p>Bring an idea. Worker Studio will guide the rest.</p></button>
          ) : projects.map((project) => (
            <Link className="project-card" href={`/projects/${project.id}`} key={project.id}>
              <span className="status-chip">{stageLabel[project.stage]}</span>
              <h3>{project.name}</h3>
              <p>{project.currentPrompt ?? "A new project waiting for its first description."}</p>
              <div className="card-footer"><span>{new Date(project.updatedAt).toLocaleDateString()}</span><span>Open project <ArrowRight size={16} /></span></div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  </div>;
}

function ProjectSkeleton() { return <div className="project-skeleton" aria-hidden="true"><span /><span /><span /></div>; }
