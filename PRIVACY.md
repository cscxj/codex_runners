# Privacy Policy

Codex Runners runs locally on the user's computer. It sends read-only HTTP requests to the GitHub and GitLab hosts configured by the user.

Repository settings, normalized pipeline status, and unread events are stored locally in the plugin data directory. Codex Runners does not operate a hosted service and does not transmit this data to the plugin developer.

Credentials are not accepted through repository settings. When the user selects CLI authentication, GitHub reads the active `gh` token into process memory and GitLab delegates the read-only request to `glab api`. Environment-token mode reads the documented environment variables. Tokens are not written to Codex Runners data files or tool results.

Removing the plugin does not automatically remove its local data directory. Users may delete the Codex Runners plugin data directory after uninstalling it.
