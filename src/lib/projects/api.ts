import { ulid } from "ulid";
import type { Scope } from "@aman_asmuei/aman-core";
import { projectsStorage, getOrCreateList } from "./storage.js";
import {
  shiftDown,
  evictIfOverCapacity,
  activeProjectsSorted,
} from "./lru.js";
import type { Project, ProjectList, ProjectStatus } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export interface AddProjectInput {
  name: string;
  niyyah?: string;
  linkedIntentionId?: string;
  workspaces?: string[];
  /** Backdate; defaults to now. Used by import / register flows. */
  createdAt?: string;
  /** Backdate; defaults to createdAt. */
  lastTouchedAt?: string;
}

export async function addProject(
  input: AddProjectInput,
  scope: Scope,
): Promise<Project> {
  const list = await getOrCreateList(scope);
  // Reject duplicate names (case-insensitive)
  const existing = list.projects.find(
    (p) => p.name.toLowerCase() === input.name.toLowerCase(),
  );
  if (existing) {
    throw new Error(
      `Project with name "${input.name}" already exists (id ${existing.id}). Use project_load to bring it back.`,
    );
  }
  const now = nowIso();
  const created = input.createdAt ?? now;
  // Shift existing active-list projects down before inserting at #1
  shiftDown(list);
  const project: Project = {
    id: ulid(),
    name: input.name,
    status: "active",
    inActiveList: true,
    position: 1,
    createdAt: created,
    lastTouchedAt: input.lastTouchedAt ?? created,
    sessionLog: "",
    ...(input.niyyah && { niyyah: input.niyyah }),
    ...(input.linkedIntentionId && {
      linkedIntentionId: input.linkedIntentionId,
    }),
    ...(input.workspaces && { workspaces: input.workspaces }),
  };
  list.projects.push(project);
  evictIfOverCapacity(list, now);
  await projectsStorage().put(scope, list);
  return project;
}

// Stubs for incremental dev — implemented in Tasks 7-17

export async function getProject(
  id: string,
  scope: Scope,
): Promise<Project | null> {
  const list = await getOrCreateList(scope);
  return list.projects.find((p) => p.id === id) ?? null;
}

export interface ListProjectsFilters {
  status?: ProjectStatus;
  inActiveList?: boolean;
}

export async function listProjects(
  filters: ListProjectsFilters,
  scope: Scope,
): Promise<Project[]> {
  const list = await getOrCreateList(scope);
  return list.projects.filter((p) => {
    if (filters.status !== undefined && p.status !== filters.status)
      return false;
    if (
      filters.inActiveList !== undefined &&
      p.inActiveList !== filters.inActiveList
    )
      return false;
    if (filters.status === undefined && filters.inActiveList === undefined) {
      // Default: active + inActiveList
      return p.status === "active" && p.inActiveList;
    }
    return true;
  });
}

export async function activeProject(scope: Scope): Promise<Project | null> {
  const list = await getOrCreateList(scope);
  const sorted = activeProjectsSorted(list);
  return sorted[0] ?? null;
}

export interface LoadProjectResult {
  match: Project | null;
  candidates: Project[];
}

export async function loadProject(
  query: string,
  scope: Scope,
): Promise<LoadProjectResult> {
  const list = await getOrCreateList(scope);
  const q = query.toLowerCase();
  // Exact match first (case-insensitive on name or id prefix)
  const exact = list.projects.find(
    (p) => p.name.toLowerCase() === q || p.id === query,
  );
  let match: Project | null = exact ?? null;
  let candidates: Project[] = [];
  if (!match) {
    const substring = list.projects.filter((p) =>
      p.name.toLowerCase().includes(q),
    );
    if (substring.length === 1) {
      match = substring[0];
    } else if (substring.length > 1) {
      candidates = substring;
    }
  }
  if (!match) return { match: null, candidates };
  // Bring match to position #1
  const now = nowIso();
  shiftDown(list, match.id);
  match.inActiveList = true;
  match.position = 1;
  match.lastTouchedAt = now;
  match.lruEvictedAt = undefined;
  evictIfOverCapacity(list, now);
  await projectsStorage().put(scope, list);
  return { match, candidates: [] };
}

