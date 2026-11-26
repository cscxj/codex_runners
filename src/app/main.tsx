import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  App as McpApp,
  applyDocumentTheme,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type {
  Dashboard,
  Pipeline,
  RepositoryConfig,
  Settings,
} from "../shared/contracts.js";
import "./styles.css";

type AppPayload = {
  page: "dashboard" | "settings" | "repository-test";
  data: any;
};

const mcpApp = new McpApp({ name: "codex-runners", version: "0.1.0" });
function Root() {
  const [payload, setPayload] = useState<AppPayload>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const applyContext = () => {
      const context = mcpApp.getHostContext();
      if (context?.theme) applyDocumentTheme(context.theme);
      if (context?.styles?.variables) {
        applyHostStyleVariables(context.styles.variables);
      }
    };
    mcpApp.addEventListener("hostcontextchanged", applyContext);
    mcpApp.ontoolresult = (result) => {
      setPayload(result.structuredContent as AppPayload);
      setError(undefined);
    };
    void mcpApp
      .connect()
      .then(applyContext)
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Could not connect.",
        );
      });
  }, []);

  const call = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(undefined);
      try {
        const response = await mcpApp.callServerTool({ name, arguments: args });
        if (response.isError) throw new Error(readToolError(response.content));
        const next = response.structuredContent as AppPayload;
        setPayload(next);
        return next;
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : "Request failed.";
        setError(message);
        throw reason;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (!payload) {
    return <main className="shell empty">{error ?? "Loading pipelines…"}</main>;
  }
  const dashboard: Dashboard =
    payload.page === "settings" ? payload.data.dashboard : payload.data;
  const settings: Settings | undefined =
    payload.page === "settings" ? payload.data.settings : undefined;

  return (
    <main className="shell">
      {payload.page === "settings" && settings ? (
        <SettingsView
          settings={settings}
          dashboard={dashboard}
          call={call}
          busy={busy}
        />
      ) : (
        <DashboardView dashboard={dashboard} call={call} busy={busy} />
      )}
      {error ? <div className="error-banner">{error}</div> : null}
    </main>
  );
}

