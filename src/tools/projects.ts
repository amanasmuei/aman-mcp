/**
 * Projects MCP tool implementations — thin wrappers over src/lib/projects/api.ts.
 * Mirror the intentions tool pattern exactly:
 *   - Resolve scope from $AMAN_MCP_SCOPE
 *   - Pass through the Project type as the public shape (no field renaming)
 */

import {
  addProject,
  getProject,
  listProjects,
  activeProject,
  loadProject,
  touchProject,
  saveSession,
  closeProject,
  updateProject,
  listProjectsBrief,
  type AddProjectInput,
  type ListProjectsFilters,
  type UpdateProjectInput,
  type LoadProjectResult,
  type ProjectBrief,
} from "../lib/projects/api.js";
import type { Project, ProjectStatus } from "../lib/projects/types.js";

function getScope(): string {
  return process.env.AMAN_MCP_SCOPE ?? "dev:plugin";
}

export async function projectAdd(input: AddProjectInput): Promise<Project> {
  return addProject(input, getScope());
}

export async function projectGet(id: string): Promise<Project | null> {
  return getProject(id, getScope());
}

export async function projectList(
  filters: ListProjectsFilters,
): Promise<Project[]> {
  return listProjects(filters, getScope());
}

export async function projectActive(): Promise<Project | null> {
  return activeProject(getScope());
}

export async function projectLoad(query: string): Promise<LoadProjectResult> {
  return loadProject(query, getScope());
}

export async function projectTouch(id: string): Promise<Project | null> {
  return touchProject(id, getScope());
}

export async function projectSave(
  id: string,
  sessionNote: string,
): Promise<Project | null> {
  return saveSession(id, sessionNote, getScope());
}

export async function projectClose(
  id: string,
  status: ProjectStatus,
  reason: string,
): Promise<Project | null> {
  return closeProject(id, status, reason, getScope());
}

export async function projectUpdate(
  id: string,
  patch: UpdateProjectInput,
): Promise<Project | null> {
  return updateProject(id, patch, getScope());
}

export async function projectBrief(): Promise<ProjectBrief[]> {
  return listProjectsBrief(getScope());
}
