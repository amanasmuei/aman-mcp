import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { tempPaths, writeTestFile, removeTestFile } = vi.hoisted(() => {
  const fsMod = require("node:fs");
  const osMod = require("node:os");
  const pathMod = require("node:path");

  const tmpDir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), "aman-id-"));
  const p = {
    acore: {
      dir: pathMod.join(tmpDir, ".acore"),
      core: pathMod.join(tmpDir, ".acore", "core.md"),
    },
    akit: {
      dir: pathMod.join(tmpDir, ".akit"),
      kit: pathMod.join(tmpDir, ".akit", "kit.md"),
      installed: pathMod.join(tmpDir, ".akit", "installed.json"),
    },
    aflow: {
      dir: pathMod.join(tmpDir, ".aflow"),
      flow: pathMod.join(tmpDir, ".aflow", "flow.md"),
    },
    arules: {
      dir: pathMod.join(tmpDir, ".arules"),
      rules: pathMod.join(tmpDir, ".arules", "rules.md"),
    },
    aeval: {
      dir: pathMod.join(tmpDir, ".aeval"),
      eval: pathMod.join(tmpDir, ".aeval", "eval.md"),
    },
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

import {
  identityRead,
  identitySummary,
  identityUpdateSession,
} from "../src/tools/identity.js";

const SAMPLE_CORE = `# Arienz

## Identity
- Role: Arienz is Aman's Software Engineer
- Personality: direct, challenging, honest
- Communication: push back on weak ideas, ask hard questions
- Values: honesty over comfort

---

## Relationship
- Name: Aman
- Role: Software Engineer
- Communication: concise and direct
- Detail level: balanced

---

## Session
- Last updated: 2025-01-01
- Resume: Working on MCP server tests
- Active topics: testing, CI
- Recent decisions: chose vitest
- Temp notes: [cleared at session end]

---

## Dynamics

### Trust & Rapport
- Level: 4
- Trajectory: building
`;

describe("identityRead", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.acore.core);
  });

  it("returns fallback message when core.md does not exist", () => {
    const result = identityRead();
    expect(result).toBe("No identity configured. Run: npx @aman_asmuei/acore");
  });

  it("returns file content when core.md exists", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    const result = identityRead();
    expect(result).toBe(SAMPLE_CORE);
  });

  it("returns empty string for an empty file", () => {
    writeTestFile(tempPaths.acore.core, "");
    const result = identityRead();
    expect(result).toBe("");
  });
});

describe("identitySummary", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.acore.core);
  });

  it("returns unknown fields when no identity is configured", () => {
    const summary = identitySummary();
    expect(summary).toEqual({
      aiName: "unknown",
      userName: "unknown",
      trustLevel: "unknown",
      personality: "unknown",
      role: "unknown",
    });
  });

  it("parses AI name from top-level heading", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    expect(identitySummary().aiName).toBe("Arienz");
  });

  it("parses user name from Relationship section", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    expect(identitySummary().userName).toBe("Aman");
  });

  it("parses trust level from Dynamics section", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    expect(identitySummary().trustLevel).toBe("4");
  });

  it("parses personality from Identity section", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    expect(identitySummary().personality).toBe("direct, challenging, honest");
  });

  it("parses role from Identity section (first match)", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    expect(identitySummary().role).toBe("Arienz is Aman's Software Engineer");
  });

  it("returns unknown for missing fields", () => {
    writeTestFile(tempPaths.acore.core, "# MyAI\n\nSome content without standard fields");
    const summary = identitySummary();
    expect(summary.aiName).toBe("MyAI");
    expect(summary.userName).toBe("unknown");
    expect(summary.trustLevel).toBe("unknown");
    expect(summary.personality).toBe("unknown");
  });
});

describe("identityUpdateSession", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.acore.core);
  });

  it("returns error when no identity file exists", () => {
    const result = identityUpdateSession("resume", "topics", "decisions");
    expect(result).toBe("No identity configured. Run: npx @aman_asmuei/acore");
  });

  it("returns error when Session section is missing", () => {
    writeTestFile(tempPaths.acore.core, "# MyAI\n\n## Identity\n- Role: helper\n");
    const result = identityUpdateSession("resume", "topics", "decisions");
    expect(result).toBe("Could not find Session section in core.md");
  });

  it("updates Session section with new data", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    const result = identityUpdateSession(
      "Building tests for MCP",
      "vitest setup, coverage",
      "use temp dirs for isolation"
    );

    expect(result).toContain("Session updated");
    expect(result).toContain("Building tests for MCP");

    const updated = fs.readFileSync(tempPaths.acore.core, "utf-8");
    expect(updated).toContain("Building tests for MCP");
    expect(updated).toContain("vitest setup, coverage");
    expect(updated).toContain("use temp dirs for isolation");
    expect(updated).not.toContain("Working on MCP server tests");
  });

  it("preserves content outside the Session section", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    identityUpdateSession("new resume", "new topics", "new decisions");

    const updated = fs.readFileSync(tempPaths.acore.core, "utf-8");
    expect(updated).toContain("# Arienz");
    expect(updated).toContain("- Personality: direct, challenging, honest");
    expect(updated).toContain("- Name: Aman");
    expect(updated).toContain("- Level: 4");
  });

  it("sets the date to today", () => {
    writeTestFile(tempPaths.acore.core, SAMPLE_CORE);
    identityUpdateSession("resume", "topics", "decisions");

    const updated = fs.readFileSync(tempPaths.acore.core, "utf-8");
    const today = new Date().toISOString().split("T")[0];
    expect(updated).toContain(`- Last updated: ${today}`);
  });
});
