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

export async function loadProject(_query: string, _scope: Scope): Promise<{ match: Project | null; candidates: Project[] }> {
  return { match: null, candidates: [] };
}

export async function touchProject(_id: string, _scope: Scope): Promise<Project | null> {
  return null;
}

export async function saveSession(_id: string, _note: string, _scope: Scope): Promise<Project | null> {
  return null;
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

export async function updateProject(_id: string, _patch: any, _scope: Scope): Promise<Project | null> {
  return null;
}
