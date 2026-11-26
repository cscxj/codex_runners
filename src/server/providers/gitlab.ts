import type {
  Pipeline,
  PipelineStatus,
  RepositoryConfig,
} from "../../shared/contracts.js";
import { fetchGitLabWithCli, resolveCredential } from "../credentials.js";
import { fetchJson } from "../http.js";

type GitLabPipeline = {
  id: number;
  iid?: number;
  name?: string | null;
  status: string;
  source?: string;
  ref: string | null;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  user?: { username?: string } | null;
};

export async function listGitLabPipelines(
  repository: RepositoryConfig,
): Promise<Pipeline[]> {
  if (repository.provider !== "gitlab") {
    throw new Error("Expected a GitLab repository configuration.");
  }
  const baseUrl = validateGitLabBaseUrl(repository.baseUrl);
  const url = new URL(
    `/api/v4/projects/${encodeURIComponent(repository.projectPath)}/pipelines`,
    baseUrl,
  );
  url.searchParams.set("per_page", "30");
  url.searchParams.set("order_by", "updated_at");
  url.searchParams.set("sort", "desc");
  if (repository.branch) url.searchParams.set("ref", repository.branch);

  const data =
    repository.credentialMode === "cli"
      ? await fetchGitLabWithCli<GitLabPipeline[]>(url)
      : await fetchGitLabPipelinesWithHttp(repository, url);
  return data.map((pipeline) => ({
    id: String(pipeline.id),
    repositoryId: repository.id,
    provider: "gitlab",
    name:
      pipeline.name ??
      (pipeline.source
        ? `${pipeline.source} pipeline`
        : `Pipeline #${pipeline.id}`),
    number: String(pipeline.iid ?? pipeline.id),
    status: mapGitLabStatus(pipeline.status),
    branch: pipeline.ref,
    commitSha: pipeline.sha,
    actor: pipeline.user?.username ?? null,
    startedAt: pipeline.created_at,
    updatedAt: pipeline.updated_at,
    completedAt: isGitLabTerminal(pipeline.status) ? pipeline.updated_at : null,
    webUrl: pipeline.web_url,
  }));
}

async function fetchGitLabPipelinesWithHttp(
  repository: RepositoryConfig,
  url: URL,
): Promise<GitLabPipeline[]> {
  const token = await resolveCredential(repository);
  return fetchJson<GitLabPipeline[]>(
    url,
    token ? { headers: { "PRIVATE-TOKEN": token } } : {},
  );
}

export function validateGitLabBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password) {
    throw new Error("GitLab URL must not contain credentials.");
  }
  const localHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    url.protocol !== "https:" &&
    !(localHost && process.env.CODEX_RUNNERS_ALLOW_INSECURE_HTTP === "1")
  ) {
    throw new Error("GitLab URL must use HTTPS.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function mapGitLabStatus(status: string): PipelineStatus {
  if (
    ["created", "waiting_for_resource", "preparing", "pending"].includes(status)
  ) {
    return "queued";
  }
  if (status === "running") return "running";
  if (status === "success") return "success";
  if (status === "failed") return "failed";
  if (status === "canceled") return "cancelled";
  if (["skipped", "manual", "scheduled"].includes(status)) return "skipped";
  return "unknown";
}

function isGitLabTerminal(status: string): boolean {
  return ["success", "failed", "canceled", "skipped"].includes(status);
}
