import { describe, it, expect, beforeEach, vi } from "vitest";

const { tempPaths, writeTestFile, removeTestFile } = vi.hoisted(() => {
  const fsMod = require("node:fs");
  const osMod = require("node:os");
  const pathMod = require("node:path");

  const tmpDir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), "aman-wf-"));
  const p = {
    acore: { dir: pathMod.join(tmpDir, ".acore"), core: pathMod.join(tmpDir, ".acore", "core.md") },
    akit: { dir: pathMod.join(tmpDir, ".akit"), kit: pathMod.join(tmpDir, ".akit", "kit.md"), installed: pathMod.join(tmpDir, ".akit", "installed.json") },
    aflow: { dir: pathMod.join(tmpDir, ".aflow"), flow: pathMod.join(tmpDir, ".aflow", "flow.md") },
    arules: { dir: pathMod.join(tmpDir, ".arules"), rules: pathMod.join(tmpDir, ".arules", "rules.md") },
    aeval: { dir: pathMod.join(tmpDir, ".aeval"), eval: pathMod.join(tmpDir, ".aeval", "eval.md") },
  };
  for (const layer of Object.values(p)) {
    fsMod.mkdirSync((layer as any).dir, { recursive: true });
  }
  return {
    tempPaths: p,
    writeTestFile(filePath: string, content: string) {
      const dir = pathMod.dirname(filePath);
      if (!fsMod.existsSync(dir)) fsMod.mkdirSync(dir, { recursive: true });
      fsMod.writeFileSync(filePath, content, "utf-8");
    },
    removeTestFile(filePath: string) {
      try { fsMod.unlinkSync(filePath); } catch {}
    },
  };
});

vi.mock("../src/lib/paths.js", () => {
  const fsMod = require("node:fs");
  return {
    paths: tempPaths,
    readFileOr(filePath: string, fallback: string): string {
      try { return fsMod.readFileSync(filePath, "utf-8"); } catch { return fallback; }
    },
  };
});

import { workflowList, workflowGet } from "../src/tools/workflows.js";

const SAMPLE_FLOW_MD = `# Workflows

## Code Review

Review code changes thoroughly before merging.

1. Read the diff carefully
2. Check for security issues
3. Verify test coverage
4. Approve or request changes

## Deploy to Production

Steps for a safe production deployment.

1. Run full test suite
2. Build production artifacts
3. Deploy to staging first
4. Smoke test staging
5. Deploy to production

## Bug Triage

Process for handling incoming bug reports.

- [x] Reproduce the bug
- [ ] Assess severity
- [ ] Assign to team member
- [ ] Set priority label
`;

describe("workflowList", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.aflow.flow);
  });

  it("returns empty array when flow.md does not exist", () => {
    expect(workflowList()).toEqual([]);
  });

  it("parses workflows from flow.md", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const result = workflowList();
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("parses numbered steps correctly", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const codeReview = workflowList().find((w) => w.name === "Code Review");
    expect(codeReview).toBeDefined();
    expect(codeReview!.steps).toHaveLength(4);
    expect(codeReview!.steps[0]).toBe("Read the diff carefully");
    expect(codeReview!.steps[3]).toBe("Approve or request changes");
  });

  it("parses checklist steps correctly", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const bugTriage = workflowList().find((w) => w.name === "Bug Triage");
    expect(bugTriage).toBeDefined();
    expect(bugTriage!.steps.length).toBeGreaterThanOrEqual(4);
    expect(bugTriage!.steps[0]).toBe("Reproduce the bug");
  });

  it("captures description text", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const deploy = workflowList().find((w) => w.name === "Deploy to Production");
    expect(deploy).toBeDefined();
    expect(deploy!.description).toContain("safe production deployment");
  });

  it("returns empty array for empty file", () => {
    writeTestFile(tempPaths.aflow.flow, "");
    expect(workflowList()).toEqual([]);
  });
});

describe("workflowGet", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.aflow.flow);
  });

  it("returns null when flow.md does not exist", () => {
    expect(workflowGet("anything")).toBeNull();
  });

  it("finds workflow by exact name (case-insensitive)", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const result = workflowGet("code review");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Code Review");
  });

  it("finds workflow by partial name", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const result = workflowGet("deploy");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Deploy to Production");
  });

  it("returns null for non-existent workflow", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    expect(workflowGet("nonexistent workflow")).toBeNull();
  });

  it("prefers exact match over partial match", () => {
    writeTestFile(tempPaths.aflow.flow, SAMPLE_FLOW_MD);
    const result = workflowGet("bug triage");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bug Triage");
  });
});
