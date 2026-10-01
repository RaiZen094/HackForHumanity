"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, ArrowLeft, ArrowSquareOut, Buildings, Check, CheckCircle, CircleNotch, Eye, Leaf, Lightning, PencilSimple, ShieldCheck, Tractor, Warning, X } from "@phosphor-icons/react";
import { Topbar } from "@/components/brand";
import { LandingPreview } from "@/components/landing-preview";
import { WorkerLab } from "@/components/worker-lab";
import { analyzeProject, answerClarification, approveTeam, buildProject, decideExpansion, reviseProject, toggleWorker } from "@/lib/demo/engine";
import { createProject } from "@/lib/domain/project";
import type { StudioProject, WorkerId } from "@/lib/domain/schemas";
import { workerById } from "@/lib/domain/workers";
import { loadProject, saveProject } from "@/lib/demo/storage";
import { projectApi, serverPersistenceEnabled } from "@/lib/client/api";

const stageCopy: Record<StudioProject["stage"], string> = {
  DESCRIBE: "Describe the problem", CLARIFYING: "One detail needed", RECOMMENDING: "Finding the right workers",
  AWAITING_APPROVAL: "Review the proposed team", BUILDING: "Ready to build", PREVIEW: "Preview ready",
  REVISING: "Applying revision", FAILED: "Action needed",
};

const challengeExamples = [
  { name: "Climate resilience", icon: Leaf, detail: "Early warning and community reporting", prompt: "Build ClimateSignal for coastal communities exposed to flooding and cyclones. Combine accessible early-warning guidance, resident incident reports, and risk trends so local volunteers can prioritize help. Do not send emergency alerts or claim official forecasts." },
  { name: "Rural agriculture", icon: Tractor, detail: "Crop guidance and local risk insight", prompt: "Build CropGuard for smallholder farmers who lose crops because disease signs and local guidance arrive too late. Let farmers describe symptoms, receive practical next steps, and help field teams identify emerging patterns. Do not diagnose with certainty or contact farmers automatically." },
  { name: "Public services", icon: Buildings, detail: "Issue reporting and transparent routing", prompt: "Build CivicLink for city residents who struggle to report waste collection and drainage problems. Classify reports, explain the responsible service route, provide useful updates, and show recurring issue patterns. Do not create official cases or claim government integration." },
];

