# Codex Runners

Codex Runners is a desktop-only Codex plugin that monitors GitHub Actions and GitLab pipelines from the left sidebar. It runs on your computer, reads pipeline status, opens the provider's native pipeline page, and records unread completion or failure events.

![Codex Runners icon](assets/icon.svg)

## Features

- Global sidebar panel in Codex desktop
- Multiple GitHub and self-hosted GitLab repositories
- Active `queued` and `running` pipeline list
- Completion, failure, and cancellation events
- Panel unread indicator and native desktop notifications
- Direct links to GitHub Actions and GitLab pipeline pages
- Anonymous public-repository access, existing `gh`/`glab` login, or environment tokens
- Local-only settings and state

OpenAI's current MCP extension specification does not expose a native sidebar badge API. Codex Runners therefore displays the blue unread indicator inside its panel and uses desktop notifications while the local MCP server is running.

## Requirements

- ChatGPT desktop app with Codex and Plugin Extensions support
- Node.js 22 or newer
- Optional: authenticated `gh` or `glab` for repositories that require login

The initial compatibility target is macOS 26.5.2 on Apple Silicon with Codex desktop `26.1120.50957`.

## Install from the repository

Build artifacts are committed so the repository can be used directly as a Git-backed marketplace.

```bash
codex plugin marketplace add cscxj/codex_runners --ref main
codex plugin marketplace upgrade codex-runners
```

Restart the ChatGPT desktop app, open the Plugins Directory, select **Codex Runners**, and install it. Start a new local Codex chat after installation.

For local development:

```bash
git clone https://github.com/cscxj/codex_runners.git
cd codex_runners
corepack enable
pnpm install --frozen-lockfile
pnpm check
codex plugin marketplace add .
```

## Configure repositories

Open **Codex Runners → Settings** and add a repository.

GitHub requires `owner` and `repository`. GitLab requires the HTTPS base URL and project path such as `group/project`. An optional branch filter limits displayed pipelines.

Access modes:

- **Public / anonymous**: sends no credential.
- **Use gh or glab login**: uses the existing CLI login. GitHub reads the active `gh` token in memory; GitLab delegates the read-only request to `glab api`. The token is not persisted by Codex Runners.
- **Environment token**: reads `CODEX_RUNNERS_GITHUB_TOKEN` or `CODEX_RUNNERS_GITLAB_TOKEN`, with `GITHUB_TOKEN` and `GITLAB_TOKEN` as fallbacks.

Do not put credentials in repository URLs or plugin settings.

## Runtime behavior

The server polls configured providers every 30–300 seconds. The default is 60 seconds. The first successful refresh establishes a baseline and does not create historical notifications. A later transition from `queued` or `running` to `success`, `failed`, or `cancelled` creates one unread event.

Settings and state are stored under `PLUGIN_DATA` when Codex supplies it. Standalone development falls back to `~/.local/share/codex-runners`. Files are written with owner-only permissions.

The plugin never triggers, retries, cancels, approves, or modifies a pipeline.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

`dist/server.js` and `dist/app.html` are release artifacts. Run `pnpm build:check` before committing source changes to confirm they are current.

Architecture and release details are in [docs/architecture.md](docs/architecture.md) and [docs/releasing.md](docs/releasing.md).

## Public distribution

The repository marketplace and GitHub Releases provide public installation. Listing a local-MCP desktop-only plugin in OpenAI's universal Plugins Directory currently requires partner approval and organization allowlisting. See [OpenAI's desktop-only submission guide](https://developers.openai.com/plugins/deploy/desktop-only).

## Security

Report vulnerabilities according to [SECURITY.md](SECURITY.md). See [PRIVACY.md](PRIVACY.md) for local data handling.

## License

[MIT](LICENSE)
