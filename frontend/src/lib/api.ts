/**
 * REST client for the texdock backend.
 *
 * Types mirror `backend/app/schemas.py`; endpoints mirror the plan's Task 9/10
 * and the spec's API surface. The backend runs in a sibling worktree, so this
 * file is written against the frozen contract (no mock server, no fake data).
 */

export type Engine = "pdflatex" | "xelatex" | "lualatex";

export interface ProjectCreate {
  name: string;
  engine?: Engine;
}

export interface ProjectUpdate {
  name?: string;
  engine?: Engine;
  main_file?: string;
}

export interface ProjectOut {
  id: string;
  name: string;
  engine: Engine;
  main_file: string;
  created_at: string;
  updated_at: string;
  last_status: string | null;
}

export interface TreeNode {
  path: string;
  is_binary: boolean;
  size: number;
  updated_at: string;
}

export interface ProjectDetail {
  project: ProjectOut;
  files: TreeNode[];
}

export interface FileText {
  content: string;
  updated_at: string;
}

export interface Problem {
  kind: "error" | "warning";
  file: string | null;
  line: number | null;
  message: string;
}

export interface CompileStatus {
  status: string;
  problems: Problem[];
  finished_at: string | null;
}

export interface CompileLog {
  log: string;
  problems: Problem[];
}

export interface SynctexForward {
  page: number;
  x: number;
  y: number;
}

export interface SynctexInverse {
  file: string;
  line: number;
}

const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function encodePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let detail: unknown = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body?.detail !== undefined) detail = body.detail;
    } catch {
      // non-JSON error body: keep the status text
    }
    throw new ApiError(response.status, String(detail));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

function jsonRequest(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return { ...init, headers };
}

export const api = {
  projects: {
    list: () => request<ProjectOut[]>(`${API_BASE}/projects`),
    create: (body: ProjectCreate) =>
      request<ProjectOut>(
        `${API_BASE}/projects`,
        jsonRequest({ method: "POST", body: JSON.stringify(body) }),
      ),
    get: (projectId: string) =>
      request<ProjectDetail>(`${API_BASE}/projects/${projectId}`),
    update: (projectId: string, body: ProjectUpdate) =>
      request<ProjectOut>(
        `${API_BASE}/projects/${projectId}`,
        jsonRequest({ method: "PATCH", body: JSON.stringify(body) }),
      ),
    remove: (projectId: string) =>
      request<void>(`${API_BASE}/projects/${projectId}`, { method: "DELETE" }),
  },
  files: {
    get: (projectId: string, path: string) =>
      request<FileText>(`${API_BASE}/projects/${projectId}/files/${encodePath(path)}`),
    put: (projectId: string, path: string, content: string) =>
      request<FileText>(
        `${API_BASE}/projects/${projectId}/files/${encodePath(path)}`,
        jsonRequest({ method: "PUT", body: JSON.stringify({ content }) }),
      ),
    create: (projectId: string, path: string, file: File) => {
      const form = new FormData();
      form.append("path", path);
      form.append("file", file);
      return request<TreeNode>(`${API_BASE}/projects/${projectId}/files`, {
        method: "POST",
        body: form,
      });
    },
    remove: (projectId: string, path: string) =>
      request<void>(`${API_BASE}/projects/${projectId}/files/${encodePath(path)}`, {
        method: "DELETE",
      }),
  },
  compile: {
    trigger: (projectId: string) =>
      request<{ status: string }>(`${API_BASE}/projects/${projectId}/compile`, {
        method: "POST",
      }),
    log: (projectId: string) =>
      request<CompileLog>(`${API_BASE}/projects/${projectId}/log`),
    synctexForward: (projectId: string, file: string, line: number) =>
      request<SynctexForward>(
        `${API_BASE}/projects/${projectId}/synctex/forward?file=${encodeURIComponent(file)}&line=${line}`,
      ),
    synctexInverse: (projectId: string, page: number, x: number, y: number) =>
      request<SynctexInverse>(
        `${API_BASE}/projects/${projectId}/synctex/inverse?page=${page}&x=${x}&y=${y}`,
      ),
    pdfUrl: (projectId: string, download = false) =>
      `${API_BASE}/projects/${projectId}/pdf${download ? "?download=1" : ""}`,
    synctexUrl: (projectId: string) => `${API_BASE}/projects/${projectId}/synctex`,
  },
};

export type Api = typeof api;
