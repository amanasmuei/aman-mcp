/**
 * Intentions layer — durable goals (niyyah) that Aman is working toward
 * across sessions. The keystone of the agentic substrate: every subsequent
 * agentic agent (morning brief, Friday reflector, project watchers) reads
 * from this layer to know what Aman is pursuing.
 */

export type IntentionStatus = "active" | "paused" | "complete" | "abandoned";

export type IntentionHorizon =
  | "this-week"
  | "this-month"
  | "this-quarter"
  | "lifelong";

export interface Intention {
  /** ULID assigned at creation; stable identifier across renames */
  id: string;
  /** Short, action-oriented title — e.g. "Ship Simi Tracker v2" */
  description: string;
  /** Niyyah (intention) — why this matters; the spiritual/personal anchor */
  niyyah: string;
  /** Concrete, observable signal that the intention has been fulfilled */
  successCriteria: string;
  /** Time horizon — drives "due-by" stale checks in reviewIntentions */
  horizon: IntentionHorizon;
  /** Lifecycle state */
  status: IntentionStatus;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
  /** ISO 8601 timestamp of last touch (auto-updates when conversation moves it) */
  lastTouchedAt: string;
  /** ISO 8601 timestamp when status moved to complete or abandoned */
  closedAt?: string;
  /** Free-text reason given when closing */
  closedReason?: string;
  /** Optional Simi Tracker project id for cross-referencing */
  linkedProjectId?: string;
}

/**
 * Wrapper type — what MarkdownFileStorage<T> persists per scope.
 * Currently a flat list; could grow to include metadata (last review date, etc.).
 */
export interface IntentionList {
  intentions: Intention[];
}

/** Constants used by markdown.ts — kept here for type-driven exhaustiveness. */
export const INTENTION_STATUSES: readonly IntentionStatus[] = [
  "active",
  "paused",
  "complete",
  "abandoned",
] as const;

export const INTENTION_HORIZONS: readonly IntentionHorizon[] = [
  "this-week",
  "this-month",
  "this-quarter",
  "lifelong",
] as const;
