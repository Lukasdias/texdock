import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import type { CompileStatus } from "@/lib/api";

const RECONNECT_DELAY_MS = 2000;

/**
 * Subscribe to compile status for a project. Events are written straight into
 * the Query cache under `queryKeys.status`; on (re)connect the log query is
 * invalidated so problems stay current when the socket was down.
 */
export function useCompileSocket(projectId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (projectId.length === 0) return undefined;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    const invalidateLog = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.log(projectId) });
    };

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/api/ws/${projectId}`,
      );

      socket.onopen = () => {
        invalidateLog();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as CompileStatus;
          queryClient.setQueryData(queryKeys.status(projectId), payload);
          invalidateLog();
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [projectId, queryClient]);
}
