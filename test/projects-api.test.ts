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
