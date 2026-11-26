---
name: codex-runners-onboarding
description: Configure Codex Runners after installation by adding read-only GitHub or GitLab repositories and verifying pipeline access.
---

Open the Codex Runners repository settings panel.

Help the user add only repositories they identify. Prefer anonymous access for public repositories. Use existing `gh` or `glab` login only when the user selects CLI authentication; never request a token in chat or place credentials in plugin settings.

Test each configured repository with the read-only connection action. Explain any access or URL error without changing repositories, CI configuration, credentials, or remote resources.

Finish by opening the dashboard and confirming the configured repositories appear. Do not trigger, retry, cancel, or modify pipelines.
