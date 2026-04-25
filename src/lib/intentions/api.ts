import { ulid } from "ulid";
import type { Scope } from "@aman_asmuei/aman-core";
import { intentionsStorage, getOrCreateList } from "./storage.js";
import type {
  Intention,
  IntentionStatus,
  IntentionHorizon,
} from "./types.js";

export interface AddIntentionInput {
  description: string;
  niyyah: string;
  successCriteria: string;
  horizon: IntentionHorizon;
  linkedProjectId?: string;
}

export interface ListFilters {
  status?: IntentionStatus;
  horizon?: IntentionHorizon;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function addIntention(
  input: AddIntentionInput,
  scope: Scope,
): Promise<Intention> {
  const list = await getOrCreateList(scope);
  const now = nowIso();
  const intent: Intention = {
    id: ulid(),
    description: input.description,
    niyyah: input.niyyah,
    successCriteria: input.successCriteria,
    horizon: input.horizon,
    status: "active",
    createdAt: now,
    lastTouchedAt: now,
    ...(input.linkedProjectId && { linkedProjectId: input.linkedProjectId }),
  };
  list.intentions.push(intent);
  await intentionsStorage().put(scope, list);
  return intent;
}

export async function getIntention(
  id: string,
  scope: Scope,
): Promise<Intention | null> {
  const list = await getOrCreateList(scope);
  return list.intentions.find((i) => i.id === id) ?? null;
}

export async function listIntentions(
  filters: ListFilters,
  scope: Scope,
): Promise<Intention[]> {
  const list = await getOrCreateList(scope);
  // Default: active only when no status filter provided
  const statusFilter: IntentionStatus = filters.status ?? "active";
  return list.intentions.filter((i) => {
    if (i.status !== statusFilter) return false;
    if (filters.horizon && i.horizon !== filters.horizon) return false;
    return true;
  });
}

export interface UpdateIntentionInput {
  description?: string;
  niyyah?: string;
  successCriteria?: string;
  horizon?: IntentionHorizon;
  linkedProjectId?: string;
}

export async function updateIntention(
  id: string,
  patch: UpdateIntentionInput,
  scope: Scope,
): Promise<Intention | null> {
  const list = await getOrCreateList(scope);
  const idx = list.intentions.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const current = list.intentions[idx];
  const updated: Intention = {
    ...current,
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.niyyah !== undefined && { niyyah: patch.niyyah }),
    ...(patch.successCriteria !== undefined && {
      successCriteria: patch.successCriteria,
    }),
    ...(patch.horizon !== undefined && { horizon: patch.horizon }),
    ...(patch.linkedProjectId !== undefined && {
      linkedProjectId: patch.linkedProjectId,
    }),
    lastTouchedAt: nowIso(),
  };
  list.intentions[idx] = updated;
  await intentionsStorage().put(scope, list);
  return updated;
}

export async function touchIntention(
  id: string,
  scope: Scope,
): Promise<Intention | null> {
  const list = await getOrCreateList(scope);
  const idx = list.intentions.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const updated: Intention = {
    ...list.intentions[idx],
    lastTouchedAt: nowIso(),
  };
  list.intentions[idx] = updated;
  await intentionsStorage().put(scope, list);
  return updated;
}

export async function closeIntention(
  id: string,
  status: "complete" | "abandoned",
  reason: string,
  scope: Scope,
): Promise<Intention | null> {
  const list = await getOrCreateList(scope);
  const idx = list.intentions.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const now = nowIso();
  const updated: Intention = {
    ...list.intentions[idx],
    status,
    closedAt: now,
    closedReason: reason,
    lastTouchedAt: now,
  };
  list.intentions[idx] = updated;
  await intentionsStorage().put(scope, list);
  return updated;
}
