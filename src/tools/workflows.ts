import { paths, readFileOr, writeFile } from "../lib/paths.js";

interface Workflow {
  name: string;
  description: string;
  steps: string[];
}

function parseWorkflows(content: string): Workflow[] {
  const workflows: Workflow[] = [];
  const sections = content.split(/\n## /);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split("\n");
    const headerLine = lines[0];
    const name = headerLine.replace(/^#+\s*/, "").trim();
    if (!name) continue;

    const description: string[] = [];
    const steps: string[] = [];
    let inSteps = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\d+\.\s/) || line.match(/^- \[[ x]\]/)) {
        inSteps = true;
      }
      if (inSteps && (line.match(/^\d+\.\s/) || line.match(/^- /))) {
        steps.push(line.replace(/^\d+\.\s*/, "").replace(/^- \[[ x]\]\s*/, "").trim());
      } else if (!inSteps && line.trim()) {
        description.push(line.trim());
      }
    }

    workflows.push({
      name,
      description: description.join(" "),
      steps,
    });
  }

  return workflows;
}

export function workflowList(): Workflow[] {
  const content = readFileOr(paths.aflow.flow, "");
  if (!content) return [];
  return parseWorkflows(content);
}

export function workflowGet(name: string): Workflow | null {
  const workflows = workflowList();
  const q = name.toLowerCase();
  return (
    workflows.find(
      (w) =>
        w.name.toLowerCase() === q ||
        w.name.toLowerCase().includes(q)
    ) ?? null
  );
}

export function workflowAdd(
  name: string,
  description: string,
  steps: string[]
): string {
  const content = readFileOr(paths.aflow.flow, "");

  const numberedSteps = steps
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");
  const section = `\n## ${name}\n${description}\n\n${numberedSteps}\n`;

  if (!content) {
    writeFile(paths.aflow.flow, `# Workflows${section}`);
  } else {
    writeFile(paths.aflow.flow, content.trimEnd() + "\n" + section);
  }

  return `Added workflow: ${name} (${steps.length} steps)`;
}

export function workflowUpdate(name: string, steps: string[]): string {
  const content = readFileOr(paths.aflow.flow, "");
  if (!content) return "No workflows file found.";

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(## ${escapedName}\\n)([\\s\\S]*?)(?=\\n## |$)`,
    "i"
  );
  const match = content.match(pattern);

  if (!match) return `Workflow not found: ${name}`;

  // Preserve description lines (non-numbered, non-empty lines before steps)
  const existingLines = match[2].split("\n");
  const descLines: string[] = [];
  for (const line of existingLines) {
    if (line.match(/^\d+\.\s/) || line.match(/^- \[/)) break;
    if (line.trim()) descLines.push(line);
  }

  const numberedSteps = steps
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");
  const desc = descLines.length > 0 ? descLines.join("\n") + "\n\n" : "";

  const updated = content.replace(pattern, `## ${name}\n${desc}${numberedSteps}\n`);
  writeFile(paths.aflow.flow, updated);

  return `Updated workflow: ${name} (${steps.length} steps)`;
}

export function workflowRemove(name: string): string {
  const content = readFileOr(paths.aflow.flow, "");
  if (!content) return "No workflows file found.";

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\n## ${escapedName}\\n[\\s\\S]*?(?=\\n## |$)`,
    "i"
  );
  const match = content.match(pattern);

  if (!match) return `Workflow not found: ${name}`;

  const updated = content.replace(pattern, "");
  writeFile(paths.aflow.flow, updated);

  return `Removed workflow: ${name}`;
}
