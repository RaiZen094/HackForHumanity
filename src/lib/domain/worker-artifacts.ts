import { z } from "zod";

import { workerIdSchema, type WorkerId } from "./schemas";

export const voiceResultSchema = z.object({
  summary: z.string(), intent: z.string(), entities: z.array(z.string()),
  recommendedHandoff: z.string(), confidence: z.number().min(0).max(1),
});
export const supportResultSchema = z.object({
  category: z.string(), priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  draftedAnswer: z.string(), route: z.string(), externalActionTaken: z.literal(false),
});
export const contentResultSchema = z.object({
  headline: z.string(), summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(1).max(6),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).max(6), cta: z.string(),
});
export const campaignResultSchema = z.object({
  objective: z.string(), audience: z.string(), channels: z.array(z.string()).min(1).max(5),
  messages: z.array(z.object({ channel: z.string(), copy: z.string() })).min(1).max(6),
  schedule: z.string(), externalActionTaken: z.literal(false),
});
export const successResultSchema = z.object({
  goal: z.string(),
  stages: z.array(z.object({ name: z.string(), trigger: z.string(), message: z.string(), successSignal: z.string() })).min(2).max(6),
  risks: z.array(z.string()).max(6), externalActionTaken: z.literal(false),
});
export const growthResultSchema = z.object({
  overview: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), interpretation: z.string() })).min(1).max(6),
  insights: z.array(z.string()).min(1).max(6), recommendations: z.array(z.string()).min(1).max(6), dataScope: z.string(),
});

export const resultSchemas = {
  "voice-executive": voiceResultSchema,
  "customer-service-executive": supportResultSchema,
  "content-executive": contentResultSchema,
  "digital-campaign-executive": campaignResultSchema,
  "customer-success-executive": successResultSchema,
  "growth-analyst": growthResultSchema,
} satisfies Record<WorkerId, z.ZodType>;

export const workerArtifactSchema = z.object({
  id: z.string(), projectId: z.string(), workerId: workerIdSchema, input: z.string(),
  result: z.record(z.string(), z.unknown()), createdAt: z.string().datetime(),
});
export type WorkerArtifact = z.infer<typeof workerArtifactSchema>;
