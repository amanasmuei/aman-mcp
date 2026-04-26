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
});