export async function touchProject(
  id: string,
  scope: Scope,
): Promise<Project | null> {
  const list = await getOrCreateList(scope);
  const target = list.projects.find((p) => p.id === id);
  if (!target) return null;
  if (!target.inActiveList) return null; // Caller should use loadProject
  shiftDown(list, target.id);
  target.position = 1;
  target.lastTouchedAt = nowIso();
  await projectsStorage().put(scope, list);
  return target;
}

export async function saveSession(
  id: string,
  sessionNote: string,
  scope: Scope,
): Promise<Project | null> {
  const list = await getOrCreateList(scope);
  const idx = list.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const now = nowIso();
  const dateStr = now.slice(0, 10);
  const timeOfDay = periodOfDay(new Date(now));
  const entry = `### ${dateStr} ${timeOfDay}\n${sessionNote}\n`;
  const current = list.projects[idx];
  const updated: Project = {
    ...current,
    sessionLog: current.sessionLog
      ? `${current.sessionLog}\n${entry}`
      : entry,
    lastTouchedAt: now,
  };
  list.projects[idx] = updated;
  await projectsStorage().put(scope, list);
  return updated;
}

function periodOfDay(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "late-night";
}

export async function closeProject(
  id: string,
  status: ProjectStatus,
  reason: string,
  scope: Scope,
): Promise<Project | null> {
  const list = await getOrCreateList(scope);
  const idx = list.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const now = nowIso();
  const updated: Project = {
    ...list.projects[idx],
    status,
    inActiveList: false,
    position: undefined,
    closedAt: now,
    closedReason: reason,
    lastTouchedAt: now,
  };
  list.projects[idx] = updated;
  // Renumber remaining active projects to close gaps
  const { renumberPositions } = await import("./lru.js");
  renumberPositions(list);
  await projectsStorage().put(scope, list);
  return updated;
}

export interface UpdateProjectInput {
  name?: string;
  niyyah?: string;
  linkedIntentionId?: string | null;
  workspaces?: string[];
}

export interface UpdateProjectOptions {
  skipReciprocal?: boolean;
}

export async function updateProject(
  id: string,
  patch: UpdateProjectInput,
  scope: Scope,
  opts: UpdateProjectOptions = {},
): Promise<Project | null> {
  const list = await getOrCreateList(scope);
  const idx = list.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const current = list.projects[idx];
  const previousLinkedIntentionId = current.linkedIntentionId;
  const updated: Project = {
    ...current,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.niyyah !== undefined && { niyyah: patch.niyyah }),
    ...(patch.workspaces !== undefined && { workspaces: patch.workspaces }),
    ...(patch.linkedIntentionId !== undefined && {
      linkedIntentionId: patch.linkedIntentionId ?? undefined,
    }),
    lastTouchedAt: nowIso(),
  };
  list.projects[idx] = updated;
  await projectsStorage().put(scope, list);

  if (
    !opts.skipReciprocal &&
    patch.linkedIntentionId !== undefined &&
    patch.linkedIntentionId !== previousLinkedIntentionId
  ) {
    const { updateIntention: updIntent } = await import(
      "../intentions/api.js"
    );
    if (previousLinkedIntentionId) {
      await updIntent(
        previousLinkedIntentionId,
        { linkedProjectId: undefined },
        scope,
        { skipReciprocal: true },
      );
    }
    if (patch.linkedIntentionId) {
      await updIntent(
        patch.linkedIntentionId,
        { linkedProjectId: id },
        scope,
        { skipReciprocal: true },
      );
    }
  }
  return updated;
}

export type ProjectBrief = Omit<Project, "sessionLog">;

export async function listProjectsBrief(
  scope: Scope,
): Promise<ProjectBrief[]> {
  const list = await getOrCreateList(scope);
  return list.projects.map((p) => {
    const { sessionLog: _, ...rest } = p;
    return rest;
  });
}
