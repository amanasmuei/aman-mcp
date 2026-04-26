/**
 * Projects layer — discrete arcs of work that Aman is actively pursuing.
 * Peer to intentions/eval/rules. LRU-positioned: top 10 active projects
 * compete for slots, position #1 = most recently created/loaded/touched.
 *
 * Status (lifecycle) and inActiveList (LRU membership) are ORTHOGONAL:
 *   - Closing a project transitions status; the slot is freed.
 *   - LRU eviction at #11 sets inActiveList=false; status stays active.
 *
 * Reciprocally linked with intentions via linkedIntentionId / linkedProjectId.
 */

export type ProjectStatus = "active" | "paused" | "complete" | "abandoned";

export interface Project {
  /** ULID assigned at creation; stable across renames */
  id: string;
  /** Short, action-oriented name — e.g. "Phase 1.5 substrate" */
  name: string;
  /** Lifecycle state */
  status: ProjectStatus;
  /** True when this project occupies one of the 10 active LRU slots */
  inActiveList: boolean;
  /** 1..10 when inActiveList=true, otherwise undefined */
  position?: number;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
  /** ISO 8601 timestamp of last touch (auto-updates) */
  lastTouchedAt: string;
  /** ISO 8601 timestamp set when bumped out of LRU top-10 while still active */
  lruEvictedAt?: string;
  /** ISO 8601 timestamp when status moved to complete/abandoned/paused */
  closedAt?: string;
  /** Free-text reason given when closing */
  closedReason?: string;
  /** Optional intention id for bidirectional linking */
  linkedIntentionId?: string;
  /** Workspaces (cwd paths) this project spans — used for ambient context match */
  workspaces?: string[];
  /** Niyyah / one-line spirit anchor — defaults to linked intention's niyyah */
  niyyah?: string;
  /** Free-text body: session logs, notes, decisions. Markdown allowed. */
  sessionLog: string;
}

/** Wrapper persisted by MarkdownFileStorage<T> per scope. */
export interface ProjectList {
  projects: Project[];
}

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "active",
  "paused",
  "complete",
  "abandoned",
] as const;

/** Maximum simultaneous projects in the active LRU list. */
export const ACTIVE_LIST_CAPACITY = 10;
