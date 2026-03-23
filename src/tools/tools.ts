import fs from "node:fs";
import { paths, readFileOr } from "../lib/paths.js";

interface ToolEntry {
  name: string;
  type: string;
  status: string;
  description: string;
}

export function toolsList(): ToolEntry[] {
  // Try installed.json first for structured data
  try {
    const raw = fs.readFileSync(paths.akit.installed, "utf-8");
    return JSON.parse(raw) as ToolEntry[];
  } catch {
    // Fall back to parsing kit.md
  }

  const content = readFileOr(paths.akit.kit, "");
  if (!content) {
    return [];
  }

  const tools: ToolEntry[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^- \*\*(.+?)\*\*\s*(?:\((.+?)\))?\s*[-—:]\s*(.+)/);
    if (match) {
      tools.push({
        name: match[1],
        type: match[2] ?? "manual",
        status: "installed",
        description: match[3].trim(),
      });
    }
  }

  return tools;
}

export function toolsSearch(query: string): ToolEntry[] {
  const all = toolsList();
  const q = query.toLowerCase();
  return all.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q)
  );
}
