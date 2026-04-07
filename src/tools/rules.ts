/**
 * Rules tool implementations — wraps @aman_asmuei/arules-core for the
 * aman-mcp aggregator.
 *
 * Phase 4 of the aman engine v1 build sequence: this file used to read
 * ~/.arules/rules.md directly via fs + regex parsing. Now it delegates to
 * arules-core's library API, which means:
 *
 *   - Multi-tenant by default (each scope has its own ruleset)
 *   - The runtime enforcement engine (checkAction, checkToolCall, prompt
 *     injection) is shared with aman-tg's guardrails — same algorithm,
 *     same defaults
 *   - Backward-compatible with hand-edited ~/.arules/rules.md
 *
 * Default scope = `dev:plugin` because aman-mcp is consumed primarily by
 * Claude Code through aman-plugin. Override at runtime with $AMAN_MCP_SCOPE.
 */

import {
  listRuleCategories,
  checkAction,
  addRule,
  removeRule,
  toggleRuleAt,
  getOrCreateRuleset,
  type RuleCategory,
} from "@aman_asmuei/arules-core";

function getScope(): string {
  return process.env.AMAN_MCP_SCOPE ?? "dev:plugin";
}

/**
 * MCP-stable shape for the rules_list tool. The arules-core RuleCategory
 * uses `name`; we map it to `category` for backward compatibility with
 * any existing aman-mcp consumer that's been reading the old shape.
 */
interface MCPRuleCategory {
  category: string;
  rules: string[];
}

export async function rulesList(): Promise<MCPRuleCategory[]> {
  const cats: RuleCategory[] = await listRuleCategories(getScope());
  return cats.map((c) => ({ category: c.name, rules: c.rules }));
}

export async function rulesCheck(action: string): Promise<{
  violations: string[];
  safe: boolean;
}> {
  return checkAction(action, getScope());
}

export async function rulesAdd(
  category: string,
  rule: string,
): Promise<string> {
  // Bootstrap a default ruleset if none exists, so adding a rule from the
  // MCP host always succeeds even on a fresh install.
  await getOrCreateRuleset(getScope());
  await addRule(category, rule, getScope());
  return `Added rule to "${category}": ${rule}`;
}

export async function rulesRemove(
  category: string,
  ruleIndex: number,
): Promise<string> {
  // Snapshot the categories so we can return a useful message about what
  // got removed (and validate the index instead of silent no-op).
  const before = await listRuleCategories(getScope());
  const cat = before.find(
    (c) => c.name.toLowerCase() === category.toLowerCase(),
  );
  if (!cat) return `Category not found: ${category}`;
  if (ruleIndex < 1 || ruleIndex > cat.rules.length) {
    return `Invalid rule index ${ruleIndex}. Category "${category}" has ${cat.rules.length} active rules.`;
  }
  const removedRule = cat.rules[ruleIndex - 1];

  await removeRule(category, ruleIndex, getScope());
  return `Removed rule ${ruleIndex} from "${category}": ${removedRule}`;
}

export async function rulesToggle(
  category: string,
  ruleIndex: number,
): Promise<string> {
  // Use the FullRuleCategory listing so the index lines up with disabled
  // rules too — the toggle operation must be able to flip a rule from
  // disabled→enabled, and the index has to count both states.
  const { listRuleCategoriesFull } = await import("@aman_asmuei/arules-core");
  const fullBefore = await listRuleCategoriesFull(getScope());
  const cat = fullBefore.find(
    (c) => c.name.toLowerCase() === category.toLowerCase(),
  );
  if (!cat) return `Category not found: ${category}`;
  if (ruleIndex < 1 || ruleIndex > cat.rules.length) {
    return `Invalid rule index ${ruleIndex}. Category "${category}" has ${cat.rules.length} rules.`;
  }
  const target = cat.rules[ruleIndex - 1];

  await toggleRuleAt(category, ruleIndex, getScope());

  const newState = target.disabled ? "enabled" : "disabled";
  return `Toggled rule ${ruleIndex} in "${category}": ${target.text} (now ${newState})`;
}
