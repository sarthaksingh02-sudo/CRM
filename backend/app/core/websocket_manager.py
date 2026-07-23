"""
WebSocket Manager — handles real-time visual client synchronization for CRM alerts, task updates, and chats.
"""
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        payload = json.dumps(data)
        stale = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send websocket payload: {e}")
                stale.append(connection)
        
        # Prune dead connections
        for connection in stale:
            self.disconnect(connection)

manager = ConnectionManager()
