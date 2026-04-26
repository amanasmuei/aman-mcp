import type { Project, ProjectList } from "./types.js";
import { ACTIVE_LIST_CAPACITY } from "./types.js";

/** Sort active-list projects by position ascending (#1 first). */
export function activeProjectsSorted(list: ProjectList): Project[] {
  return list.projects
    .filter((p) => p.inActiveList && p.status === "active")
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
}

/**
 * Shift all currently-in-active-list projects' positions down by 1
 * (mutates in place). Caller is responsible for setting the new
 * position-1 project afterwards.
 */
export function shiftDown(list: ProjectList, exceptId?: string): void {
  for (const p of list.projects) {
    if (!p.inActiveList) continue;
    if (p.id === exceptId) continue;
    p.position = (p.position ?? 0) + 1;
  }
}

/**
 * If active-list count exceeds capacity, evict the highest-positioned
 * (oldest) project. Sets inActiveList=false, position=undefined,
 * lruEvictedAt=now. Returns the evicted project, or null if no eviction.
 */
export function evictIfOverCapacity(
  list: ProjectList,
  nowIso: string,
): Project | null {
  const active = activeProjectsSorted(list);
  if (active.length <= ACTIVE_LIST_CAPACITY) return null;
  const evicted = active[active.length - 1];
  evicted.inActiveList = false;
  evicted.position = undefined;
  evicted.lruEvictedAt = nowIso;
  return evicted;
}

/**
 * Repair drift: if two projects claim the same position, or positions
 * have gaps, renumber by lastTouchedAt desc.
 */
export function renumberPositions(list: ProjectList): void {
  const active = list.projects
    .filter((p) => p.inActiveList && p.status === "active")
    .sort(
      (a, b) =>
        new Date(b.lastTouchedAt).getTime() -
        new Date(a.lastTouchedAt).getTime(),
    );
  for (let i = 0; i < active.length; i++) {
    active[i].position = i + 1;
  }
}
