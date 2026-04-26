import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const home = os.homedir();

export const paths = {
  acore: {
    dir: path.join(home, ".acore"),
    core: path.join(home, ".acore", "core.md"),
  },
  akit: {
    dir: path.join(home, ".akit"),
    kit: path.join(home, ".akit", "kit.md"),
    installed: path.join(home, ".akit", "installed.json"),
  },
  aflow: {
    dir: path.join(home, ".aflow"),
    flow: path.join(home, ".aflow", "flow.md"),
  },
  arules: {
    dir: path.join(home, ".arules"),
    rules: path.join(home, ".arules", "rules.md"),
  },
  aeval: {
    dir: path.join(home, ".aeval"),
    eval: path.join(home, ".aeval", "eval.md"),
  },
  aprojects: {
    dir: path.join(home, ".aprojects"),
    projects: path.join(home, ".aprojects", "projects.md"),
  },
  askill: {
    dir: path.join(home, ".askill"),
    skills: path.join(home, ".askill", "skills.md"),
  },
} as const;

export function readFileOr(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
}
