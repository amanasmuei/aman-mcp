import { paths, readFileOr, writeFile } from "../lib/paths.js";

interface SkillEntry {
  name: string;
  description: string;
  installed: boolean;
}

const BUILTIN_SKILLS: { name: string; description: string }[] = [
  { name: "testing", description: "Write and maintain test suites" },
  { name: "api-design", description: "Design RESTful and GraphQL APIs" },
  { name: "security", description: "Security auditing and best practices" },
  { name: "performance", description: "Performance profiling and optimization" },
  { name: "code-review", description: "Structured code review process" },
  { name: "documentation", description: "Write clear technical documentation" },
  { name: "git-workflow", description: "Git branching and collaboration workflows" },
  { name: "debugging", description: "Systematic debugging strategies" },
  { name: "refactoring", description: "Code refactoring patterns and techniques" },
  { name: "database", description: "Database design and query optimization" },
  { name: "typescript", description: "TypeScript patterns and type safety" },
  { name: "accessibility", description: "Web accessibility standards and testing" },
];

function parseSkills(content: string): { name: string; description: string }[] {
  const skills: { name: string; description: string }[] = [];
  const sections = content.split(/\n### /);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split("\n");
    const name = lines[0].replace(/^#+\s*/, "").trim();
    if (!name) continue;

    const descLines: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        descLines.push(lines[i].trim());
      }
    }

    skills.push({
      name,
      description: descLines.join(" ") || "",
    });
  }

  return skills;
}

export function skillList(): SkillEntry[] {
  const content = readFileOr(paths.askill.skills, "");
  const installed = content ? parseSkills(content) : [];
  const installedNames = new Set(installed.map((s) => s.name.toLowerCase()));

  const results: SkillEntry[] = [];

  // Add installed skills
  for (const skill of installed) {
    results.push({
      name: skill.name,
      description: skill.description,
      installed: true,
    });
  }

  // Add built-in skills that aren't installed
  for (const skill of BUILTIN_SKILLS) {
    if (!installedNames.has(skill.name.toLowerCase())) {
      results.push({
        name: skill.name,
        description: skill.description,
        installed: false,
      });
    }
  }

  return results;
}

export function skillSearch(query: string): SkillEntry[] {
  const all = skillList();
  const q = query.toLowerCase();
  return all.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  );
}

export function skillInstall(name: string): string {
  const content = readFileOr(paths.askill.skills, "");

  // Check if already installed
  if (content) {
    const installed = parseSkills(content);
    const existing = installed.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return `Skill already installed: ${name}`;
  }

  // Find description from built-in registry
  const builtin = BUILTIN_SKILLS.find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );
  const description = builtin?.description ?? "Custom skill";

  const section = `\n### ${name}\n${description}\n`;

  if (!content) {
    writeFile(paths.askill.skills, `# Skills${section}`);
  } else {
    writeFile(paths.askill.skills, content.trimEnd() + "\n" + section);
  }

  return `Installed skill: ${name}`;
}

export function skillUninstall(name: string): string {
  const content = readFileOr(paths.askill.skills, "");
  if (!content) return "No skills file found.";

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\n### ${escapedName}\\n[\\s\\S]*?(?=\\n### |$)`,
    "i"
  );
  const match = content.match(pattern);

  if (!match) return `Skill not found: ${name}`;

  const updated = content.replace(pattern, "");
  writeFile(paths.askill.skills, updated);

  return `Uninstalled skill: ${name}`;
}
