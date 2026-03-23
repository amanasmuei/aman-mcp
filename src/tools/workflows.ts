import { paths, readFileOr } from "../lib/paths.js";

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
