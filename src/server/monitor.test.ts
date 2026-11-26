import { describe, expect, it, vi } from "vitest";
import type { Pipeline, Settings } from "../shared/contracts.js";
import { PipelineMonitor } from "./monitor.js";
import { MemoryDataStore } from "./store.js";

const settings: Settings = {
  repositories: [
    {
      id: "repo",
      displayName: "Repo",
      enabled: true,
      credentialMode: "anonymous",
      provider: "github",
      owner: "acme",
      repository: "repo",
    },
  ],
  refreshIntervalSeconds: 60,
  notifyOnSuccess: true,
  notifyOnFailure: true,
};

function pipeline(status: Pipeline["status"]): Pipeline {
  return {
    id: "1",
    repositoryId: "repo",
    provider: "github",
    name: "CI",
    number: "4",
    status,
    branch: "main",
    commitSha: "abc",
    actor: "octo",
    startedAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:01:00Z",
    completedAt: status === "success" ? "2026-01-01T00:01:00Z" : null,
    webUrl: "https://github.com/acme/repo/actions/runs/1",
  };
}

describe("PipelineMonitor", () => {
  it("uses the first refresh as a baseline", async () => {
    const notify = vi.fn(async () => undefined);
    const monitor = new PipelineMonitor(
      new MemoryDataStore(settings),
      async () => [pipeline("success")],
      notify,
    );
    const dashboard = await monitor.refresh();
    expect(dashboard.events).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("creates one unread event when a running pipeline completes", async () => {
    let status: Pipeline["status"] = "running";
    const notify = vi.fn(async () => undefined);
    const monitor = new PipelineMonitor(
      new MemoryDataStore(settings),
      async () => [pipeline(status)],
      notify,
    );
    await monitor.refresh();
    status = "success";
    const completed = await monitor.refresh();
    expect(completed.unreadCount).toBe(1);
    expect(completed.events[0]).toMatchObject({
      status: "success",
      read: false,
    });
    expect(notify).toHaveBeenCalledOnce();

    const read = await monitor.markEventsRead();
    expect(read.unreadCount).toBe(0);
  });

  it("keeps repository failures isolated", async () => {
    let fail = false;
    const monitor = new PipelineMonitor(
      new MemoryDataStore(settings),
      async () => {
        if (fail) throw new Error("Access denied");
        return [pipeline("running")];
      },
      async () => undefined,
    );
    await monitor.refresh();
    fail = true;
    const dashboard = await monitor.refresh();
    expect(dashboard.repositories[0]?.error).toBe("Access denied");
    expect(dashboard.repositories[0]?.pipelines).toHaveLength(1);
  });
});
