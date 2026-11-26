# Security Policy

## Supported versions

Security fixes are applied to the latest release.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature for this repository.

Include the affected version, impact, reproduction steps, and any suggested mitigation. Do not include live access tokens or private repository data.

## Security model

- Provider operations are read-only.
- Repository URLs cannot contain credentials.
- GitLab uses HTTPS unless localhost development is explicitly enabled.
- HTTP requests use bounded timeouts and at most two retries.
- Tokens are read from environment variables or authenticated CLI tools and are never persisted by the plugin.
- Tool results do not contain credentials.
