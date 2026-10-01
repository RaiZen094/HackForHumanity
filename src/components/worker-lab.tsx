"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartLineUp, CircleNotch, Headset, Megaphone, Microphone, PencilLine, Play, Sparkle, UserFocus } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { WorkerArtifact } from "@/lib/domain/worker-artifacts";
import type { StudioProject, WorkerId } from "@/lib/domain/schemas";
import { WORKERS } from "@/lib/domain/workers";
import { projectApi, serverPersistenceEnabled } from "@/lib/client/api";

interface SpeechResultEvent { results: ArrayLike<{ 0: { transcript: string } }> }
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; start: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null;
}

const workerUi: Record<WorkerId, { icon: Icon; prompt: string }> = {
  "voice-executive": { icon: Microphone, prompt: "Speak or type a field request" },
  "customer-service-executive": { icon: Headset, prompt: "Enter a real user question or issue" },
  "content-executive": { icon: PencilLine, prompt: "Describe the content you need" },
  "digital-campaign-executive": { icon: Megaphone, prompt: "Describe a community engagement goal" },
  "customer-success-executive": { icon: UserFocus, prompt: "Describe the journey or intervention" },
  "growth-analyst": { icon: ChartLineUp, prompt: "Ask what you want to measure or learn" },
};

export function WorkerLab({ project }: { project: StudioProject }) {
  const approved = useMemo(() => new Set(project.approvedPlan?.workers.map((item) => item.workerId) ?? []), [project.approvedPlan]);
  const firstApproved = WORKERS.find((worker) => approved.has(worker.id))?.id ?? WORKERS[0].id;
  const [active, setActive] = useState<WorkerId>(firstApproved);
  const [input, setInput] = useState(exampleFor(firstApproved, project));
  const [artifacts, setArtifacts] = useState<WorkerArtifact[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serverPersistenceEnabled) void projectApi.workerRuns(project.id).then(({ artifacts }) => setArtifacts(artifacts)).catch(() => undefined);
  }, [project.id]);

  const latest = artifacts.find((artifact) => artifact.workerId === active);
  const select = (workerId: WorkerId) => { setActive(workerId); setInput(exampleFor(workerId, project)); setError(null); };
  async function run() {
    if (!input.trim() || !approved.has(active) || !serverPersistenceEnabled) return;
    setBusy(true); setError(null);
    try { const { artifact } = await projectApi.runWorker(project.id, active, input); setArtifacts((items) => [artifact, ...items]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The worker could not finish this run."); }
    finally { setBusy(false); }
  }
  function captureVoice() {
    const browser = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Voice capture is not supported in this browser. You can type the transcript instead."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US"; recognition.interimResults = false;
    recognition.onresult = (event) => setInput(Array.from(event.results).map((result) => result[0].transcript).join(" "));
    recognition.onerror = () => setError("Voice capture could not hear a clear request. Try again or type it.");
    recognition.onend = () => setListening(false);
    setListening(true); setError(null); recognition.start();
  }
  const ActiveIcon = workerUi[active].icon;

  return <section className="worker-lab" aria-labelledby="worker-lab-title">
    <div className="worker-lab-head"><div><p className="eyebrow">Live solution tools</p><h2 id="worker-lab-title">Worker Lab</h2><p>The Landing Page Manager built this experience. Run each approved specialist against the same project context.</p></div><span className="status-chip"><Sparkle size={13} weight="fill" />7 workers active</span></div>
    <div className="worker-lab-grid">
      <div className="worker-tabs" role="tablist" aria-label="AI workers">
        {WORKERS.map((worker) => { const Icon = workerUi[worker.id].icon; const enabled = approved.has(worker.id); return <button key={worker.id} data-worker={worker.id} role="tab" tabIndex={active === worker.id ? 0 : -1} aria-selected={active === worker.id} className={`worker-tab ${active === worker.id ? "active" : ""}`} onClick={() => select(worker.id)} onKeyDown={(event) => { if (!["ArrowDown","ArrowRight","ArrowUp","ArrowLeft"].includes(event.key)) return; event.preventDefault(); const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1; const index = WORKERS.findIndex((item) => item.id === worker.id); const next = WORKERS[(index + offset + WORKERS.length) % WORKERS.length].id; select(next); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-worker="${next}"]`)?.focus()); }}><Icon size={18} /><span><strong>{worker.shortName}</strong><small>{enabled ? `Approved · ${worker.mode}` : "Not approved"}</small></span><i className={enabled ? "worker-live-dot" : "worker-lock-dot"} /></button>; })}
      </div>
      <div className="worker-console">
        <div className="worker-console-title"><span><ActiveIcon size={21} /></span><div><h3>{WORKERS.find((worker) => worker.id === active)?.name}</h3><p>{WORKERS.find((worker) => worker.id === active)?.contribution}</p></div></div>
        {!approved.has(active) ? <div className="worker-locked"><h4>This specialist is not in the approved team</h4><p>Return to the studio conversation and request this capability. The page manager will propose it for separate approval.</p></div> : <>
          <div className="worker-input-top"><label className="worker-input-label" htmlFor={`worker-input-${active}`}>{workerUi[active].prompt}</label>{active === "voice-executive" && <button className="button button-secondary button-small" type="button" onClick={captureVoice} disabled={listening}>{listening ? <CircleNotch className="spin" size={15} /> : <Microphone size={15} />}{listening ? "Listening" : "Use microphone"}</button>}</div>
          <textarea id={`worker-input-${active}`} className="worker-input" value={input} onChange={(event) => setInput(event.target.value)} />
          <div className="worker-run-row"><span>Uses {process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-4o-mini"} with project context</span><button className="button button-primary" onClick={run} disabled={busy || !input.trim() || !serverPersistenceEnabled}>{busy ? <CircleNotch className="spin" size={17} /> : <Play size={16} weight="fill" />}{busy ? "Working" : "Run worker"}</button></div>
          {!serverPersistenceEnabled && <p className="error-note">Live workers require server persistence mode.</p>}{error && <p className="error-note">{error}</p>}
          <WorkerResult artifact={latest} loading={busy} />
        </>}
      </div>
    </div>
  </section>;
}

function WorkerResult({ artifact, loading }: { artifact?: WorkerArtifact; loading: boolean }) {
  if (loading) return <div className="worker-result worker-result-loading"><span /><span /><span /></div>;
  if (!artifact) return <div className="worker-result-empty"><Sparkle size={19} /><p>Run this worker to create a saved, demonstration-ready result.</p></div>;
  return <div className="worker-result"><div className="worker-result-meta"><strong>Latest result</strong><time>{new Date(artifact.createdAt).toLocaleString()}</time></div><ResultValue value={artifact.result} /></div>;
}

function ResultValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (Array.isArray(value)) return <div className="result-list">{value.map((item, index) => <div className="result-list-item" key={index}><ResultValue value={item} depth={depth + 1} /></div>)}</div>;
  if (value && typeof value === "object") return <div className={depth ? "result-object nested" : "result-object"}>{Object.entries(value).map(([key, item]) => <div className="result-field" key={key}><span>{labelFor(key)}</span><ResultValue value={item} depth={depth + 1} /></div>)}</div>;
  if (typeof value === "boolean") return <p>{value ? "Yes" : "No"}</p>;
  return <p>{String(value)}</p>;
}

function labelFor(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }

function exampleFor(workerId: WorkerId, project: StudioProject) {
  const audience = project.interpretation?.audience ?? "the affected community";
  const outcome = project.interpretation?.desiredValue ?? "make the solution useful and accessible";
  const examples: Record<WorkerId, string> = {
    "voice-executive": `A field user from ${audience} describes an urgent issue related to this project. Extract the intent, important details, and safest handoff.`,
    "customer-service-executive": `A member of ${audience} cannot access the proposed service and needs to know what to do next.`,
    "content-executive": `Create a concise public explanation and FAQs that help ${audience.toLowerCase()} understand how this solution works.`,
    "digital-campaign-executive": `Plan a one-week community awareness campaign that reaches ${audience.toLowerCase()} and encourages responsible adoption.`,
    "customer-success-executive": `Design the onboarding and follow-up journey needed to ${outcome.toLowerCase()}`,
    "growth-analyst": "Analyze this project's real activity so far and recommend three measurable experiments for impact, feasibility, and scale.",
  };
  return examples[workerId];
}
