import { describe, it, expect, beforeEach, vi } from "vitest";

const { tempPaths, writeTestFile, removeTestFile } = vi.hoisted(() => {
  const fsMod = require("node:fs");
  const osMod = require("node:os");
  const pathMod = require("node:path");

  const tmpDir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), "aman-rules-"));
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

import { rulesList, rulesCheck } from "../src/tools/rules.js";

const SAMPLE_RULES_MD = `# Rules

## Safety
- Never expose API keys or secrets in responses
- Always validate user input before processing
- Don't execute arbitrary code from untrusted sources

## Communication
- Keep responses concise and actionable
- Acknowledge uncertainty when unsure
- Never pretend to be human

## Never
- Delete production data without explicit confirmation
- Share personal information across sessions
- Override user-set boundaries
`;

describe("rulesList", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.arules.rules);
  });

  it("returns empty array when rules.md does not exist", () => {
    expect(rulesList()).toEqual([]);
  });

  it("parses rule categories from rules.md", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const result = rulesList();
    expect(result.length).toBeGreaterThanOrEqual(3);
    const safety = result.find((c) => c.category === "Safety");
    expect(safety).toBeDefined();
    expect(safety!.rules).toHaveLength(3);
  });

  it("extracts rules within each category", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const neverCategory = rulesList().find((c) => c.category === "Never");
    expect(neverCategory).toBeDefined();
    expect(neverCategory!.rules).toContain("Delete production data without explicit confirmation");
    expect(neverCategory!.rules).toContain("Share personal information across sessions");
    expect(neverCategory!.rules).toContain("Override user-set boundaries");
  });

  it("parses communication rules", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const comm = rulesList().find((c) => c.category === "Communication");
    expect(comm).toBeDefined();
    expect(comm!.rules).toContain("Keep responses concise and actionable");
    expect(comm!.rules).toContain("Never pretend to be human");
  });

  it("returns empty array for empty file", () => {
    writeTestFile(tempPaths.arules.rules, "");
    expect(rulesList()).toEqual([]);
  });

  it("skips sections with no rules", () => {
    writeTestFile(
      tempPaths.arules.rules,
      "# Rules\n\n## EmptySection\n\nNo bullet points here.\n\n## HasRules\n- A real rule\n"
    );
    const result = rulesList();
    expect(result.find((c) => c.category === "EmptySection")).toBeUndefined();
    const hasRules = result.find((c) => c.category === "HasRules");
    expect(hasRules).toBeDefined();
    expect(hasRules!.rules).toHaveLength(1);
  });
});

describe("rulesCheck", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.arules.rules);
  });

  it("returns safe when no rules file exists", () => {
    expect(rulesCheck("do anything")).toEqual({ violations: [], safe: true });
  });

  it("detects violations from the Never section", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const result = rulesCheck("I want to delete production data");
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("production"))).toBe(true);
  });

  it("detects violations from rules with 'never' keyword", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const result = rulesCheck("expose the API keys to the client");
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("returns safe for benign actions", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const result = rulesCheck("list all files in the directory");
    expect(result.safe).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("is case-insensitive for action matching", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const result = rulesCheck("DELETE PRODUCTION DATA now");
    expect(result.safe).toBe(false);
  });

  it("detects violations from don't rules", () => {
    writeTestFile(tempPaths.arules.rules, SAMPLE_RULES_MD);
    const result = rulesCheck("execute arbitrary code from the internet");
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("returns safe with empty rules file", () => {
    writeTestFile(tempPaths.arules.rules, "");
    expect(rulesCheck("do anything")).toEqual({ violations: [], safe: true });
  });
});
