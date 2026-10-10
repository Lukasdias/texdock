import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CompileLog,
  FileText,
  ProjectCreate,
  ProjectDetail,
  ProjectOut,
  ProjectUpdate,
  TreeNode,
} from "@/lib/api";

export const queryKeys = {
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  file: (projectId: string, path: string) =>
    ["projects", projectId, "file", path] as const,
  log: (projectId: string) => ["projects", projectId, "log"] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => api.projects.list(),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => api.projects.get(projectId),
    enabled: projectId.length > 0,
  });
}

export function useFile(projectId: string, path: string | null) {
  return useQuery({
    queryKey: queryKeys.file(projectId, path ?? ""),
    queryFn: () => api.files.get(projectId, path as string),
    enabled: projectId.length > 0 && path !== null,
  });
}

export function useCompileLog(projectId: string) {
  return useQuery({
    queryKey: queryKeys.log(projectId),
    queryFn: () => api.compile.log(projectId),
    enabled: projectId.length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<ProjectOut, Error, ProjectCreate>({
    mutationFn: (body) => api.projects.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ProjectOut, Error, ProjectUpdate>({
    mutationFn: (body) => api.projects.update(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (projectId) => api.projects.remove(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useSaveFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<FileText, Error, { path: string; content: string }>({
    mutationFn: ({ path, content }) => api.files.put(projectId, path, content),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.file(projectId, variables.path),
        data,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useUploadFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<TreeNode, Error, { path: string; file: File }>({
    mutationFn: ({ path, file }) => api.files.create(projectId, path, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useDeleteFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (path) => api.files.remove(projectId, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useCompile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ status: string }, Error, void>({
    mutationFn: () => api.compile.trigger(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export type { CompileLog, ProjectOut, ProjectDetail, TreeNode, FileText };
