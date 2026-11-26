# Contributing

Use Node.js 22 or newer and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm check
```

Keep provider operations read-only. Add tests for status mapping, error handling, and state transitions. Never commit credentials, private hostnames, private repository identifiers, captured API payloads, or local plugin data.

Update `dist/` with `pnpm build` when source changes. Use Conventional Commits for commit messages.
