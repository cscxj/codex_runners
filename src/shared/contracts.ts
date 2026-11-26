import { z } from "zod";

export const providerSchema = z.enum(["github", "gitlab"]);
export type Provider = z.infer<typeof providerSchema>;

export const credentialModeSchema = z.enum(["anonymous", "cli", "environment"]);
export type CredentialMode = z.infer<typeof credentialModeSchema>;

const repositoryBaseSchema = z.object({
  id: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  branch: z.string().trim().max(255).optional(),
  credentialMode: credentialModeSchema.default("anonymous"),
});

export const githubRepositorySchema = repositoryBaseSchema.extend({
  provider: z.literal("github"),
  owner: z.string().min(1).max(100),
  repository: z.string().min(1).max(100),
});

export const gitlabRepositorySchema = repositoryBaseSchema.extend({
  provider: z.literal("gitlab"),
  baseUrl: z.string().url(),
  projectPath: z.string().min(1).max(500),
});

export const repositorySchema = z.discriminatedUnion("provider", [
  githubRepositorySchema,
  gitlabRepositorySchema,
]);
export type RepositoryConfig = z.infer<typeof repositorySchema>;

export const settingsSchema = z
  .object({
    repositories: z.array(repositorySchema).max(100).default([]),
    refreshIntervalSeconds: z.number().int().min(30).max(300).default(60),
    notifyOnSuccess: z.boolean().default(true),
    notifyOnFailure: z.boolean().default(true),
  })
  .superRefine((settings, context) => {
    const ids = new Set<string>();
    settings.repositories.forEach((repository, index) => {
      if (ids.has(repository.id)) {
        context.addIssue({
          code: "custom",
          message: "Repository IDs must be unique.",
          path: ["repositories", index, "id"],
        });
      }
      ids.add(repository.id);
    });
  });
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  repositories: [],
  refreshIntervalSeconds: 60,
  notifyOnSuccess: true,
  notifyOnFailure: true,
};

export const pipelineStatusSchema = z.enum([
  "queued",
  "running",
  "success",
  "failed",
  "cancelled",
  "skipped",
  "unknown",
]);
export type PipelineStatus = z.infer<typeof pipelineStatusSchema>;

export const pipelineSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  provider: providerSchema,
  name: z.string(),
  number: z.string(),
  status: pipelineStatusSchema,
  branch: z.string().nullable(),
  commitSha: z.string().nullable(),
  actor: z.string().nullable(),
  startedAt: z.string().nullable(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  webUrl: z.string().url(),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

export const pipelineEventSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string(),
  status: z.enum(["success", "failed", "cancelled"]),
  webUrl: z.string().url(),
  occurredAt: z.string(),
  read: z.boolean(),
});
export type PipelineEvent = z.infer<typeof pipelineEventSchema>;

export const repositoryResultSchema = z.object({
  repository: repositorySchema,
  pipelines: z.array(pipelineSchema),
  error: z.string().nullable(),
});
export type RepositoryResult = z.infer<typeof repositoryResultSchema>;

export const dashboardSchema = z.object({
  repositories: z.array(repositoryResultSchema),
  events: z.array(pipelineEventSchema),
  unreadCount: z.number().int().nonnegative(),
  refreshedAt: z.string().nullable(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export function isActiveStatus(status: PipelineStatus): boolean {
  return status === "queued" || status === "running";
}

export function isNotifiableStatus(
  status: PipelineStatus,
): status is "success" | "failed" | "cancelled" {
  return status === "success" || status === "failed" || status === "cancelled";
}
