import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryConfig } from "../shared/contracts.js";

const execFileAsync = promisify(execFile);

export async function resolveCredential(
  repository: RepositoryConfig,
): Promise<string | undefined> {
  if (repository.credentialMode === "anonymous") return undefined;

  if (repository.credentialMode === "environment") {
    return repository.provider === "github"
      ? (process.env.CODEX_RUNNERS_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN)
      : (process.env.CODEX_RUNNERS_GITLAB_TOKEN ?? process.env.GITLAB_TOKEN);
  }

  if (repository.provider === "gitlab") {
    throw new Error("GitLab CLI authentication must use glab api.");
  }
  const command = "gh";
  const hostname = "github.com";
  const { stdout } = await execFileAsync(
    command,
    ["auth", "token", "--hostname", hostname],
    { timeout: 3_000, maxBuffer: 16_384 },
  );
  const token = stdout.trim();
  return token.length > 0 ? token : undefined;
}

export async function fetchGitLabWithCli<T>(url: URL): Promise<T> {
  const apiPath = `${url.pathname.replace(/^\/api\/v4\//, "")}${url.search}`;
  const { stdout } = await execFileAsync(
    "glab",
    ["api", "--hostname", url.hostname, apiPath],
    { timeout: 10_000, maxBuffer: 4 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as T;
}
