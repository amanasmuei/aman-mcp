import * as os from "node:os";
import * as path from "node:path";
import { MarkdownFileStorage, type Scope } from "@aman_asmuei/aman-core";
import { serialize, deserialize } from "./markdown.js";
import type { IntentionList } from "./types.js";

/**
 * Returns the root directory for intention markdown files.
 *
 * Default: ~/.aintentions — sibling of ~/.acore/.arules/.aeval/.aflow.
 * Override: $AMAN_INTENTIONS_HOME (matches the explicit-env-var pattern of
 * aman-core's getAmanHome / getEngineDbPath).
 *
 * Note: do NOT derive this path from getAmanHome() + ".." — getAmanHome()
 * is overridable via $AMAN_HOME, and a relative jump from an arbitrary
 * directory does not produce a valid intentions root. Use os.homedir()
 * directly so the relationship to ~/.acore etc. is by-definition.
 */
export function getIntentionsRoot(): string {
  if (process.env.AMAN_INTENTIONS_HOME) {
    return process.env.AMAN_INTENTIONS_HOME;
  }
  return path.join(os.homedir(), ".aintentions");
}

const EMPTY_LIST: IntentionList = { intentions: [] };

export const intentionsStorage = new MarkdownFileStorage<IntentionList>({
  root: getIntentionsRoot(),
  filename: "intentions.md",
  serialize,
  deserialize,
});

/**
 * Read the intention list for a scope. Returns an empty list if the file
 * does not exist yet — callers can always call intentions methods without
 * a bootstrap step.
 */
export async function getOrCreateList(scope: Scope): Promise<IntentionList> {
  const existing = await intentionsStorage.get(scope);
  return existing ?? EMPTY_LIST;
}
