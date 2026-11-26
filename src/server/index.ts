import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  createSettings,
  type OpenAIUiResourceMetadata,
  type OpenAIUiToolMetadata,
} from "@openai/mcp-extensions/server";
import { z } from "zod/v4";
import { repositorySchema, settingsSchema } from "../shared/contracts.js";
import { PipelineMonitor } from "./monitor.js";
import { listPipelines } from "./providers/index.js";
import { FileDataStore } from "./store.js";

const APP_URI = "ui://codex-runners/dashboard-v1";
const APP_MIME_TYPE = "text/html;profile=mcp-app";
const readonlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
};
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};

const icons = await Promise.all(
  (["light", "dark"] as const).map(async (theme) => ({
    src:
      "data:image/svg+xml," +
      encodeURIComponent(
        await readFile(
          new URL(
            `../assets/icon${theme === "dark" ? "-dark" : ""}.svg`,
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    mimeType: "image/svg+xml",
    sizes: ["any"],
    theme,
  })),
);

serveStdio(async () => {
  const server = new McpServer({
    name: "codex-runners",
    title: "Codex Runners",
    version: "0.1.0",
    icons,
  });
  const store = new FileDataStore();
  const monitor = new PipelineMonitor(store);
  const html = await readFile(new URL("./app.html", import.meta.url), "utf8");

  server.registerResource("codex-runners-app", APP_URI, {}, async () => ({
    contents: [
      {
        uri: APP_URI,
        mimeType: APP_MIME_TYPE,
        text: html,
        _meta: {
          "openai/ui": {
            preferredDisplayMode: "fullscreen",
            availableDisplayModes: ["inline", "fullscreen"],
          } satisfies OpenAIUiResourceMetadata,
        },
      },
    ],
  }));

  const appMetadata = (
    entrypoints: NonNullable<OpenAIUiToolMetadata["entrypoints"]> = [],
  ) => ({
    ui: { resourceUri: APP_URI, visibility: ["app", "model"] },
    "openai/ui": { entrypoints } satisfies OpenAIUiToolMetadata,
    "openai/iconStyle": "monochrome",
  });

  server.registerTool(
    "runners.dashboard",
    {
      title: "Codex Runners",
      description: "Open the pipeline monitor.",
      inputSchema: z.object({}),
      icons,
      annotations: readonlyAnnotations,
      _meta: appMetadata([{ type: "global" }]),
    },
    async () => result("dashboard", await monitor.dashboard()),
  );

  server.registerTool(
    "runners.settings",
    {
      title: "Configure repositories",
      description: "Configure GitHub and GitLab repositories.",
      inputSchema: z.object({}),
      annotations: readonlyAnnotations,
      _meta: appMetadata(),
    },
    async () =>
      result("settings", {
        settings: await store.readSettings(),
        dashboard: await monitor.dashboard(),
      }),
  );

  server.registerTool(
    "runners.refresh",
    {
      title: "Refresh pipelines",
      description: "Refresh configured repository pipelines now.",
      inputSchema: z.object({}),
      annotations: readonlyAnnotations,
      _meta: { ui: { visibility: ["app", "model"] } },
    },
    async () => result("dashboard", await monitor.refresh()),
  );

  server.registerTool(
    "runners.saveSettings",
    {
      title: "Save repository settings",
      description: "Save the complete Codex Runners configuration.",
      inputSchema: settingsSchema,
      annotations: writeAnnotations,
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      const settings = await store.writeSettings(input);
      await monitor.reschedule();
      return result("settings", {
        settings,
        dashboard: await monitor.refresh(),
      });
    },
  );

  server.registerTool(
    "runners.testRepository",
    {
      title: "Test repository",
      description: "Test read-only access to one repository.",
      inputSchema: z.object({ repository: repositorySchema }),
      annotations: readonlyAnnotations,
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ repository }) => {
      const pipelines = await listPipelines(repository);
      return result("repository-test", {
        repositoryId: repository.id,
        pipelineCount: pipelines.length,
      });
    },
  );

  server.registerTool(
    "runners.markRead",
    {
      title: "Mark pipeline events read",
      description: "Mark all completion and failure events as read.",
      inputSchema: z.object({}),
      annotations: writeAnnotations,
      _meta: { ui: { visibility: ["app"] } },
    },
    async () => result("dashboard", await monitor.markEventsRead()),
  );

  const structuredSettings = createSettings(server);
  structuredSettings.register({
    fields: {
      refreshIntervalSeconds: {
        schema: z.number().int().min(30).max(300),
        title: "Refresh interval (seconds)",
      },
      notifyOnSuccess: {
        schema: z.boolean(),
        title: "Notify when pipelines complete",
      },
      notifyOnFailure: {
        schema: z.boolean(),
        title: "Notify when pipelines fail or are cancelled",
      },
    },
    layout: [
      {
        kind: "group",
        title: "Monitoring",
        items: [
          { kind: "property", property: "refreshIntervalSeconds" },
          { kind: "property", property: "notifyOnSuccess" },
          { kind: "property", property: "notifyOnFailure" },
        ],
      },
      {
        kind: "group",
        title: "Repositories",
        items: [{ kind: "tool", tool: "runners.settings" }],
      },
    ],
    read: async () => {
      const settings = await store.readSettings();
      return {
        refreshIntervalSeconds: settings.refreshIntervalSeconds,
        notifyOnSuccess: settings.notifyOnSuccess,
        notifyOnFailure: settings.notifyOnFailure,
      };
    },
    update: async (set) => {
      const current = await store.readSettings();
      const settings = await store.writeSettings(
        settingsSchema.parse({ ...current, ...set }),
      );
      await monitor.reschedule();
      return {
        refreshIntervalSeconds: settings.refreshIntervalSeconds,
        notifyOnSuccess: settings.notifyOnSuccess,
        notifyOnFailure: settings.notifyOnFailure,
      };
    },
  });

  monitor.start().catch(() => undefined);
  return server;
});

function result(page: string, data: unknown) {
  const structuredContent = { page, data };
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(structuredContent) },
    ],
    structuredContent,
  };
}
