import type {
  Pipeline,
  PipelineStatus,
  RepositoryConfig,
} from "../../shared/contracts.js";
import { fetchJson } from "../http.js";
import { resolveCredential } from "../credentials.js";

type GitHubRun = {
  id: number;
  name: string | null;
  display_title: string | null;
  run_number: number;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
  created_at: string;
  run_started_at: string | null;
  updated_at: string;
  actor: { login?: string } | null;
};

type GitHubRunsResponse = { workflow_runs: GitHubRun[] };

export async function listGitHubPipelines(
  repository: RepositoryConfig,
): Promise<Pipeline[]> {
  if (repository.provider !== "github") {
    throw new Error("Expected a GitHub repository configuration.");
  }
  const url = new URL(
    `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/actions/runs`,
    "https://api.github.com",
  );
  url.searchParams.set("per_page", "30");
  if (repository.branch) url.searchParams.set("branch", repository.branch);

  const token = await resolveCredential(repository);
  const data = await fetchJson<GitHubRunsResponse>(
    url,
    token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  );

  return data.workflow_runs.map((run) => ({
    id: String(run.id),
    repositoryId: repository.id,
    provider: "github",
    name: run.name ?? run.display_title ?? `Workflow #${run.run_number}`,
    number: String(run.run_number),
    status: mapGitHubStatus(run.status, run.conclusion),
    branch: run.head_branch,
    commitSha: run.head_sha,
    actor: run.actor?.login ?? null,
    startedAt: run.run_started_at ?? run.created_at,
    updatedAt: run.updated_at,
    completedAt: run.status === "completed" ? run.updated_at : null,
    webUrl: run.html_url,
  }));
}

export function mapGitHubStatus(
  status: string,
  conclusion: string | null,
): PipelineStatus {
  if (["queued", "waiting", "requested", "pending"].includes(status)) {
    return "queued";
  }
  if (status === "in_progress") return "running";
  if (status !== "completed") return "unknown";
  if (conclusion === "success") return "success";
  if (["failure", "timed_out", "action_required"].includes(conclusion ?? "")) {
    return "failed";
  }
  if (conclusion === "cancelled") return "cancelled";
  if (["skipped", "neutral", "stale"].includes(conclusion ?? "")) {
    return "skipped";
  }
  return "unknown";
}
