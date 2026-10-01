import { z } from "zod";

export const projectStageSchema = z.enum([
  "DESCRIBE",
  "CLARIFYING",
  "RECOMMENDING",
  "AWAITING_APPROVAL",
  "BUILDING",
  "PREVIEW",
  "REVISING",
  "FAILED",
]);

export const workerIdSchema = z.enum([
  "voice-executive",
  "customer-service-executive",
  "content-executive",
  "digital-campaign-executive",
  "customer-success-executive",
  "growth-analyst",
]);

export const executionModeSchema = z.enum(["live", "simulated", "draft"]);

export const interpretationSchema = z.object({
  audience: z.string().min(1),
  problem: z.string().min(1),
  desiredValue: z.string().min(1),
  explicitRequirements: z.array(z.string()),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
  clarificationRequired: z.boolean(),
  clarificationQuestion: z.string().nullable(),
});

export const workerRecommendationSchema = z.object({
  workerId: workerIdSchema,
  contribution: z.string().min(1),
  reason: z.string().min(1),
  selected: z.boolean(),
  mode: executionModeSchema,
});

export const approvedPlanSchema = z.object({
  prompt: z.string().min(1),
  interpretation: interpretationSchema,
  workers: z.array(workerRecommendationSchema).min(1),
  approvedAt: z.string().datetime(),
});

export const pageFeatureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  requiredWorkerId: workerIdSchema,
  mode: executionModeSchema,
  actionLabel: z.string().min(1).default("Try feature"),
  supportingWorkerIds: z.array(workerIdSchema).default([]),
});

export const pageMediaSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("generated-image"),
  url: z.string().min(1),
  alt: z.string().min(1),
  prompt: z.string().min(1),
  placement: z.enum(["hero", "section"]),
  sectionId: z.string().nullable(),
  generatedBy: z.literal("content-executive"),
});

export const pageSectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("narrative"),
    heading: z.string(),
    body: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("feature-grid"),
    heading: z.string(),
    features: z.array(pageFeatureSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal("support-form"),
    heading: z.string(),
    helperText: z.string(),
    requiredWorkerId: z.literal("customer-service-executive"),
  }),
]);

export const pageSpecSchema = z.object({
  version: z.literal(1),
  brandName: z.string().min(1),
  theme: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  hero: z.object({
    eyebrow: z.string(),
    headline: z.string().min(1),
    subheadline: z.string().min(1),
    primaryAction: z.string().min(1),
  }),
  sections: z.array(pageSectionSchema).min(1).max(8),
  approvedWorkerIds: z.array(workerIdSchema).min(1),
  media: z.array(pageMediaSchema).default([]),
});

export const revisionOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("replace-headline"), value: z.string().min(1) }),
  z.object({ type: z.literal("replace-subheadline"), value: z.string().min(1) }),
  z.object({
    type: z.literal("move-section"),
    sectionId: z.string(),
    direction: z.enum(["up", "down"]),
  }),
  z.object({ type: z.literal("remove-section"), sectionId: z.string() }),
]);

export const revisionPlanSchema = z.object({
  category: z.enum(["copy", "hierarchy", "order", "capability", "destructive"]),
  clarificationRequired: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  destructive: z.boolean(),
  requiresWorkerId: workerIdSchema.nullable(),
  operations: z.array(revisionOperationSchema),
  summary: z.string(),
});

export const productEventNameSchema = z.enum([
  "project_prompt_submitted",
  "worker_recommendation_shown",
  "worker_selection_changed",
  "worker_team_approved",
  "landing_page_build_started",
  "landing_page_build_completed",
  "revision_requested",
  "revision_applied",
]);

export type ProjectStage = z.infer<typeof projectStageSchema>;
export type WorkerId = z.infer<typeof workerIdSchema>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;
export type WorkerRecommendation = z.infer<typeof workerRecommendationSchema>;
export type ApprovedPlan = z.infer<typeof approvedPlanSchema>;
export type PageSpec = z.infer<typeof pageSpecSchema>;
export type RevisionPlan = z.infer<typeof revisionPlanSchema>;
export type ProductEventName = z.infer<typeof productEventNameSchema>;

export interface StudioMessage {
  id: string;
  role: "participant" | "assistant" | "system";
  kind: "prompt" | "interpretation" | "clarification" | "status" | "revision";
  content: string;
  createdAt: string;
}

export interface ProductEvent {
  id: string;
  name: ProductEventName;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface PendingExpansion {
  worker: WorkerRecommendation;
  request: string;
  restriction: string | null;
}

export interface StudioProject {
  id: string;
  name: string;
  stage: ProjectStage;
  originalPrompt: string | null;
  currentPrompt: string | null;
  interpretation: Interpretation | null;
  recommendations: WorkerRecommendation[];
  approvedPlan: ApprovedPlan | null;
  pendingExpansion: PendingExpansion | null;
  pageSpec: PageSpec | null;
  messages: StudioMessage[];
  events: ProductEvent[];
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}
