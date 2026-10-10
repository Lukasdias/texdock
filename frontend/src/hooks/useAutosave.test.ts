import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutosave } from "./useAutosave";

interface Props {
  value: string;
  enabled: boolean;
  baseline?: string;
}

describe("useAutosave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not save a value that equals the supplied baseline", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { rerender } = renderHook(
      ({ value, enabled, baseline }: Props) =>
        useAutosave(value, { enabled, baseline, onSave, delayMs: 2000 }),
      {
        initialProps: {
          value: "",
          enabled: false,
          baseline: undefined as string | undefined,
        },
      },
    );

    rerender({ value: "loaded", enabled: true, baseline: "loaded" });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a value that differs from the baseline", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { rerender } = renderHook(
      ({ value }: Props) =>
        useAutosave(value, { enabled: true, baseline: "loaded", onSave, delayMs: 2000 }),
      { initialProps: { value: "loaded", enabled: true } },
    );

    rerender({ value: "loaded plus edit", enabled: true });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("loaded plus edit");
  });
});
