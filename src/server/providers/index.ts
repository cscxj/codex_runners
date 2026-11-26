import type { Pipeline, RepositoryConfig } from "../../shared/contracts.js";
import { listGitHubPipelines } from "./github.js";
import { listGitLabPipelines } from "./gitlab.js";

export async function listPipelines(
  repository: RepositoryConfig,
): Promise<Pipeline[]> {
  return repository.provider === "github"
    ? listGitHubPipelines(repository)
    : listGitLabPipelines(repository);
}
