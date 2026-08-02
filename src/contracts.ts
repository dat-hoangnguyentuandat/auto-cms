import { z } from 'zod';

export const stages = [
  'ERP_READ', 'SITEMAP', 'STITCH_DESIGN', 'THEME_BUILD', 'THEME_QA', 'PACKAGE', 'FINAL_REPORT',
] as const;
export type Stage = typeof stages[number];

export const runStatuses = [
  'RUNNING', 'ACTION_REQUIRED', 'COMPLETED', 'NEEDS_HUMAN', 'FAILED', 'CANCELLED',
] as const;
export type RunStatus = typeof runStatuses[number];

export const artifactSchema = z.object({
  kind: z.string().min(1), path: z.string().min(1), sha256: z.string().optional(),
});

export const actionSchema = z.object({
  id: z.string().min(1), stage: z.enum(stages), promptFile: z.string().min(1),
  skills: z.array(z.string()), allowedWriteRoots: z.array(z.string()),
  expectedArtifacts: z.array(z.string()), submissionToken: z.string().min(16),
});
export type AgentAction = z.infer<typeof actionSchema>;

export const runSchema = z.object({
  protocolVersion: z.literal('1.0'), runId: z.string(), taskId: z.string(), taskUrl: z.string().url(),
  slug: z.string().optional(), stage: z.enum(stages), status: z.enum(runStatuses),
  attempts: z.record(z.string(), z.number().int().nonnegative()),
  artifacts: z.array(artifactSchema), action: actionSchema.optional(),
  stageStartedAt: z.string().optional(),
  metrics: z.array(z.object({
    stage: z.enum(stages), startedAt: z.string(), completedAt: z.string(),
    durationMs: z.number().int().nonnegative(), attempts: z.number().int().nonnegative(),
    actionContextBytes: z.number().int().nonnegative().optional(),
  })).optional(),
  errors: z.array(z.object({ code: z.string(), message: z.string(), stage: z.enum(stages), at: z.string() })),
  createdAt: z.string(), updatedAt: z.string(), completedAt: z.string().optional(),
});
export type RunState = z.infer<typeof runSchema>;

export type OutputEnvelope = {
  success: boolean; status: RunStatus; runId?: string; stage?: Stage;
  action?: AgentAction; result?: unknown; error?: { code: string; message: string };
  nextCommand?: string;
};
