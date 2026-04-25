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

/**
 * Construct a MarkdownFileStorage instance bound to the current intentions
 * root. Returns a fresh instance per call — this matters for tests that
 * override $AMAN_INTENTIONS_HOME in beforeEach (a memoized instance would
 * cache the root resolved at module-load time).
 *
 * Construction is cheap (just config), so per-call cost is negligible.
 */
export function intentionsStorage(): MarkdownFileStorage<IntentionList> {
  return new MarkdownFileStorage<IntentionList>({
    root: getIntentionsRoot(),
    filename: "intentions.md",
    serialize,
    deserialize,
  });
}

/**
 * Read the intention list for a scope. Returns an empty list if the file
 * does not exist yet — callers can always call intentions methods without
 * a bootstrap step.
 *
 * Returns a fresh object each call to prevent callers from mutating a shared
 * singleton (which would bleed state across tests and between invocations).
 */
export async function getOrCreateList(scope: Scope): Promise<IntentionList> {
  const existing = await intentionsStorage().get(scope);
  return existing ?? { intentions: [] };
}
