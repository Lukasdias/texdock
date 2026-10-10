import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved";

export interface UseAutosaveOptions {
  delayMs?: number;
  enabled?: boolean;
  /** Content that must not be re-saved (e.g. the freshly loaded file body). */
  baseline?: string;
  onSave: (value: string) => void | Promise<void>;
}

/**
 * Debounced autosave. `value` is the current draft; when it differs from the
 * last successfully saved value for `delayMs`, `onSave` runs. The baseline only
 * advances on success, so a failed save is retried on the next change. When
 * `baseline` changes (e.g. a file finished loading) it resets the baseline so
 * the loaded content is not treated as an edit.
 */
export function useAutosave(
  value: string,
  { delayMs = 2000, enabled = true, baseline, onSave }: UseAutosaveOptions,
): { status: AutosaveStatus } {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const baselineRef = useRef(value);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (baseline !== undefined) {
      baselineRef.current = baseline;
    }
  }, [baseline]);

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
