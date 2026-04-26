import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";

const { tempPaths, writeTestFile, removeTestFile } = vi.hoisted(() => {
  const fsMod = require("node:fs");
  const osMod = require("node:os");
  const pathMod = require("node:path");

  const tmpDir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), "aman-eval-"));
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
  const pathMod = require("node:path");
  return {
    paths: tempPaths,
    readFileOr(filePath: string, fallback: string): string {
      try { return fsMod.readFileSync(filePath, "utf-8"); } catch { return fallback; }
    },
    writeFile(filePath: string, content: string): void {
      const dir = pathMod.dirname(filePath);
      if (!fsMod.existsSync(dir)) fsMod.mkdirSync(dir, { recursive: true });
      fsMod.writeFileSync(filePath, content, "utf-8");
    },
  };
});

import { evalStatus, evalLog } from "../src/tools/eval.js";

const SAMPLE_EVAL_MD = `# Evaluation Log

- Last updated: 2025-06-15
- Trust Level: 4
- Trajectory: building

### Session 2025-06-14
- Rating: great
- Highlights: Excellent debugging session
- Improvements: Could explain more

### Session 2025-06-15
- Rating: good
- Highlights: Productive code review
- Improvements: Slow on initial response
`;

describe("evalStatus", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.aeval.eval);
  });

  it("returns defaults when eval.md does not exist", () => {
    expect(evalStatus()).toEqual({
      totalSessions: 0,
      trustLevel: "unknown",
      trajectory: "unknown",
      recentRatings: [],
      lastSession: "never",
    });
  });

  it("parses session count correctly", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    expect(evalStatus().totalSessions).toBe(2);
  });

  it("parses trust level", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    expect(evalStatus().trustLevel).toBe("4");
  });

  it("parses trajectory", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    expect(evalStatus().trajectory).toBe("building");
  });

  it("collects recent ratings", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    expect(evalStatus().recentRatings).toEqual(["great", "good"]);
  });

  it("parses last updated date", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    expect(evalStatus().lastSession).toBe("2025-06-15");
  });

  it("limits recent ratings to last 5", () => {
    const manySessionsContent =
      `# Evaluation Log\n\n- Last updated: 2025-06-20\n` +
      Array.from({ length: 8 }, (_, i) =>
        `\n### Session 2025-06-${(10 + i).toString().padStart(2, "0")}\n- Rating: ${
          ["great", "good", "okay", "frustrating", "great", "good", "okay", "great"][i]
        }\n- Highlights: session ${i + 1}\n- Improvements: none\n`
      ).join("");

    writeTestFile(tempPaths.aeval.eval, manySessionsContent);
    const result = evalStatus();
    expect(result.totalSessions).toBe(8);
    expect(result.recentRatings).toHaveLength(5);
  });

  it("handles eval.md with no sessions", () => {
    writeTestFile(
      tempPaths.aeval.eval,
      "# Evaluation Log\n\n- Last updated: 2025-01-01\n- Trust Level: 3\n- Trajectory: stable\n"
    );
    const result = evalStatus();
    expect(result.totalSessions).toBe(0);
    expect(result.trustLevel).toBe("3");
    expect(result.recentRatings).toEqual([]);
  });

  it("parses Format B (AI Relationship Metrics layout): case-insensitive Trust level + falls back to last Session header for lastSession", () => {
    // Format B is what the /eval skill writes on bootstrap. It uses lowercase
    // "Trust level" and has no "Last updated:" field. evalStatus must still
    // surface meaningful values when reading these files.
    const formatB = `# AI Relationship Metrics

## Overview
- Sessions: 0
- First session: 2026-04-22
- Trust level: 3/5
- Trajectory: building

## Timeline

## Milestones

## Patterns

### Session 2026-04-25
- Rating: good
- Highlights: Productive session
- Improvements: None
`;
    writeTestFile(tempPaths.aeval.eval, formatB);
    const result = evalStatus();
    expect(result.totalSessions).toBe(1);
    expect(result.trustLevel).toBe("3/5");
    expect(result.trajectory).toBe("building");
    expect(result.lastSession).toBe("2026-04-25");
    expect(result.recentRatings).toEqual(["good"]);
  });
});

