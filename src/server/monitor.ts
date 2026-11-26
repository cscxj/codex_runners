import { randomUUID } from "node:crypto";
import {
  isActiveStatus,
  isNotifiableStatus,
  type Dashboard,
  type Pipeline,
  type PipelineEvent,
  type RepositoryConfig,
  type RepositoryResult,
  type Settings,
} from "../shared/contracts.js";
import type { Notify } from "./notifier.js";
import { notifySystem } from "./notifier.js";
import type { DataStore, RuntimeState } from "./store.js";
import { pipelineRecord, unreadEvents } from "./store.js";
import { listPipelines as fetchPipelines } from "./providers/index.js";

export type PipelineLoader = (
  repository: RepositoryConfig,
) => Promise<Pipeline[]>;

export class PipelineMonitor {
  private timer: NodeJS.Timeout | undefined;
  private currentRefresh: Promise<Dashboard> | undefined;
  private repositoryResults = new Map<string, RepositoryResult>();

  constructor(
    private readonly store: DataStore,
    private readonly loadPipelines: PipelineLoader = fetchPipelines,
    private readonly notify: Notify = notifySystem,
  ) {}

  async start(): Promise<void> {
    await this.refresh();
    await this.schedule();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  async reschedule(): Promise<void> {
    this.stop();
    await this.schedule();
  }

  async refresh(): Promise<Dashboard> {
    if (this.currentRefresh) return this.currentRefresh;
    this.currentRefresh = this.performRefresh().finally(() => {
      this.currentRefresh = undefined;
    });
    return this.currentRefresh;
  }

  async dashboard(): Promise<Dashboard> {
    const [settings, state] = await Promise.all([
      this.store.readSettings(),
      this.store.readState(),
    ]);
    return this.toDashboard(settings, state);
  }

  async markEventsRead(): Promise<Dashboard> {
    const state = await this.store.readState();
    state.events = state.events.map((event) => ({ ...event, read: true }));
    await this.store.writeState(state);
    return this.dashboard();
  }

  private async performRefresh(): Promise<Dashboard> {
    const [settings, previousState] = await Promise.all([
      this.store.readSettings(),
      this.store.readState(),
    ]);
    const repositories = settings.repositories.filter((item) => item.enabled);
    const results = await Promise.all(
      repositories.map(async (repository): Promise<RepositoryResult> => {
        try {
          const pipelines = await this.loadPipelines(repository);
          return { repository, pipelines, error: null };
        } catch (error) {
          return {
            repository,
            pipelines: Object.values(previousState.pipelines).filter(
              (pipeline) => pipeline.repositoryId === repository.id,
            ),
            error: error instanceof Error ? error.message : "Refresh failed.",
          };
        }
      }),
    );
    this.repositoryResults = new Map(
      results.map((result) => [result.repository.id, result]),
    );

    const successfulPipelines = results
      .filter((result) => result.error === null)
      .flatMap((result) => result.pipelines);
    const nextPipelines = pipelineRecord(successfulPipelines);
    const events = previousState.initialized
      ? this.detectEvents(previousState, nextPipelines)
      : [];
    const failedRepositoryIds = new Set(
      results
        .filter((result) => result.error !== null)
        .map((result) => result.repository.id),
    );
    const preservedPipelines = Object.fromEntries(
      Object.entries(previousState.pipelines).filter(([, pipeline]) =>
        failedRepositoryIds.has(pipeline.repositoryId),
      ),
    );
    const nextState: RuntimeState = {
      initialized: true,
      pipelines: {
        ...preservedPipelines,
        ...nextPipelines,
      },
      events: [...events, ...previousState.events].slice(0, 200),
      refreshedAt: new Date().toISOString(),
    };
    await this.store.writeState(nextState);
    await this.sendNotifications(settings, events);
    return this.toDashboard(settings, nextState);
  }

  private detectEvents(
    previousState: RuntimeState,
    nextPipelines: Record<string, Pipeline>,
  ): PipelineEvent[] {
    const events: PipelineEvent[] = [];
    for (const [key, pipeline] of Object.entries(nextPipelines)) {
      const previous = previousState.pipelines[key];
      if (
        previous &&
        isActiveStatus(previous.status) &&
        isNotifiableStatus(pipeline.status)
      ) {
        events.push({
          id: randomUUID(),
          repositoryId: pipeline.repositoryId,
          pipelineId: pipeline.id,
          pipelineName: pipeline.name,
          status: pipeline.status,
          webUrl: pipeline.webUrl,
          occurredAt: pipeline.completedAt ?? pipeline.updatedAt,
          read: false,
        });
      }
    }
    return events;
  }

  private async sendNotifications(
    settings: Settings,
    events: PipelineEvent[],
  ): Promise<void> {
    await Promise.all(
      events
        .filter(
          (event) =>
            (event.status === "success" && settings.notifyOnSuccess) ||
            (event.status !== "success" && settings.notifyOnFailure),
        )
        .map((event) =>
          this.notify(
            "Codex Runners",
            `${event.pipelineName} ${event.status === "success" ? "completed" : event.status}.`,
          ),
        ),
    );
  }

  private toDashboard(settings: Settings, state: RuntimeState): Dashboard {
    const repositories = settings.repositories
      .filter((item) => item.enabled)
      .map(
        (repository): RepositoryResult =>
          this.repositoryResults.get(repository.id) ?? {
            repository,
            pipelines: Object.values(state.pipelines).filter(
              (pipeline) => pipeline.repositoryId === repository.id,
            ),
            error: null,
          },
      );
    return {
      repositories,
      events: state.events,
      unreadCount: unreadEvents(state.events).length,
      refreshedAt: state.refreshedAt,
    };
  }

  private async schedule(): Promise<void> {
    const settings = await this.store.readSettings();
    this.timer = setTimeout(async () => {
      try {
        await this.refresh();
      } finally {
        await this.schedule();
      }
    }, settings.refreshIntervalSeconds * 1_000);
    this.timer.unref();
  }
}
