import * as os from "node:os";
import * as path from "node:path";
import { MarkdownFileStorage, type Scope } from "@aman_asmuei/aman-core";
import { serialize, deserialize } from "./markdown.js";
import type { ProjectList } from "./types.js";

/**
 * Default: ~/.aprojects — sibling of ~/.aintentions/.aeval/.acore.
 * Override: $AMAN_PROJECTS_HOME (matches the explicit-env-var pattern).
 *
 * Use os.homedir() directly; do NOT derive from getAmanHome() because
 * that's overridable for unrelated reasons.
 */
export function getProjectsRoot(): string {
  if (process.env.AMAN_PROJECTS_HOME) {
    return process.env.AMAN_PROJECTS_HOME;
  }
  return path.join(os.homedir(), ".aprojects");
}

/**
 * Construct a fresh MarkdownFileStorage instance per call. Tests override
 * $AMAN_PROJECTS_HOME in beforeEach; a memoized instance would cache the
 * root resolved at module-load time.
 */
export function projectsStorage(): MarkdownFileStorage<ProjectList> {
  return new MarkdownFileStorage<ProjectList>({
    root: getProjectsRoot(),
    filename: "projects.md",
    serialize,
    deserialize,
  });
}

/**
 * Read the project list for a scope. Returns an empty list if the file
 * does not exist yet — callers can always call project methods without
 * a bootstrap step.
 */
export async function getOrCreateList(scope: Scope): Promise<ProjectList> {
  const existing = await projectsStorage().get(scope);
  return existing ?? { projects: [] };
}