export function StudioShell({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<string | null>(null);
  const [editingProblem, setEditingProblem] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (serverPersistenceEnabled) {
        void projectApi.get(projectId).then(({ project }) => setProject(project)).catch((reason: Error) => setError(reason.message));
      } else {
        const restored = loadProject(projectId);
        const initial = restored ?? { ...createProject(), id: projectId };
        setProject(initial); saveProject(initial);
      }
    });
    return () => window.clearTimeout(timer);
  }, [projectId]);

  function commit(next: StudioProject) { setProject(serverPersistenceEnabled ? next : saveProject(next)); setError(null); }
  function fail(reason: unknown) {
    setError(reason instanceof Error ? reason.message : "Something went wrong.");
    if (serverPersistenceEnabled) void projectApi.get(projectId).then(({ project }) => setProject(project)).catch(() => undefined);
  }
  function run(action: () => StudioProject) { try { commit(action()); setInput(""); } catch (reason) { fail(reason); } }

  async function submit() {
    if (!project) return;
    if (!input.trim()) {
      setInputError("Enter the audience, problem, and useful outcome before continuing.");
      inputRef.current?.focus();
      return;
    }
    setInputError(null);
    if (serverPersistenceEnabled) {
      setBusy(true);
      try {
        const response = project.stage === "DESCRIBE" || project.stage === "CLARIFYING" || editingProblem ? await projectApi.analyze(project.id, input, editingProblem) : await projectApi.revise(project.id, input);
        commit(response.project);
        setEditingProblem(false);
        const lastMessage = response.project.messages.at(-1)?.content ?? "";
        if (/requires confirmation|apply the destructive change|this changes the current page/i.test(lastMessage)) setConfirmRequest(input);
        setInput("");
      } catch (reason) { fail(reason); } finally { setBusy(false); }
      return;
    }
    if (editingProblem) { run(() => analyzeProject(project, input)); setEditingProblem(false); }
    else if (project.stage === "DESCRIBE") run(() => analyzeProject(project, input));
    else if (project.stage === "CLARIFYING") run(() => answerClarification(project, input));
    else if (project.pageSpec) {
      try {
        const outcome = reviseProject(project, input);
        commit(outcome.project);
        if (outcome.type === "confirmation") setConfirmRequest(input);
        setInput("");
      } catch (reason) { fail(reason); }
    }
  }

  async function retryFailedAction() {
    if (!project?.lastError) return;
    let failure: { operation?: string; request?: string | null } = {};
    try { failure = JSON.parse(project.lastError) as typeof failure; } catch { failure = {}; }
    setBusy(true); setError(null);
    try {
      if (failure.operation === "analyze" && failure.request) commit((await projectApi.analyze(project.id, failure.request, true)).project);
      else if (failure.operation === "revise" && failure.request) commit((await projectApi.revise(project.id, failure.request)).project);
      else commit((await projectApi.build(project.id)).project);
    } catch (reason) { fail(reason); } finally { setBusy(false); }
  }

  async function approveAndBuild() {
    if (!project) return;
    if (serverPersistenceEnabled) {
      setBusy(true);
      try {
        const selected = project.recommendations.filter((item) => item.selected).map((item) => item.workerId);
        const approved = await projectApi.approve(project.id, selected); commit(approved.project);
        const built = await projectApi.build(project.id); commit(built.project);
      } catch (reason) { fail(reason); } finally { setBusy(false); }
      return;
    }
    try {
      const approved = approveTeam(project); commit(approved); setBusy(true);
      window.setTimeout(() => { try { commit(buildProject(approved)); } catch (reason) { fail(reason); } finally { setBusy(false); } }, 650);
    } catch (reason) { fail(reason); }
  }

  if (!project) return <><Topbar /><div className="loading-state"><CircleNotch className="spin" size={24} /> Restoring project</div></>;
  const composerPlaceholder = editingProblem || project.stage === "DESCRIBE" ? "Describe who this is for, the problem, and the value you want to create..." : project.stage === "CLARIFYING" ? "Answer the clarification question..." : "Ask for a copy, hierarchy, or capability change...";
  const canCompose = editingProblem || project.stage === "DESCRIBE" || project.stage === "CLARIFYING" || Boolean(project.pageSpec);

  return (
    <div className="app-shell">
      <Topbar note={serverPersistenceEnabled ? "Production persistence / SQL Server" : "Demo mode / saved on this device"} />
      <main className="studio-layout">
        <section className="studio-panel">
          <Link href="/" className="back-link"><ArrowLeft size={14} />All projects</Link>
          <div className="studio-heading"><div><h1>{project.name}</h1><p>{stageCopy[project.stage]}</p></div><span className="status-chip">{project.events.length} events</span></div>
          <div className="conversation" aria-live="polite">
            {project.messages.length === 0 && <div className="message assistant"><span className="message-label">Studio</span>What are you trying to make possible, and for whom?</div>}
            {project.messages.map((item) => <div className={`message ${item.role}`} key={item.id}><span className="message-label">{item.role === "participant" ? "You" : "Studio"}</span>{item.content}</div>)}
          </div>
          {confirmRequest && <div className="info-card" style={{ marginTop: 16 }} role="dialog" aria-modal="true" aria-labelledby="confirm-removal-title" onKeyDown={(event) => { if (event.key === "Escape") { setConfirmRequest(null); window.setTimeout(() => inputRef.current?.focus()); } }}><h3 id="confirm-removal-title">Confirm removal</h3><p>This changes the current page. Continue?</p><div className="action-row"><button className="button button-danger button-small" autoFocus onClick={() => { if (serverPersistenceEnabled) void projectApi.revise(project.id, confirmRequest, true).then(({ project }) => { commit(project); setConfirmRequest(null); }).catch(fail); else { const outcome = reviseProject(project, confirmRequest, { confirmed: true }); commit(outcome.project); setConfirmRequest(null); } }}>Remove confirmed section</button><button className="button button-secondary button-small" onClick={() => { setConfirmRequest(null); window.setTimeout(() => inputRef.current?.focus()); }}>Keep page unchanged</button></div></div>}
          {canCompose && <div className="composer"><textarea ref={inputRef} value={input} onChange={(event) => { setInput(event.target.value); if (inputError) setInputError(null); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void submit(); }} placeholder={composerPlaceholder} aria-label="Studio message" aria-invalid={Boolean(inputError)} aria-describedby={inputError ? "studio-input-error" : undefined} maxLength={6000} /><div className="composer-row"><span className="composer-hint">Ctrl + Enter to send · project data is processed by OpenAI</span><div className="action-row">{editingProblem && <button className="button button-secondary" onClick={() => { setEditingProblem(false); setInput(""); setInputError(null); }}>Cancel edit</button>}<button className="button button-primary" onClick={() => void submit()} disabled={busy}>{busy ? "Working" : editingProblem ? "Reanalyze problem" : "Send"}</button></div></div>{inputError && <p className="error-note" id="studio-input-error" role="alert">{inputError}</p>}{error && <p className="error-note">{error}</p>}</div>}
        </section>
        <section className="work-panel"><div className="work-panel-inner">
          <div className="panel-kicker"><span>Workspace</span><span>{stageCopy[project.stage]}</span></div>
          {error && <div className="work-error" role="alert"><strong>Build interrupted</strong><span>{error}</span></div>}
          {project.stage === "FAILED" && <div className="info-card recovery-card"><Warning size={25} color="#a24c20" weight="fill" /><h2>Accepted work is safe</h2><p>The last operation did not finish. The problem, approved team, conversation, and latest successful preview are still stored.</p><button className="button button-primary" onClick={() => void retryFailedAction()} disabled={busy}><ArrowCounterClockwise size={16} />{busy ? "Retrying" : "Retry last operation"}</button></div>}
          {project.stage === "DESCRIBE" && <div className="info-card"><Lightning size={25} color="var(--accent)" weight="fill" /><h2 style={{ marginTop: 16 }}>Start with any real challenge</h2><p>Name the affected people, the problem on the ground, the useful outcome, and any actions the demo must not claim.</p><div className="challenge-examples">{challengeExamples.map(({ name, icon: Icon, detail, prompt }) => <button className="challenge-example" key={name} onClick={() => setInput(prompt)}><Icon size={20} /><span><strong>{name}</strong><small>{detail}</small></span><ArrowSquareOut size={14} /></button>)}</div></div>}
          {project.interpretation && <InterpretationCard project={project} />}
          {project.stage === "AWAITING_APPROVAL" && <div className="info-card"><h2>Proposed workers</h2><p>{editingProblem ? "Finish or cancel the problem correction before approving a team." : "Approve at least one specialist. Removed workers cannot power features in the generated page."}</p><div className="worker-list">{project.recommendations.map((worker) => <button disabled={editingProblem} aria-pressed={worker.selected} className={`worker-card ${worker.selected ? "selected" : ""}`} key={worker.workerId} onClick={() => run(() => toggleWorker(project, worker.workerId as WorkerId))}><span className="worker-check">{worker.selected ? <Check size={16} weight="bold" /> : <X size={14} />}</span><span><h4>{workerById(worker.workerId).name}</h4><p>{worker.reason}</p></span><span className={`mode-chip ${worker.mode}`}>{worker.mode}</span></button>)}</div><div className="action-row"><button className="button button-secondary" onClick={() => { setEditingProblem(true); setInput(project.currentPrompt ?? ""); window.setTimeout(() => inputRef.current?.focus()); }} disabled={editingProblem}><PencilSimple size={16} />Edit problem</button><button className="button button-primary" onClick={approveAndBuild} disabled={editingProblem || !project.recommendations.some((item) => item.selected) || busy}>{busy ? <CircleNotch className="spin" size={17} /> : <CheckCircle size={17} />}Approve and build</button></div></div>}
          {(project.stage === "BUILDING" || busy) && project.stage !== "FAILED" && <div className="info-card build-progress" aria-live="polite"><CircleNotch className="spin" size={25} color="var(--accent)" /><h2>Landing Page Manager is building</h2><ol><li><CheckCircle size={15} weight="fill" />Reading the accepted plan</li><li><CircleNotch className="spin" size={15} />Designing features and connecting approved workers</li><li><span />Validating the page and responsive preview</li><li><span />Saving the completed build</li></ol></div>}
          <div className="data-scope-note"><ShieldCheck size={17} /><p><strong>AI data boundary.</strong> Only this project’s current problem, approved workers, page schema, and active request are sent for generation. Session secrets, database credentials, and unrelated projects are excluded.</p></div>
          {project.pendingExpansion && <div className="info-card"><h2>New worker proposed</h2><p><strong>{workerById(project.pendingExpansion.worker.workerId).name}</strong> is needed for this request. Its mode is {project.pendingExpansion.worker.mode}. {project.pendingExpansion.restriction && `${project.pendingExpansion.restriction}.`}</p><div className="notice">Approving updates the accepted plan. It does not send messages, publish campaigns, or contact anyone.</div><div className="action-row"><button className="button button-primary" onClick={() => { if (serverPersistenceEnabled) void projectApi.expansion(project.id, true).then(({ project }) => commit(project)).catch(fail); else commit(decideExpansion(project, true)); }}>Approve worker</button><button className="button button-secondary" onClick={() => { if (serverPersistenceEnabled) void projectApi.expansion(project.id, false).then(({ project }) => commit(project)).catch(fail); else commit(decideExpansion(project, false)); }}>Decline</button></div></div>}
          {project.pageSpec && <><div className="action-row" style={{ justifyContent: "flex-end", marginBottom: 12 }}><Link className="button button-secondary button-small" href={`/projects/${project.id}/preview`} target="_blank"><Eye size={16} />Open preview<ArrowSquareOut size={14} /></Link></div><LandingPreview spec={project.pageSpec} projectId={project.id} /><WorkerLab project={project} /></>}
        </div></section>
      </main>
    </div>
  );
}

function InterpretationCard({ project }: { project: StudioProject }) {
  const item = project.interpretation!;
  return <div className="info-card"><h2>Working interpretation</h2><div className="interpretation-grid"><div className="fact"><span>Audience</span><p>{item.audience}</p></div><div className="fact"><span>Desired value</span><p>{item.desiredValue}</p></div><div className="fact"><span>Assumptions</span><p>{item.assumptions.join(" ") || "Waiting for clarification."}</p></div><div className="fact"><span>Exclusions</span><p>{item.exclusions.join("; ") || "None stated."}</p></div></div></div>;
}
