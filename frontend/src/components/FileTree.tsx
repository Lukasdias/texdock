import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  FileImage,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useDeleteFile,
  useSaveFile,
  useUploadFile,
} from "@/lib/queries";
import type { TreeNode } from "@/lib/api";

interface FileTreeProps {
  projectId: string;
  files: TreeNode[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

interface FileEntry {
  type: "file";
  name: string;
  path: string;
  isBinary: boolean;
}

interface DirEntry {
  type: "dir";
  name: string;
  path: string;
  children: Entry[];
}

type Entry = FileEntry | DirEntry;

function buildTree(files: TreeNode[]): Entry[] {
  const root: DirEntry = { type: "dir", name: "", path: "", children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let dir = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const segment = parts[i];
      const segmentPath = parts.slice(0, i + 1).join("/");
      const existing = dir.children.find(
        (entry): entry is DirEntry => entry.type === "dir" && entry.name === segment,
      );
      if (existing) {
        dir = existing;
      } else {
        const created: DirEntry = {
          type: "dir",
          name: segment,
          path: segmentPath,
          children: [],
        };
        dir.children.push(created);
        dir = created;
      }
    }
    dir.children.push({
      type: "file",
      name: parts[parts.length - 1],
      path: file.path,
      isBinary: file.is_binary,
    });
  }

  const sortEntries = (entries: Entry[]): Entry[] =>
    [...entries]
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) =>
        entry.type === "dir"
          ? { ...entry, children: sortEntries(entry.children) }
          : entry,
      );

  return sortEntries(root.children);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function FileTree({
  projectId,
  files,
  activePath,
  onSelect,
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"file" | "folder" | null>(null);
  const [draftPath, setDraftPath] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadTarget, setUploadTarget] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const saveFile = useSaveFile(projectId);
  const deleteFile = useDeleteFile(projectId);
  const uploadFile = useUploadFile(projectId);

  function toggle(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleCreate() {
    const trimmed = draftPath.trim().replace(/^\/+/, "");
    if (!trimmed) return;
    const isFolder = dialog === "folder";
    const target = isFolder ? `${trimmed}/.gitkeep` : trimmed;
    try {
      await saveFile.mutateAsync({ path: target, content: "" });
      toast.success(isFolder ? `Created folder “${trimmed}”` : `Created “${target}”`);
      setDialog(null);
      setDraftPath("");
      if (!isFolder) onSelect(target);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleDelete(path: string) {
    try {
      await deleteFile.mutateAsync(path);
      toast.success(`Deleted “${path}”`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function uploadFiles(fileList: FileList | null, target: string) {
    if (!fileList || fileList.length === 0) return;
    const prefix = target ? `${target.replace(/\/+$/, "")}/` : "";
    for (const file of Array.from(fileList)) {
      try {
        await uploadFile.mutateAsync({ path: `${prefix}${file.name}`, file });
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(error)}`);
      }
    }
  }

  function renderEntries(entries: Entry[], depth: number) {
    return entries.map((entry) => {
      if (entry.type === "dir") {
        const isCollapsed = collapsed.has(entry.path);
        return (
          <div key={`dir:${entry.path}`}>
            <div
              className="group flex items-center gap-1 rounded-sm pr-1 hover:bg-accent"
              style={{ paddingLeft: depth * 12 + 4 }}
            >
              <button
                type="button"
                onClick={() => toggle(entry.path)}
                className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left text-sm"
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                {isCollapsed ? (
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{entry.name}</span>
              </button>
              <button
                type="button"
                aria-label={`Upload into ${entry.path}`}
                className="hidden size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground group-hover:flex"
                onClick={() => {
                  setUploadTarget(entry.path);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="size-3.5" />
              </button>
            </div>
            {!isCollapsed && renderEntries(entry.children, depth + 1)}
          </div>
        );
      }

      const isActive = entry.path === activePath;
      return (
        <div
          key={`file:${entry.path}`}
          className={cn(
            "group flex items-center gap-1 rounded-sm pr-1 hover:bg-accent",
            isActive && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <button
            type="button"
            onClick={() => onSelect(entry.path)}
            className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left text-sm"
          >
            {entry.isBinary ? (
              <FileImage className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{entry.name}</span>
          </button>
          <button
            type="button"
            aria-label={`Delete ${entry.path}`}
            className="hidden size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive group-hover:flex"
            onClick={() => void handleDelete(entry.path)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      );
    });
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        dragActive && "ring-2 ring-inset ring-ring",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        void uploadFiles(event.dataTransfer.files, uploadTarget);
        setUploadTarget("");
      }}
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b px-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="New file"
          onClick={() => {
            setDraftPath("");
            setDialog("file");
          }}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="New folder"
          onClick={() => {
            setDraftPath("");
            setDialog("folder");
          }}
        >
          <FolderPlus className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Upload file"
          onClick={() => {
            setUploadTarget("");
            fileInputRef.current?.click();
          }}
        >
          <Upload className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            void uploadFiles(event.target.files, uploadTarget);
            setUploadTarget("");
            event.target.value = "";
          }}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1">
          {tree.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No files yet. Create or drop files here.
            </p>
          ) : (
            renderEntries(tree, 0)
          )}
        </div>
      </ScrollArea>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "folder" ? "New folder" : "New file"}
            </DialogTitle>
            <DialogDescription>
              Enter a path relative to the project root, e.g.{" "}
              <code>chapters/intro.tex</code>.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="tree-path">Path</Label>
              <Input
                id="tree-path"
                value={draftPath}
                autoFocus
                placeholder={dialog === "folder" ? "chapters" : "chapters/intro.tex"}
                onChange={(event) => setDraftPath(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={draftPath.trim().length === 0 || saveFile.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
