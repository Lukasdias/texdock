"""WebSocket connection registry, keyed by project."""

from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = {}

    async def connect(self, project_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(project_id, set()).add(websocket)

    def disconnect(self, project_id: UUID, websocket: WebSocket) -> None:
        sockets = self._connections.get(project_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(project_id, None)

    async def broadcast(self, project_id: UUID, event: dict) -> None:
        for websocket in list(self._connections.get(project_id, ())):
            try:
                await websocket.send_json(event)
            except Exception:
                self.disconnect(project_id, websocket)
