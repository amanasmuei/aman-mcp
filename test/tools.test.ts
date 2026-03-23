import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";

const { tempPaths, writeTestFile, removeTestFile } = vi.hoisted(() => {
  const fsMod = require("node:fs");
  const osMod = require("node:os");
  const pathMod = require("node:path");

  const tmpDir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), "aman-tools-"));
  const p = {
    acore: { dir: pathMod.join(tmpDir, ".acore"), core: pathMod.join(tmpDir, ".acore", "core.md") },
    akit: {
      dir: pathMod.join(tmpDir, ".akit"),
      kit: pathMod.join(tmpDir, ".akit", "kit.md"),
      installed: pathMod.join(tmpDir, ".akit", "installed.json"),
    },
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

import { toolsList, toolsSearch } from "../src/tools/tools.js";

const SAMPLE_KIT_MD = `# Tools

- **prettier** (MCP) — Code formatter with opinionated defaults
- **eslint** (manual) — JavaScript/TypeScript linter
- **docker** (MCP) — Container management tool
- **ripgrep** — Fast recursive search tool
`;

const SAMPLE_INSTALLED_JSON = JSON.stringify([
  { name: "prettier", type: "MCP", status: "installed", description: "Code formatter" },
  { name: "eslint", type: "manual", status: "installed", description: "JS linter" },
]);

describe("toolsList", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.akit.kit);
    removeTestFile(tempPaths.akit.installed);
  });

  it("returns empty array when no kit files exist", () => {
    expect(toolsList()).toEqual([]);
  });

  it("prefers installed.json when it exists", () => {
    writeTestFile(tempPaths.akit.installed, SAMPLE_INSTALLED_JSON);
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);

    const result = toolsList();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("prettier");
    expect(result[1].name).toBe("eslint");
  });

  it("parses kit.md when installed.json is absent", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);

    const result = toolsList();
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      name: "prettier",
      type: "MCP",
      status: "installed",
      description: "Code formatter with opinionated defaults",
    });
    expect(result[1]).toEqual({
      name: "eslint",
      type: "manual",
      status: "installed",
      description: "JavaScript/TypeScript linter",
    });
  });

  it("assigns 'manual' type when parenthetical is missing", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);

    const ripgrep = toolsList().find((t) => t.name === "ripgrep");
    expect(ripgrep?.type).toBe("manual");
  });

  it("handles malformed installed.json by falling back to kit.md", () => {
    writeTestFile(tempPaths.akit.installed, "not valid json{{{");
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);

    const result = toolsList();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe("prettier");
  });
});

describe("toolsSearch", () => {
  beforeEach(() => {
    removeTestFile(tempPaths.akit.kit);
    removeTestFile(tempPaths.akit.installed);
  });

  it("returns empty array when no tools exist", () => {
    expect(toolsSearch("anything")).toEqual([]);
  });

  it("finds tools by name", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);
    const result = toolsSearch("prettier");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("prettier");
  });

  it("finds tools by description", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);
    const result = toolsSearch("linter");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("eslint");
  });

  it("finds tools by type", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);
    const result = toolsSearch("MCP");
    expect(result).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);
    const result = toolsSearch("PRETTIER");
    expect(result).toHaveLength(1);
  });

  it("returns empty when no match found", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);
    expect(toolsSearch("nonexistent-tool-xyz")).toEqual([]);
  });

  it("matches partial names", () => {
    writeTestFile(tempPaths.akit.kit, SAMPLE_KIT_MD);
    const result = toolsSearch("pret");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("prettier");
  });
});
