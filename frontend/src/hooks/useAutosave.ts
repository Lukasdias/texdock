import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved";

export interface UseAutosaveOptions {
  delayMs?: number;
  enabled?: boolean;
  onSave: (value: string) => void | Promise<void>;
}

/**
 * Debounced autosave. `value` is the current draft; when it differs from the
 * last successfully saved value for `delayMs`, `onSave` runs. The baseline only
 * advances on success, so a failed save is retried on the next change.
 */
export function useAutosave(
  value: string,
  { delayMs = 2000, enabled = true, onSave }: UseAutosaveOptions,
): { status: AutosaveStatus } {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const baselineRef = useRef(value);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled || value === baselineRef.current) return undefined;

    const handle = window.setTimeout(() => {
      setStatus("saving");
      Promise.resolve()
        .then(() => onSaveRef.current(value))
        .then(() => {
          baselineRef.current = value;
          setStatus("saved");
        })
        .catch(() => {
          setStatus("idle");
        });
    }, delayMs);

    return () => window.clearTimeout(handle);
  }, [value, delayMs, enabled]);

  return { status };
}