describe("evalLog", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.aeval.eval);
  });

  it("creates eval.md if it does not exist", () => {
    const result = evalLog("great", "Good session", "Nothing major");

    expect(result).toContain("Session logged");
    expect(result).toContain("great");

    const content = fs.readFileSync(tempPaths.aeval.eval, "utf-8");
    expect(content).toContain("# Evaluation Log");
    expect(content).toContain("- Rating: great");
    expect(content).toContain("- Highlights: Good session");
    expect(content).toContain("- Improvements: Nothing major");
  });

  it("appends to existing eval.md", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    evalLog("frustrating", "Tried hard", "Need more patience");

    const content = fs.readFileSync(tempPaths.aeval.eval, "utf-8");
    expect(content).toContain("Rating: great");
    expect(content).toContain("Rating: good");
    expect(content).toContain("Rating: frustrating");
    expect(content).toContain("Highlights: Tried hard");
    expect(content).toContain("Improvements: Need more patience");
  });

  it("updates the Last updated date", () => {
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    evalLog("okay", "Average session", "Be more proactive");

    const content = fs.readFileSync(tempPaths.aeval.eval, "utf-8");
    const today = new Date().toISOString().split("T")[0];
    expect(content).toContain(`- Last updated: ${today}`);
    expect(content).not.toContain("- Last updated: 2025-06-15");
  });

  it("returns confirmation message with date and rating", () => {
    const result = evalLog("good", "highlights", "improvements");
    const today = new Date().toISOString().split("T")[0];
    expect(result).toBe(`Session logged (${today}): good`);
  });

  it("handles multiple sequential logs", () => {
    evalLog("great", "First session", "None");
    evalLog("good", "Second session", "Minor");
    evalLog("okay", "Third session", "Some issues");

    const content = fs.readFileSync(tempPaths.aeval.eval, "utf-8");
    expect(content).toContain("Rating: great");
    expect(content).toContain("Rating: good");
    expect(content).toContain("Rating: okay");
    expect(content).toContain("Highlights: First session");
    expect(content).toContain("Highlights: Second session");
    expect(content).toContain("Highlights: Third session");
  });

  it("updates Format B Overview Sessions count when appending", () => {
    // Format B (written by /eval skill bootstrap) has a `## Overview` block
    // with `- Sessions:` that must stay in sync with the appended `### Session`
    // entries. Pre-fix, evalLog only touched Format A's `Last updated:` line,
    // leaving Format B's Sessions count stuck at its bootstrap value.
    const formatB = `# AI Relationship Metrics

## Overview
- Sessions: 0
- First session: 2026-04-22
- Trust level: 3/5
- Trajectory: building

## Timeline

## Milestones

## Patterns

### Session 2026-04-25
- Rating: good
- Highlights: First
- Improvements: None
`;
    writeTestFile(tempPaths.aeval.eval, formatB);
    evalLog("good", "Second", "Better");

    const content = fs.readFileSync(tempPaths.aeval.eval, "utf-8");
    expect(content).toContain("- Sessions: 2");
    expect(content).not.toContain("- Sessions: 0");
    // Bootstrap fields should be preserved untouched
    expect(content).toContain("- First session: 2026-04-22");
    expect(content).toContain("- Trust level: 3/5");
    expect(content).toContain("- Trajectory: building");
  });

  it("does not introduce a Sessions line into Format A files", () => {
    // Format A has no `- Sessions:` field; the new write logic must be a
    // no-op there (only the Last updated line should change).
    writeTestFile(tempPaths.aeval.eval, SAMPLE_EVAL_MD);
    evalLog("okay", "Average", "Tweak");

    const content = fs.readFileSync(tempPaths.aeval.eval, "utf-8");
    expect(content).not.toContain("- Sessions:");
    const today = new Date().toISOString().split("T")[0];
    expect(content).toContain(`- Last updated: ${today}`);
  });
});
