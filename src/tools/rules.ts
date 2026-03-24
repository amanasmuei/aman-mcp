import { paths, readFileOr, writeFile } from "../lib/paths.js";

interface RuleCategory {
  category: string;
  rules: string[];
}

export function rulesList(): RuleCategory[] {
  const content = readFileOr(paths.arules.rules, "");
  if (!content) return [];

  const categories: RuleCategory[] = [];
  const sections = content.split(/\n## /);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split("\n");
    const category = lines[0].replace(/^#+\s*/, "").trim();
    if (!category) continue;

    const rules: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^- /)) {
        rules.push(line.slice(2).trim());
      }
    }

    if (rules.length > 0) {
      categories.push({ category, rules });
    }
  }

  return categories;
}

export function rulesCheck(action: string): {
  violations: string[];
  safe: boolean;
} {
  const content = readFileOr(paths.arules.rules, "");
  if (!content) return { violations: [], safe: true };

  // Look for "Never" section specifically
  const neverMatch = content.match(/## Never\n([\s\S]*?)(?=\n## |$)/);

  // Also collect all rules as potential violations
  const allRules: string[] = [];

  if (neverMatch) {
    const rules = neverMatch[1]
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim());
    allRules.push(...rules);
  }

  // Also check for rules with "never", "don't", "do not", "must not" keywords
  const lines = content.split("\n");
  for (const line of lines) {
    if (
      line.startsWith("- ") &&
      /\b(never|don't|do not|must not|forbidden|prohibited)\b/i.test(line)
    ) {
      const rule = line.slice(2).trim();
      if (!allRules.includes(rule)) {
        allRules.push(rule);
      }
    }
  }

  const actionLower = action.toLowerCase();
  const violations = allRules.filter((rule) => {
    const keywords = rule
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    return keywords.some((kw) => actionLower.includes(kw));
  });

  return { violations, safe: violations.length === 0 };
}

export function rulesAdd(category: string, rule: string): string {
  const content = readFileOr(paths.arules.rules, "");

  if (!content) {
    const newContent = `# Rules\n\n## ${category}\n- ${rule}\n`;
    writeFile(paths.arules.rules, newContent);
    return `Added rule to new category "${category}": ${rule}`;
  }

  const pattern = new RegExp(
    `(## ${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n[\\s\\S]*?)(?=\\n## |$)`
  );
  const match = content.match(pattern);

  if (match) {
    const updated = content.replace(pattern, `${match[1]}\n- ${rule}`);
    writeFile(paths.arules.rules, updated);
  } else {
    const updated = content.trimEnd() + `\n\n## ${category}\n- ${rule}\n`;
    writeFile(paths.arules.rules, updated);
  }

  return `Added rule to "${category}": ${rule}`;
}

export function rulesRemove(category: string, ruleIndex: number): string {
  const content = readFileOr(paths.arules.rules, "");
  if (!content) return "No rules file found.";

  const pattern = new RegExp(
    `(## ${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n)([\\s\\S]*?)(?=\\n## |$)`
  );
  const match = content.match(pattern);

  if (!match) return `Category not found: ${category}`;

  const lines = match[2].split("\n");
  const ruleLines: { index: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^- /)) {
      ruleLines.push({ index: i, text: lines[i] });
    }
  }

  if (ruleIndex < 1 || ruleIndex > ruleLines.length) {
    return `Invalid rule index ${ruleIndex}. Category "${category}" has ${ruleLines.length} rules.`;
  }

  const targetLine = ruleLines[ruleIndex - 1];
  lines.splice(targetLine.index, 1);

  const updated = content.replace(pattern, `${match[1]}${lines.join("\n")}`);
  writeFile(paths.arules.rules, updated);

  return `Removed rule ${ruleIndex} from "${category}": ${targetLine.text.slice(2)}`;
}

export function rulesToggle(category: string, ruleIndex: number): string {
  const content = readFileOr(paths.arules.rules, "");
  if (!content) return "No rules file found.";

  const pattern = new RegExp(
    `(## ${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n)([\\s\\S]*?)(?=\\n## |$)`
  );
  const match = content.match(pattern);

  if (!match) return `Category not found: ${category}`;

  const lines = match[2].split("\n");
  const ruleLines: { index: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^- /)) {
      ruleLines.push({ index: i, text: lines[i] });
    }
  }

  if (ruleIndex < 1 || ruleIndex > ruleLines.length) {
    return `Invalid rule index ${ruleIndex}. Category "${category}" has ${ruleLines.length} rules.`;
  }

  const target = ruleLines[ruleIndex - 1];
  const ruleText = target.text.slice(2).trim();

  if (ruleText.startsWith("~~") && ruleText.endsWith("~~")) {
    lines[target.index] = `- ${ruleText.slice(2, -2)}`;
  } else {
    lines[target.index] = `- ~~${ruleText}~~`;
  }

  const updated = content.replace(pattern, `${match[1]}${lines.join("\n")}`);
  writeFile(paths.arules.rules, updated);

  return `Toggled rule ${ruleIndex} in "${category}": ${lines[target.index]}`;
}
