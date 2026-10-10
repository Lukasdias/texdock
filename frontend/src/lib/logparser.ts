export type ProblemKind = "error" | "warning";

export interface Problem {
  kind: ProblemKind;
  file: string | null;
  line: number | null;
  message: string;
}

const OPEN_FILE = /\(\.\/([^\s()]+)/;
const ERROR_LINE = /^l\.(\d+)/;
const WARNING = /^(?:LaTeX|Package\s+\S+)\s+Warning:\s*(.*)$/;

/**
 * Mirror of the backend compile-log parser so problems can be shown before a
 * websocket event arrives. Returns entries in log (file) order.
 */
export function parseProblems(log: string): Problem[] {
  const problems: Problem[] = [];
  let currentFile: string | null = null;
  let pendingError: { message: string; file: string | null } | null = null;

  const flushPending = (line: number | null) => {
    if (!pendingError) return;
    problems.push({
      kind: "error",
      file: pendingError.file,
      line,
      message: pendingError.message,
    });
    pendingError = null;
  };

  for (const raw of log.split(/\r?\n/)) {
    const openMatch = raw.match(OPEN_FILE);
    if (openMatch) currentFile = openMatch[1];

    const trimmed = raw.trimStart();

    if (pendingError) {
      const lineMatch = trimmed.match(ERROR_LINE);
      if (lineMatch) {
        flushPending(Number(lineMatch[1]));
        continue;
      }
    }

    if (trimmed.startsWith("!")) {
      flushPending(null);
      pendingError = { message: trimmed.slice(1).trim(), file: currentFile };
      continue;
    }

    const warningMatch = trimmed.match(WARNING);
    if (warningMatch) {
      let message = warningMatch[1];
      let line: number | null = null;
      const lineMatch = message.match(/on input line (\d+)/);
      if (lineMatch) {
        line = Number(lineMatch[1]);
        message = message.replace(/on input line \d+\.?\s*$/, "").trim();
      }
      problems.push({ kind: "warning", file: currentFile, line, message: message.trim() });
    }
  }

  flushPending(null);
  return problems;
}
