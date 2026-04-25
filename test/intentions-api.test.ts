import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  addIntention,
  getIntention,
  listIntentions,
} from "../src/lib/intentions/api.js";

const TEST_SCOPE = "test:intentions";

function tmpHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aman-intentions-test-"));
}

describe("intentions api — add/get/list", () => {
  let originalEnv: string | undefined;
  let tmp: string;

  beforeEach(() => {
    tmp = tmpHome();
    originalEnv = process.env.AMAN_INTENTIONS_HOME;
    process.env.AMAN_INTENTIONS_HOME = path.join(tmp, ".aintentions");
    fs.mkdirSync(process.env.AMAN_INTENTIONS_HOME, { recursive: true });
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AMAN_INTENTIONS_HOME;
    else process.env.AMAN_INTENTIONS_HOME = originalEnv;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("addIntention() persists a new active intention with auto id and timestamps", async () => {
    const intent = await addIntention(
      {
        description: "Ship Simi Tracker v2",
        niyyah: "team productivity with adab",
        successCriteria: "deployed + Linear sync",
        horizon: "this-month",
      },
      TEST_SCOPE,
    );
    expect(intent.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(intent.status).toBe("active");
    expect(intent.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(intent.lastTouchedAt).toBe(intent.createdAt);
  });

  it("getIntention() returns the intention by id", async () => {
    const created = await addIntention(
      {
        description: "Read tasawwuf",
        niyyah: "for ihsan",
        successCriteria: "2 books done",
        horizon: "this-quarter",
      },
      TEST_SCOPE,
    );
    const fetched = await getIntention(created.id, TEST_SCOPE);
    expect(fetched).toEqual(created);
  });

  it("getIntention() returns null for unknown id", async () => {
    const result = await getIntention("01HKQXNOTEXIST00000000000000", TEST_SCOPE);
    expect(result).toBeNull();
  });

  it("listIntentions() returns active by default", async () => {
    await addIntention(
      { description: "A", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await addIntention(
      { description: "B", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const list = await listIntentions({}, TEST_SCOPE);
    expect(list).toHaveLength(2);
    expect(list.every((i) => i.status === "active")).toBe(true);
  });

  it("listIntentions({ status }) filters by status — paused returns empty when no paused intentions exist", async () => {
    await addIntention(
      { description: "A", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const paused = await listIntentions({ status: "paused" }, TEST_SCOPE);
    expect(paused).toEqual([]);
  });

  it("listIntentions({ horizon }) filters by horizon", async () => {
    await addIntention(
      { description: "Weekly", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await addIntention(
      { description: "Monthly", niyyah: "n", successCriteria: "s", horizon: "this-month" },
      TEST_SCOPE,
    );
    const weekly = await listIntentions({ horizon: "this-week" }, TEST_SCOPE);
    expect(weekly).toHaveLength(1);
    expect(weekly[0].description).toBe("Weekly");
  });
});
