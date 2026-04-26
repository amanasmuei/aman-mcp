import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  addIntention,
  getIntention,
  listIntentions,
  updateIntention,
  touchIntention,
} from "../src/lib/intentions/api.js";
import { closeIntention } from "../src/lib/intentions/api.js";
import { reviewIntentions } from "../src/lib/intentions/api.js";
import { intentionsStorage, getOrCreateList } from "../src/lib/intentions/storage.js";

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

describe("intentions api — update/touch", () => {
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

  it("updateIntention() patches description, niyyah, success, horizon", async () => {
    const created = await addIntention(
      { description: "Old", niyyah: "old", successCriteria: "old", horizon: "this-week" },
      TEST_SCOPE,
    );
    const updated = await updateIntention(
      created.id,
      { description: "New", niyyah: "new niyyah", horizon: "this-month" },
      TEST_SCOPE,
    );
    expect(updated).not.toBeNull();
    expect(updated!.description).toBe("New");
    expect(updated!.niyyah).toBe("new niyyah");
    expect(updated!.horizon).toBe("this-month");
    expect(updated!.successCriteria).toBe("old"); // not touched
  });

  it("updateIntention() bumps lastTouchedAt", async () => {
    const created = await addIntention(
      { description: "X", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await new Promise((r) => setTimeout(r, 10));
    const updated = await updateIntention(created.id, { description: "Y" }, TEST_SCOPE);
    expect(updated!.lastTouchedAt).not.toBe(created.lastTouchedAt);
    expect(new Date(updated!.lastTouchedAt).getTime()).toBeGreaterThan(
      new Date(created.lastTouchedAt).getTime(),
    );
  });

  it("updateIntention() returns null for unknown id", async () => {
    const result = await updateIntention(
      "01HKQXNOTEXIST00000000000000",
      { description: "x" },
      TEST_SCOPE,
    );
    expect(result).toBeNull();
  });

  it("touchIntention() bumps lastTouchedAt without changing other fields", async () => {
    const created = await addIntention(
      { description: "X", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await new Promise((r) => setTimeout(r, 10));
    const touched = await touchIntention(created.id, TEST_SCOPE);
    expect(touched).not.toBeNull();
    expect(touched!.description).toBe(created.description);
    expect(touched!.lastTouchedAt).not.toBe(created.lastTouchedAt);
  });
});

describe("intentions api — close", () => {
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

  it("closeIntention('complete') marks intention complete with closedAt and reason", async () => {
    const created = await addIntention(
      { description: "X", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const closed = await closeIntention(
      created.id,
      "complete",
      "shipped",
      TEST_SCOPE,
    );
    expect(closed).not.toBeNull();
    expect(closed!.status).toBe("complete");
    expect(closed!.closedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(closed!.closedReason).toBe("shipped");
  });

  it("closeIntention('abandoned') marks intention abandoned", async () => {
    const created = await addIntention(
      { description: "X", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const closed = await closeIntention(
      created.id,
      "abandoned",
      "lost interest",
      TEST_SCOPE,
    );
    expect(closed!.status).toBe("abandoned");
    expect(closed!.closedReason).toBe("lost interest");
  });

  it("closeIntention() returns null for unknown id", async () => {
    const result = await closeIntention(
      "01HKQXNOTEXIST00000000000000",
      "complete",
      "x",
      TEST_SCOPE,
    );
    expect(result).toBeNull();
  });

  it("after close, listIntentions() default (active) does not include closed", async () => {
    const created = await addIntention(
      { description: "X", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await closeIntention(created.id, "complete", "done", TEST_SCOPE);
    const active = await listIntentions({}, TEST_SCOPE);
    expect(active).toEqual([]);
    const completed = await listIntentions({ status: "complete" }, TEST_SCOPE);
    expect(completed).toHaveLength(1);
  });
});

describe("intentions api — review", () => {
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

  it("reviewIntentions() reports active count and stale count", async () => {
    await addIntention(
      { description: "Fresh", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const result = await reviewIntentions({ staleDays: 7 }, TEST_SCOPE);
    expect(result.active).toBe(1);
    expect(result.stale).toEqual([]);
  });

  it("reviewIntentions() flags intentions not touched within staleDays", async () => {
    const created = await addIntention(
      { description: "Stale", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    // Manipulate stored lastTouchedAt to 30 days ago
    const list = await getOrCreateList(TEST_SCOPE);
    list.intentions[0].lastTouchedAt = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await intentionsStorage().put(TEST_SCOPE, list);

    const result = await reviewIntentions({ staleDays: 7 }, TEST_SCOPE);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].id).toBe(created.id);
  });

  it("reviewIntentions() includes byHorizon counts", async () => {
    await addIntention(
      { description: "W", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await addIntention(
      { description: "M", niyyah: "n", successCriteria: "s", horizon: "this-month" },
      TEST_SCOPE,
    );
    await addIntention(
      { description: "L", niyyah: "n", successCriteria: "s", horizon: "lifelong" },
      TEST_SCOPE,
    );
    const result = await reviewIntentions({ staleDays: 7 }, TEST_SCOPE);
    expect(result.byHorizon["this-week"]).toBe(1);
    expect(result.byHorizon["this-month"]).toBe(1);
    expect(result.byHorizon["lifelong"]).toBe(1);
    expect(result.byHorizon["this-quarter"]).toBe(0);
  });

  it("reviewIntentions() reports complete and abandoned counts", async () => {
    const a = await addIntention(
      { description: "Will complete", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const b = await addIntention(
      { description: "Will abandon", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await addIntention(
      { description: "Stays active", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    await closeIntention(a.id, "complete", "shipped", TEST_SCOPE);
    await closeIntention(b.id, "abandoned", "scope changed", TEST_SCOPE);

    const result = await reviewIntentions({ staleDays: 7 }, TEST_SCOPE);
    expect(result.active).toBe(1);
    expect(result.complete).toBe(1);
    expect(result.abandoned).toBe(1);
  });

  it("reviewIntentions() flags this-week intentions older than 7 days as due", async () => {
    const created = await addIntention(
      { description: "Overdue weekly", niyyah: "n", successCriteria: "s", horizon: "this-week" },
      TEST_SCOPE,
    );
    const list = await getOrCreateList(TEST_SCOPE);
    list.intentions[0].createdAt = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await intentionsStorage().put(TEST_SCOPE, list);

    const result = await reviewIntentions({ staleDays: 30 }, TEST_SCOPE);
    expect(result.due).toHaveLength(1);
    expect(result.due[0].id).toBe(created.id);
  });

  it("reviewIntentions() does not flag lifelong intentions as due", async () => {
    await addIntention(
      { description: "Forever goal", niyyah: "n", successCriteria: "s", horizon: "lifelong" },
      TEST_SCOPE,
    );
    const list = await getOrCreateList(TEST_SCOPE);
    list.intentions[0].createdAt = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await intentionsStorage().put(TEST_SCOPE, list);

    const result = await reviewIntentions({ staleDays: 7 }, TEST_SCOPE);
    expect(result.due).toEqual([]);
  });
});
