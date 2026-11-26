import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dataDirectory = await mkdtemp(join(tmpdir(), "codex-runners-verify-"));
const manifests = await Promise.all(
  ["package.json", "plugin.json", ".codex-plugin/plugin.json"].map(
    async (path) => JSON.parse(await readFile(path, "utf8")),
  ),
);
const versions = new Set(manifests.map((manifest) => manifest.version));
if (versions.size !== 1) throw new Error("Plugin versions are inconsistent.");

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"],
  env: {
    ...process.env,
    CODEX_RUNNERS_DATA_DIR: dataDirectory,
    CODEX_RUNNERS_DISABLE_NOTIFICATIONS: "1",
  },
  stderr: "pipe",
});
const client = new Client({ name: "codex-runners-verifier", version: "0.1.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = new Set(tools.tools.map((tool) => tool.name));
  for (const required of [
    "runners.dashboard",
    "runners.settings",
    "runners.refresh",
    "runners.saveSettings",
    "runners.testRepository",
    "runners.markRead",
  ]) {
    if (!toolNames.has(required))
      throw new Error(`Missing MCP tool: ${required}`);
  }

  const dashboardTool = tools.tools.find(
    (tool) => tool.name === "runners.dashboard",
  );
  const entrypoints = dashboardTool?._meta?.["openai/ui"]?.entrypoints;
  if (!Array.isArray(entrypoints) || entrypoints[0]?.type !== "global") {
    throw new Error("Dashboard global entrypoint is missing.");
  }

  const dashboard = await client.callTool({
    name: "runners.dashboard",
    arguments: {},
  });
  if (dashboard.isError || dashboard.structuredContent?.page !== "dashboard") {
    throw new Error("Dashboard tool returned an invalid result.");
  }

  const resources = await client.listResources();
  const resource = resources.resources.find(
    (item) => item.uri === "ui://codex-runners/dashboard-v1",
  );
  if (!resource) throw new Error("MCP App resource is missing.");
  const app = await client.readResource({ uri: resource.uri });
  const html = app.contents[0];
  if (!("text" in html) || !html.text.includes("Codex Runners")) {
    throw new Error("MCP App HTML is invalid.");
  }
} finally {
  await client.close();
  await rm(dataDirectory, { recursive: true, force: true });
}
