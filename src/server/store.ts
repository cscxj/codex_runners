import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  defaultSettings,
  pipelineEventSchema,
  pipelineSchema,
  settingsSchema,
  type Pipeline,
  type PipelineEvent,
  type Settings,
} from "../shared/contracts.js";
import { z } from "zod";

const runtimeStateSchema = z.object({
  initialized: z.boolean().default(false),
  pipelines: z.record(z.string(), pipelineSchema).default({}),
  events: z.array(pipelineEventSchema).max(200).default([]),
  refreshedAt: z.string().nullable().default(null),
});
export type RuntimeState = z.infer<typeof runtimeStateSchema>;

export interface DataStore {
  readSettings(): Promise<Settings>;
  writeSettings(settings: Settings): Promise<Settings>;
  readState(): Promise<RuntimeState>;
  writeState(state: RuntimeState): Promise<RuntimeState>;
}

export class FileDataStore implements DataStore {
  private readonly settingsPath: string;
  private readonly statePath: string;

  constructor(dataDirectory = resolveDataDirectory()) {
    this.settingsPath = join(dataDirectory, "settings.json");
    this.statePath = join(dataDirectory, "state.json");
  }

  async readSettings(): Promise<Settings> {
    return this.readJson(this.settingsPath, settingsSchema, defaultSettings);
  }

  async writeSettings(settings: Settings): Promise<Settings> {
    const parsed = settingsSchema.parse(settings);
    await this.writeJson(this.settingsPath, parsed);
    return parsed;
  }

  async readState(): Promise<RuntimeState> {
    return this.readJson(this.statePath, runtimeStateSchema, {
      initialized: false,
      pipelines: {},
      events: [],
      refreshedAt: null,
    });
  }

  async writeState(state: RuntimeState): Promise<RuntimeState> {
    const parsed = runtimeStateSchema.parse(state);
    await this.writeJson(this.statePath, parsed);
    return parsed;
  }

  private async readJson<T>(
    filePath: string,
    schema: z.ZodType<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return schema.parse(JSON.parse(await readFile(filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw new Error(`Invalid local data in ${filePath}.`, { cause: error });
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
  }
}

export class MemoryDataStore implements DataStore {
  constructor(
    private settings: Settings = defaultSettings,
    private state: RuntimeState = {
      initialized: false,
      pipelines: {},
      events: [],
      refreshedAt: null,
    },
  ) {}

  async readSettings(): Promise<Settings> {
    return structuredClone(this.settings);
  }

  async writeSettings(settings: Settings): Promise<Settings> {
    this.settings = settingsSchema.parse(structuredClone(settings));
    return this.readSettings();
  }

  async readState(): Promise<RuntimeState> {
    return structuredClone(this.state);
  }

  async writeState(state: RuntimeState): Promise<RuntimeState> {
    this.state = runtimeStateSchema.parse(structuredClone(state));
    return this.readState();
  }
}

export function resolveDataDirectory(): string {
  if (process.env.PLUGIN_DATA) return process.env.PLUGIN_DATA;
  if (process.env.CODEX_RUNNERS_DATA_DIR)
    return process.env.CODEX_RUNNERS_DATA_DIR;
  return join(homedir(), ".local", "share", "codex-runners");
}

export function pipelineRecord(
  pipelines: Pipeline[],
): Record<string, Pipeline> {
  return Object.fromEntries(
    pipelines.map((pipeline) => [
      `${pipeline.repositoryId}:${pipeline.id}`,
      pipeline,
    ]),
  );
}

export function unreadEvents(events: PipelineEvent[]): PipelineEvent[] {
  return events.filter((event) => !event.read);
}
