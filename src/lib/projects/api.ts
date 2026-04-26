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

export async function getProject(_id: string, _scope: Scope): Promise<Project | null> {
  return null;
}

export async function listProjects(_filters: any, _scope: Scope): Promise<Project[]> {
  return [];
}

export async function activeProject(_scope: Scope): Promise<Project | null> {
  return null;
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

export async function closeProject(_id: string, _status: ProjectStatus, _reason: string, _scope: Scope): Promise<Project | null> {
  return null;
}

export async function updateProject(_id: string, _patch: any, _scope: Scope): Promise<Project | null> {
  return null;
}
