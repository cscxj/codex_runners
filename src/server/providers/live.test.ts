import { describe, expect, it } from "vitest";
import { listGitHubPipelines } from "./github.js";
import { listGitLabPipelines } from "./gitlab.js";

const live =
  process.env.CODEX_RUNNERS_LIVE_TEST === "1" ? describe : describe.skip;

live("live read-only provider checks", () => {
  it("reads a public GitHub repository", async () => {
    const [owner, repository] = required("CODEX_RUNNERS_LIVE_GITHUB").split(
      "/",
    );
    expect(owner).toBeTruthy();
    expect(repository).toBeTruthy();
    const pipelines = await listGitHubPipelines({
      id: "live-github",
      displayName: "Live GitHub",
      enabled: true,
      credentialMode: "anonymous",
      provider: "github",
      owner: owner!,
      repository: repository!,
    });
    expect(Array.isArray(pipelines)).toBe(true);
  });

  it("reads GitLab through the existing glab login", async () => {
    const pipelines = await listGitLabPipelines({
      id: "live-gitlab",
      displayName: "Live GitLab",
      enabled: true,
      credentialMode: "cli",
      provider: "gitlab",
      baseUrl: required("CODEX_RUNNERS_LIVE_GITLAB_URL"),
      projectPath: required("CODEX_RUNNERS_LIVE_GITLAB_PROJECT"),
    });
    expect(Array.isArray(pipelines)).toBe(true);
  });
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live tests.`);
  return value;
}
