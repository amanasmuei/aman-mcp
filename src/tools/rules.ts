import { paths, readFileOr } from "../lib/paths.js";

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
