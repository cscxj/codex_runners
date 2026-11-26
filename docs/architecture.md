# Architecture

## Runtime

Codex loads `dist/server.js` as a local stdio MCP server. The server registers one global MCP App entrypoint and exposes read-only provider tools plus local settings tools. The app UI is bundled into `dist/app.html` and returned as an MCP resource.

```text
Codex desktop
  ├─ sidebar MCP App iframe
  └─ local stdio MCP server
       ├─ settings/state files in PLUGIN_DATA
       ├─ GitHub Actions REST API
       ├─ GitLab Pipelines REST API
       └─ operating-system notifications
```

The browser component never receives provider credentials. It calls MCP tools and renders normalized data.

## Provider boundary

Both providers return the shared `Pipeline` contract. Provider-specific statuses are normalized into `queued`, `running`, `success`, `failed`, `cancelled`, `skipped`, or `unknown`.

The monitor compares each successful refresh with the persisted previous state. Only a transition from an active status to a notifiable terminal status creates an event. Failed repository refreshes remain isolated and do not erase the last successful state.

## Notification boundary

The public MCP extension specification does not expose a native global-entrypoint badge. The UI renders its own unread indicator. The local server uses best-effort system notifications while it is running.

## Trust boundary

Repository configuration is untrusted input. Schemas bound string lengths and validate URLs. GitLab credentials in URLs are rejected. Provider requests have timeouts and bounded retries. The plugin has no pipeline mutation tools.
