import { afterEach, describe, expect, it, vi } from "vitest";
import { listGitHubPipelines, mapGitHubStatus } from "./github.js";
import {
  listGitLabPipelines,
  mapGitLabStatus,
  validateGitLabBaseUrl,
} from "./gitlab.js";

afterEach(() => vi.unstubAllGlobals());

describe("provider status mapping", () => {
  it("normalizes GitHub statuses", () => {
    expect(mapGitHubStatus("in_progress", null)).toBe("running");
    expect(mapGitHubStatus("completed", "success")).toBe("success");
    expect(mapGitHubStatus("completed", "timed_out")).toBe("failed");
    expect(mapGitHubStatus("completed", "cancelled")).toBe("cancelled");
  });

  it("normalizes GitLab statuses", () => {
    expect(mapGitLabStatus("pending")).toBe("queued");
    expect(mapGitLabStatus("running")).toBe("running");
    expect(mapGitLabStatus("success")).toBe("success");
    expect(mapGitLabStatus("failed")).toBe("failed");
    expect(mapGitLabStatus("canceled")).toBe("cancelled");
  });
});

describe("GitHub provider", () => {
  it("maps public workflow runs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              workflow_runs: [
                {
                  id: 7,
                  name: "CI",
                  display_title: "test",
                  run_number: 12,
                  status: "in_progress",
                  conclusion: null,
                  head_branch: "main",
                  head_sha: "abc",
                  html_url: "https://github.com/acme/widget/actions/runs/7",
                  created_at: "2026-01-01T00:00:00Z",
                  run_started_at: "2026-01-01T00:01:00Z",
                  updated_at: "2026-01-01T00:02:00Z",
                  actor: { login: "octo" },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const pipelines = await listGitHubPipelines({
      id: "github-acme-widget",
      displayName: "Widget",
      enabled: true,
      credentialMode: "anonymous",
      provider: "github",
      owner: "acme",
      repository: "widget",
    });
    expect(pipelines).toMatchObject([
      { id: "7", name: "CI", status: "running", actor: "octo" },
    ]);
  });
});

describe("GitLab provider", () => {
  it("normalizes the base URL and rejects unsafe schemes", () => {
    expect(validateGitLabBaseUrl("https://gitlab.example.com/group").href).toBe(
      "https://gitlab.example.com/",
    );
    expect(() => validateGitLabBaseUrl("http://gitlab.example.com")).toThrow(
      "HTTPS",
    );
    expect(() =>
      validateGitLabBaseUrl("https://user:secret@gitlab.example.com"),
    ).toThrow("credentials");
  });

  it("maps public pipelines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                id: 9,
                iid: 3,
                name: "Build",
                status: "success",
                source: "push",
                ref: "main",
                sha: "def",
                web_url: "https://gitlab.example.com/acme/widget/-/pipelines/9",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:03:00Z",
                user: { username: "gitlab-user" },
              },
            ]),
            { status: 200 },
          ),
      ),
    );
    const pipelines = await listGitLabPipelines({
      id: "gitlab-acme-widget",
      displayName: "Widget",
      enabled: true,
      credentialMode: "anonymous",
      provider: "gitlab",
      baseUrl: "https://gitlab.example.com",
      projectPath: "acme/widget",
    });
    expect(pipelines).toMatchObject([
      { id: "9", number: "3", status: "success", actor: "gitlab-user" },
    ]);
  });
});
