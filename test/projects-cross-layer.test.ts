import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { addProject, updateProject } from "../src/lib/projects/api.js";
import {
  addIntention,
  updateIntention,
  getIntention,
} from "../src/lib/intentions/api.js";
import { getProject } from "../src/lib/projects/api.js";

const TEST_SCOPE = "test:cross-layer";

let tmp: string;
let originalProjects: string | undefined;
let originalIntentions: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aman-cross-test-"));
  originalProjects = process.env.AMAN_PROJECTS_HOME;
  originalIntentions = process.env.AMAN_INTENTIONS_HOME;
  process.env.AMAN_PROJECTS_HOME = path.join(tmp, ".aprojects");
  process.env.AMAN_INTENTIONS_HOME = path.join(tmp, ".aintentions");
  fs.mkdirSync(process.env.AMAN_PROJECTS_HOME, { recursive: true });
  fs.mkdirSync(process.env.AMAN_INTENTIONS_HOME, { recursive: true });
});

afterEach(() => {
  if (originalProjects === undefined) delete process.env.AMAN_PROJECTS_HOME;
  else process.env.AMAN_PROJECTS_HOME = originalProjects;
  if (originalIntentions === undefined) delete process.env.AMAN_INTENTIONS_HOME;
  else process.env.AMAN_INTENTIONS_HOME = originalIntentions;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("cross-layer link: project ↔ intention", () => {
  it("project_update with linkedIntentionId patches the intention's linkedProjectId", async () => {
    const intent = await addIntention(
      {
        description: "Test intention",
        niyyah: "test",
        successCriteria: "test",
        horizon: "this-week",
      },
      TEST_SCOPE,
    );
    const project = await addProject({ name: "alpha" }, TEST_SCOPE);
    await updateProject(
      project.id,
      { linkedIntentionId: intent.id },
      TEST_SCOPE,
    );
    const refetchedIntent = await getIntention(intent.id, TEST_SCOPE);
    expect(refetchedIntent?.linkedProjectId).toBe(project.id);
  });

  it("intentions_update with linkedProjectId patches the project's linkedIntentionId", async () => {
    const intent = await addIntention(
      {
        description: "Test intention",
        niyyah: "test",
        successCriteria: "test",
        horizon: "this-week",
      },
      TEST_SCOPE,
    );
    const project = await addProject({ name: "alpha" }, TEST_SCOPE);
    await updateIntention(
      intent.id,
      { linkedProjectId: project.id },
      TEST_SCOPE,
    );
    const refetched = await getProject(project.id, TEST_SCOPE);
    expect(refetched?.linkedIntentionId).toBe(intent.id);
  });

  it("project_close does NOT auto-close the linked intention", async () => {
    const intent = await addIntention(
      {
        description: "Test intention",
        niyyah: "test",
        successCriteria: "test",
        horizon: "this-week",
      },
      TEST_SCOPE,
    );
    const project = await addProject(
      { name: "alpha", linkedIntentionId: intent.id },
      TEST_SCOPE,
    );
    const { closeProject } = await import("../src/lib/projects/api.js");
    await closeProject(project.id, "complete", "done", TEST_SCOPE);
    const refetched = await getIntention(intent.id, TEST_SCOPE);
    expect(refetched?.status).toBe("active");
  });
});
