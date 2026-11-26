# Releasing

## Validation

Run:

```bash
pnpm install --frozen-lockfile
pnpm check
git diff --check
```

Test a clean marketplace installation in the supported Codex desktop version. Verify GitHub and GitLab public-repository access, settings persistence, direct links, a simulated running-to-success transition, and a simulated running-to-failure transition.

## Versioning

Update the version consistently in `package.json`, `plugin.json`, `.codex-plugin/plugin.json`, and the MCP server/app declarations. Rebuild `dist/` and commit the result.

Create an annotated `vX.Y.Z` tag only after the release commit is on `main`. The release workflow validates the repository, packages the installable files, generates checksums and an SBOM, then creates a GitHub Release.

## OpenAI Plugins Directory

The GitHub release is independent of OpenAI's universal Plugins Directory. Desktop-only local MCP submission requires an allowlisted OpenAI organization. Do not submit or publish through the OpenAI portal until the organization is approved and the release artifact has passed a clean installation test.
