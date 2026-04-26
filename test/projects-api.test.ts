import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  addProject,
  getProject,
  listProjects,
  activeProject,
  loadProject,
  touchProject,
  saveSession,
  closeProject,
  updateProject,
  listProjectsBrief,
} from "../src/lib/projects/api.js";

const TEST_SCOPE = "test:projects";

function tmpHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aman-projects-test-"));
}

let originalEnv: string | undefined;
let tmp: string;

beforeEach(() => {
  tmp = tmpHome();
  originalEnv = process.env.AMAN_PROJECTS_HOME;
  process.env.AMAN_PROJECTS_HOME = path.join(tmp, ".aprojects");
  fs.mkdirSync(process.env.AMAN_PROJECTS_HOME, { recursive: true });
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.AMAN_PROJECTS_HOME;
  else process.env.AMAN_PROJECTS_HOME = originalEnv;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("addProject", () => {
  it("creates a new active project at position #1 with auto id and timestamps", async () => {
    const p = await addProject(
      { name: "Phase 1.5 substrate" },
      TEST_SCOPE,
    );
    expect(p.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(p.name).toBe("Phase 1.5 substrate");
    expect(p.status).toBe("active");
    expect(p.inActiveList).toBe(true);
    expect(p.position).toBe(1);
    expect(p.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.lastTouchedAt).toBe(p.createdAt);
    expect(p.sessionLog).toBe("");
  });

  it("shifts existing projects down when a new one is added", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    const b = await addProject({ name: "beta" }, TEST_SCOPE);
    const c = await addProject({ name: "gamma" }, TEST_SCOPE);

    const fetchedA = await getProject(a.id, TEST_SCOPE);
    const fetchedB = await getProject(b.id, TEST_SCOPE);
    const fetchedC = await getProject(c.id, TEST_SCOPE);

    expect(fetchedC?.position).toBe(1);
    expect(fetchedB?.position).toBe(2);
    expect(fetchedA?.position).toBe(3);
  });

  it("evicts the position-10 project when the 11th is added", async () => {
    const created: { id: string; name: string }[] = [];
    for (let i = 1; i <= 11; i++) {
      const p = await addProject({ name: `project-${i}` }, TEST_SCOPE);
      created.push({ id: p.id, name: p.name });
    }
    // The first one created (project-1) was at #10 before the 11th add;
    // adding project-11 pushes project-1 out of the active list.
    const evicted = await getProject(created[0].id, TEST_SCOPE);
    expect(evicted?.inActiveList).toBe(false);
    expect(evicted?.position).toBeUndefined();
    expect(evicted?.lruEvictedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(evicted?.status).toBe("active"); // Still active lifecycle, just off-list

    const newest = await getProject(created[10].id, TEST_SCOPE);
    expect(newest?.position).toBe(1);
  });

  it("rejects duplicate names (case-insensitive) with a clear error", async () => {
    await addProject({ name: "Alpha" }, TEST_SCOPE);
    await expect(
      addProject({ name: "alpha" }, TEST_SCOPE),
    ).rejects.toThrow(/already exists/i);
  });
});

describe("listProjects", () => {
  it("returns all active in-list projects by default", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    const b = await addProject({ name: "beta" }, TEST_SCOPE);
    const list = await listProjects({}, TEST_SCOPE);
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("filters by status", async () => {
    await addProject({ name: "alpha" }, TEST_SCOPE);
    const b = await addProject({ name: "beta" }, TEST_SCOPE);
    await closeProject(b.id, "complete", "done", TEST_SCOPE);
    const active = await listProjects({ status: "active" }, TEST_SCOPE);
    expect(active.map((p) => p.name)).toEqual(["alpha"]);
    const complete = await listProjects(
      { status: "complete" },
      TEST_SCOPE,
    );
    expect(complete.map((p) => p.name)).toEqual(["beta"]);
  });

  it("filters by inActiveList=false", async () => {
    for (let i = 1; i <= 11; i++) {
      await addProject({ name: `project-${i}` }, TEST_SCOPE);
    }
    const offList = await listProjects(
      { inActiveList: false },
      TEST_SCOPE,
    );
    expect(offList).toHaveLength(1); // The evicted one
    expect(offList[0].name).toBe("project-1");
  });
});

describe("activeProject", () => {
  it("returns null when no projects exist", async () => {
    expect(await activeProject(TEST_SCOPE)).toBeNull();
  });

  it("returns the position-1 project after creation", async () => {
    await addProject({ name: "alpha" }, TEST_SCOPE);
    const beta = await addProject({ name: "beta" }, TEST_SCOPE);
    const active = await activeProject(TEST_SCOPE);
    expect(active?.id).toBe(beta.id);
    expect(active?.position).toBe(1);
  });
});

describe("loadProject", () => {
  it("brings an off-list project back to position #1 (restoration)", async () => {
    // Create 11 → first one gets evicted
    const ids: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const p = await addProject({ name: `project-${i}` }, TEST_SCOPE);
      ids.push(p.id);
    }
    const result = await loadProject("project-1", TEST_SCOPE);
    expect(result.match?.id).toBe(ids[0]);
    expect(result.match?.inActiveList).toBe(true);
    expect(result.match?.position).toBe(1);
    expect(result.candidates).toEqual([]);
  });

  it("returns the candidate list when fuzzy match is ambiguous", async () => {
    await addProject({ name: "phase 1.5 substrate" }, TEST_SCOPE);
    await addProject({ name: "phase 2 distribution" }, TEST_SCOPE);
    const result = await loadProject("phase", TEST_SCOPE);
    expect(result.match).toBeNull();
    expect(result.candidates).toHaveLength(2);
  });

  it("returns empty candidates when no match", async () => {
    await addProject({ name: "alpha" }, TEST_SCOPE);
    const result = await loadProject("nonexistent", TEST_SCOPE);
    expect(result.match).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("prefers exact name match over substring", async () => {
    const a = await addProject({ name: "phase" }, TEST_SCOPE);
    await addProject({ name: "phase 1.5 substrate" }, TEST_SCOPE);
    const result = await loadProject("phase", TEST_SCOPE);
    expect(result.match?.id).toBe(a.id);
  });
});

describe("touchProject", () => {
  it("bumps an in-list project to #1 and updates lastTouchedAt", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    await addProject({ name: "beta" }, TEST_SCOPE); // beta now at #1
    await new Promise((r) => setTimeout(r, 10));
    const touched = await touchProject(a.id, TEST_SCOPE);
    expect(touched?.position).toBe(1);
    expect(touched?.lastTouchedAt).not.toBe(a.lastTouchedAt);
    const beta = (await listProjects({}, TEST_SCOPE)).find(
      (p) => p.name === "beta",
    );
    expect(beta?.position).toBe(2);
  });

  it("returns null when project is off-list (use loadProject instead)", async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const p = await addProject({ name: `project-${i}` }, TEST_SCOPE);
      ids.push(p.id);
    }
    const result = await touchProject(ids[0], TEST_SCOPE);
    expect(result).toBeNull();
  });
});

describe("saveSession", () => {
  it("appends a timestamped session entry to the project's sessionLog", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    await saveSession(a.id, "closed Bug 4, filed Bug 6", TEST_SCOPE);
    const fetched = await getProject(a.id, TEST_SCOPE);
    expect(fetched?.sessionLog).toContain("closed Bug 4, filed Bug 6");
    expect(fetched?.sessionLog).toMatch(/^### \d{4}-\d{2}-\d{2}/);
  });

  it("appends successive sessions in order", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    await saveSession(a.id, "first note", TEST_SCOPE);
    await saveSession(a.id, "second note", TEST_SCOPE);
    const fetched = await getProject(a.id, TEST_SCOPE);
    const firstIdx = fetched!.sessionLog.indexOf("first note");
    const secondIdx = fetched!.sessionLog.indexOf("second note");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it("returns null for unknown id", async () => {
    expect(await saveSession("01HKQXNOTEXIST00000000000000", "x", TEST_SCOPE)).toBeNull();
  });
});

describe("closeProject", () => {
  it("transitions to complete with closedAt+reason and frees the slot", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    const b = await addProject({ name: "beta" }, TEST_SCOPE);
    const closed = await closeProject(a.id, "complete", "done", TEST_SCOPE);
    expect(closed?.status).toBe("complete");
    expect(closed?.inActiveList).toBe(false);
    expect(closed?.position).toBeUndefined();
    expect(closed?.closedReason).toBe("done");
    expect(closed?.closedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // beta should renumber to position 1
    const fetchedB = await getProject(b.id, TEST_SCOPE);
    expect(fetchedB?.position).toBe(1);
  });

  it("transitions to paused (slot freed but lifecycle not closed)", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    const paused = await closeProject(a.id, "paused", "stepping away", TEST_SCOPE);
    expect(paused?.status).toBe("paused");
    expect(paused?.inActiveList).toBe(false);
  });

  it("transitions to abandoned with reason", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    const abandoned = await closeProject(a.id, "abandoned", "wrong direction", TEST_SCOPE);
    expect(abandoned?.status).toBe("abandoned");
    expect(abandoned?.closedReason).toBe("wrong direction");
  });

  it("returns null for unknown id", async () => {
    expect(
      await closeProject("01HKQXNOTEXIST00000000000000", "complete", "x", TEST_SCOPE),
    ).toBeNull();
  });
});

describe("updateProject", () => {
  it("patches name, niyyah, workspaces, linkedIntentionId", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    await new Promise((r) => setTimeout(r, 10));
    const updated = await updateProject(
      a.id,
      {
        name: "alpha-renamed",
        niyyah: "for clarity",
        workspaces: ["~/x", "~/y"],
        linkedIntentionId: "01KQ3F29B92X3TFNDG30HJR4D1",
      },
      TEST_SCOPE,
    );
    expect(updated?.name).toBe("alpha-renamed");
    expect(updated?.niyyah).toBe("for clarity");
    expect(updated?.workspaces).toEqual(["~/x", "~/y"]);
    expect(updated?.linkedIntentionId).toBe("01KQ3F29B92X3TFNDG30HJR4D1");
    expect(updated?.lastTouchedAt).not.toBe(a.lastTouchedAt);
  });

  it("returns null for unknown id", async () => {
    expect(
      await updateProject(
        "01HKQXNOTEXIST00000000000000",
        { name: "x" },
        TEST_SCOPE,
      ),
    ).toBeNull();
  });
});

describe("listProjectsBrief", () => {
  it("returns project metadata without sessionLog (fast path for hook)", async () => {
    const a = await addProject({ name: "alpha" }, TEST_SCOPE);
    await saveSession(a.id, "lots of session content here", TEST_SCOPE);
    const brief = await listProjectsBrief(TEST_SCOPE);
    expect(brief).toHaveLength(1);
    expect(brief[0].id).toBe(a.id);
    expect(brief[0].name).toBe("alpha");
    expect("sessionLog" in brief[0]).toBe(false);
  });
});
