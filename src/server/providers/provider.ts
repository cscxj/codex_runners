import type { Pipeline, RepositoryConfig } from "../../shared/contracts.js";

export interface PipelineProvider {
  listPipelines(repository: RepositoryConfig): Promise<Pipeline[]>;
}
