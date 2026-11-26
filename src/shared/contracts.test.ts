import { describe, expect, it } from "vitest";
import {
  isActiveStatus,
  isNotifiableStatus,
  settingsSchema,
} from "./contracts.js";

describe("settingsSchema", () => {
  it("rejects duplicate-free malformed repository data", () => {
    expect(() =>
      settingsSchema.parse({
        repositories: [{ provider: "github", owner: "acme" }],
        refreshIntervalSeconds: 10,
      }),
    ).toThrow();
  });

  it("applies defaults", () => {
    const settings = settingsSchema.parse({});
    expect(settings.refreshIntervalSeconds).toBe(60);
    expect(settings.repositories).toEqual([]);
  });

  it("rejects duplicate repository IDs", () => {
    const repository = {
      id: "same",
      displayName: "Repo",
      enabled: true,
      credentialMode: "anonymous",
      provider: "github",
      owner: "acme",
      repository: "repo",
    } as const;
    expect(() =>
      settingsSchema.parse({ repositories: [repository, repository] }),
    ).toThrow("unique");
  });
});

describe("status helpers", () => {
  it("classifies active and notifiable statuses", () => {
    expect(isActiveStatus("running")).toBe(true);
    expect(isActiveStatus("success")).toBe(false);
    expect(isNotifiableStatus("failed")).toBe(true);
    expect(isNotifiableStatus("skipped")).toBe(false);
  });
});