function DashboardView({ dashboard, call, busy }: ViewProps) {
  const active = dashboard.repositories.flatMap((result) =>
    result.pipelines
      .filter(
        (pipeline) =>
          pipeline.status === "running" || pipeline.status === "queued",
      )
      .map((pipeline) => ({ pipeline, repository: result.repository })),
  );

  useEffect(() => {
    const timer = window.setInterval(
      () => void call("runners.dashboard"),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, [call]);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="title-row">
            <h1>Runners</h1>
            {dashboard.unreadCount > 0 ? (
              <span
                className="unread-dot"
                title={`${dashboard.unreadCount} unread events`}
              />
            ) : null}
          </div>
          <p>{active.length} active pipelines</p>
        </div>
        <div className="toolbar">
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => void call("runners.refresh")}
          >
            Refresh
          </button>
          <button
            className="icon-button"
            onClick={() => void call("runners.settings")}
          >
            Settings
          </button>
        </div>
      </header>

      {dashboard.repositories.some((result) => result.error) ? (
        <section className="notice-list">
          {dashboard.repositories
            .filter((result) => result.error)
            .map((result) => (
              <div className="notice" key={result.repository.id}>
                <strong>{result.repository.displayName}</strong>: {result.error}
              </div>
            ))}
        </section>
      ) : null}

      <section className="pipeline-list" aria-label="Running pipelines">
        {active.length === 0 ? (
          <div className="empty-card">
            <span className="empty-icon">✓</span>
            <h2>No active pipelines</h2>
            <p>Configured repositories are quiet.</p>
          </div>
        ) : (
          active.map(({ pipeline, repository }) => (
            <PipelineRow
              key={`${repository.id}:${pipeline.id}`}
              pipeline={pipeline}
              repositoryName={repository.displayName}
            />
          ))
        )}
      </section>

      {dashboard.events.length > 0 ? (
        <section className="events">
          <div className="section-heading">
            <h2>Recent events</h2>
            {dashboard.unreadCount > 0 ? (
              <button
                className="text-button"
                onClick={() => void call("runners.markRead")}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {dashboard.events.slice(0, 10).map((event) => (
            <button
              className={`event-row ${event.read ? "" : "unread"}`}
              key={event.id}
              onClick={() => void mcpApp.openLink({ url: event.webUrl })}
            >
              <StatusIcon status={event.status} />
              <span className="event-name">{event.pipelineName}</span>
              <span className="event-time">
                {relativeTime(event.occurredAt)}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      <footer>
        Updated{" "}
        {dashboard.refreshedAt ? relativeTime(dashboard.refreshedAt) : "never"}
      </footer>
    </>
  );
}

function PipelineRow({
  pipeline,
  repositoryName,
}: {
  pipeline: Pipeline;
  repositoryName: string;
}) {
  return (
    <button
      className="pipeline-row"
      onClick={() => void mcpApp.openLink({ url: pipeline.webUrl })}
    >
      <StatusIcon status={pipeline.status} />
      <span className="pipeline-main">
        <span className="pipeline-name">{pipeline.name}</span>
        <span className="pipeline-meta">
          {repositoryName} · {pipeline.branch ?? "detached"} · #
          {pipeline.number}
        </span>
      </span>
      <span className="pipeline-age">
        {pipeline.startedAt ? relativeTime(pipeline.startedAt) : ""}
      </span>
      <span className="chevron">›</span>
    </button>
  );
}

function SettingsView({ settings, dashboard, call, busy }: SettingsProps) {
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings));
  const [testMessage, setTestMessage] = useState<string>();

  const addRepository = (provider: "github" | "gitlab") => {
    const common = {
      id: crypto.randomUUID(),
      displayName:
        provider === "github" ? "GitHub repository" : "GitLab project",
      enabled: true,
      credentialMode: "anonymous" as const,
    };
    const repository: RepositoryConfig =
      provider === "github"
        ? { ...common, provider, owner: "", repository: "" }
        : {
            ...common,
            provider,
            baseUrl: "https://gitlab.com",
            projectPath: "",
          };
    setDraft((current) => ({
      ...current,
      repositories: [...current.repositories, repository],
    }));
  };

  const updateRepository = (index: number, repository: RepositoryConfig) => {
    setDraft((current) => ({
      ...current,
      repositories: current.repositories.map((item, itemIndex) =>
        itemIndex === index ? repository : item,
      ),
    }));
  };

  const save = async () => {
    await call(
      "runners.saveSettings",
      draft as unknown as Record<string, unknown>,
    );
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Repository settings</h1>
          <p>Public repository monitoring runs locally.</p>
        </div>
        <button
          className="icon-button"
          onClick={() => void call("runners.dashboard")}
        >
          Done
        </button>
      </header>

      <section className="settings-section">
        <div className="section-heading">
          <h2>Repositories</h2>
          <div className="toolbar">
            <button
              className="text-button"
              onClick={() => addRepository("github")}
            >
              + GitHub
            </button>
            <button
              className="text-button"
              onClick={() => addRepository("gitlab")}
            >
              + GitLab
            </button>
          </div>
        </div>
        {draft.repositories.length === 0 ? (
          <div className="empty-card compact">
            Add a GitHub or GitLab repository.
          </div>
        ) : null}
        {draft.repositories.map((repository, index) => (
          <RepositoryEditor
            key={repository.id}
            repository={repository}
            onChange={(next) => updateRepository(index, next)}
            onRemove={() =>
              setDraft((current) => ({
                ...current,
                repositories: current.repositories.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              }))
            }
            onTest={async () => {
              setTestMessage("Testing…");
              try {
                const response = await call("runners.testRepository", {
                  repository,
                });
                setTestMessage(
                  `${response.data.pipelineCount} recent pipelines found.`,
                );
              } catch {
                setTestMessage("Connection failed. Review the message below.");
              }
            }}
          />
        ))}
        {testMessage ? <p className="test-message">{testMessage}</p> : null}
      </section>

      <section className="settings-section grid-settings">
        <label>
          Refresh interval
          <select
            value={draft.refreshIntervalSeconds}
            onChange={(event) =>
              setDraft({
                ...draft,
                refreshIntervalSeconds: Number(event.target.value),
              })
            }
          >
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={300}>5 minutes</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.notifyOnSuccess}
            onChange={(event) =>
              setDraft({ ...draft, notifyOnSuccess: event.target.checked })
            }
          />
          Notify on completion
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.notifyOnFailure}
            onChange={(event) =>
              setDraft({ ...draft, notifyOnFailure: event.target.checked })
            }
          />
          Notify on failure or cancellation
        </label>
      </section>

      <div className="settings-actions">
        <span>{dashboard.unreadCount} unread events</span>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void save()}
        >
          Save changes
        </button>
      </div>
    </>
  );
}

function RepositoryEditor({
  repository,
  onChange,
  onRemove,
  onTest,
}: RepositoryEditorProps) {
  const patch = (values: Partial<RepositoryConfig>) =>
    onChange({ ...repository, ...values } as RepositoryConfig);
  return (
    <article className="repo-editor">
      <div className="repo-editor-head">
        <span className={`provider-badge ${repository.provider}`}>
          {repository.provider}
        </span>
        <label className="checkbox-label small">
          <input
            type="checkbox"
            checked={repository.enabled}
            onChange={(event) => patch({ enabled: event.target.checked })}
          />
          Enabled
        </label>
        <button className="danger-text" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="form-grid">
        <label>
          Display name
          <input
            value={repository.displayName}
            onChange={(event) => patch({ displayName: event.target.value })}
          />
        </label>
        {repository.provider === "github" ? (
          <>
            <label>
              Owner
              <input
                value={repository.owner}
                onChange={(event) => patch({ owner: event.target.value })}
              />
            </label>
            <label>
              Repository
              <input
                value={repository.repository}
                onChange={(event) => patch({ repository: event.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              GitLab URL
              <input
                value={repository.baseUrl}
                onChange={(event) => patch({ baseUrl: event.target.value })}
              />
            </label>
            <label>
              Project path
              <input
                placeholder="group/project"
                value={repository.projectPath}
                onChange={(event) => patch({ projectPath: event.target.value })}
              />
            </label>
          </>
        )}
        <label>
          Branch filter
          <input
            placeholder="All branches"
            value={repository.branch ?? ""}
            onChange={(event) =>
              patch({ branch: event.target.value || undefined })
            }
          />
        </label>
        <label>
          Access
          <select
            value={repository.credentialMode}
            onChange={(event) =>
              patch({
                credentialMode: event.target
                  .value as RepositoryConfig["credentialMode"],
              })
            }
          >
            <option value="anonymous">Public / anonymous</option>
            <option value="cli">Use gh or glab login</option>
            <option value="environment">Environment token</option>
          </select>
        </label>
      </div>
      <button className="secondary-button" onClick={() => void onTest()}>
        Test connection
      </button>
    </article>
  );
}

function StatusIcon({ status }: { status: string }) {
  const text =
    status === "running"
      ? "↻"
      : status === "queued"
        ? "…"
        : status === "success"
          ? "✓"
          : "!";
  return <span className={`status-icon ${status}`}>{text}</span>;
}

function relativeTime(value: string): string {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}

function readToolError(content: unknown): string {
  if (!Array.isArray(content)) return "Request failed.";
  const text = content.find((item: any) => item?.type === "text")?.text;
  return typeof text === "string" ? text : "Request failed.";
}

type ViewProps = {
  dashboard: Dashboard;
  call: (name: string, args?: Record<string, unknown>) => Promise<AppPayload>;
  busy: boolean;
};
type SettingsProps = ViewProps & { settings: Settings };
type RepositoryEditorProps = {
  repository: RepositoryConfig;
  onChange: (repository: RepositoryConfig) => void;
  onRemove: () => void;
  onTest: () => Promise<void>;
};

createRoot(document.getElementById("root")!).render(<Root />);
