import type { StudioProject } from "@/lib/domain/schemas";

const STORAGE_KEY = "worker-studio.projects.v1";

export function loadProjects(): StudioProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioProject[];
    return parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveProjects(projects: StudioProject[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function saveProject(project: StudioProject) {
  const projects = loadProjects().filter((item) => item.id !== project.id);
  saveProjects([project, ...projects]);
  return project;
}

export function loadProject(id: string) {
  return loadProjects().find((project) => project.id === id) ?? null;
}

export function clearDemoProjects() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
