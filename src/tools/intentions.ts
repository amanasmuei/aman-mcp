/**
 * Intentions MCP tool implementations — keystone of the agentic substrate.
 *
 * These are thin wrappers over src/lib/intentions/api.ts. They:
 *   - Resolve scope from $AMAN_MCP_SCOPE (matches rules.ts pattern)
 *   - Pass through MCP-stable shapes (return Intention objects directly —
 *     no field renaming needed since the Intention type is the public shape)
 */

import {
  addIntention,
  getIntention,
  listIntentions,
  updateIntention,
  touchIntention,
  closeIntention,
  reviewIntentions,
  type AddIntentionInput,
  type UpdateIntentionInput,
  type ListFilters,
  type ReviewOptions,
} from "../lib/intentions/api.js";
import type { Intention } from "../lib/intentions/types.js";

function getScope(): string {
  return process.env.AMAN_MCP_SCOPE ?? "dev:plugin";
}

export async function intentionsAdd(
  input: AddIntentionInput,
): Promise<Intention> {
  return addIntention(input, getScope());
}

export async function intentionsGet(id: string): Promise<Intention | null> {
  return getIntention(id, getScope());
}

export async function intentionsList(
  filters: ListFilters,
): Promise<Intention[]> {
  return listIntentions(filters, getScope());
}

export async function intentionsUpdate(
  id: string,
  patch: UpdateIntentionInput,
): Promise<Intention | null> {
  return updateIntention(id, patch, getScope());
}

export async function intentionsTouch(id: string): Promise<Intention | null> {
  return touchIntention(id, getScope());
}

export async function intentionsClose(
  id: string,
  status: "complete" | "abandoned",
  reason: string,
): Promise<Intention | null> {
  return closeIntention(id, status, reason, getScope());
}

export async function intentionsReview(opts: ReviewOptions) {
  return reviewIntentions(opts, getScope());
}
