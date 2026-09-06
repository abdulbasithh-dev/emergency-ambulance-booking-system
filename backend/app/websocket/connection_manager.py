import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger("resq.websocket")

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> Set of WebSockets (user might have multiple tabs)
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        # Maps driver_id -> Set of WebSockets
        self.driver_connections: Dict[int, Set[WebSocket]] = {}
        # Maps hospital_id -> Set of WebSockets
        self.hospital_connections: Dict[int, Set[WebSocket]] = {}
        # Dispatcher connections (dispatch command center)
        self.dispatcher_connections: Set[WebSocket] = set()

    async def connect_user(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected to WS. Total active user connections: {len(self.user_connections[user_id])}")

    def disconnect_user(self, websocket: WebSocket, user_id: int):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        logger.info(f"User {user_id} disconnected from WS.")

    async def connect_driver(self, websocket: WebSocket, driver_id: int):
        await websocket.accept()
        if driver_id not in self.driver_connections:
            self.driver_connections[driver_id] = set()
        self.driver_connections[driver_id].add(websocket)
        logger.info(f"Driver {driver_id} connected to WS.")

    def disconnect_driver(self, websocket: WebSocket, driver_id: int):
        if driver_id in self.driver_connections:
            self.driver_connections[driver_id].discard(websocket)
            if not self.driver_connections[driver_id]:
                del self.driver_connections[driver_id]
        logger.info(f"Driver {driver_id} disconnected from WS.")

    async def connect_hospital(self, websocket: WebSocket, hospital_id: int):
        await websocket.accept()
        if hospital_id not in self.hospital_connections:
            self.hospital_connections[hospital_id] = set()
        self.hospital_connections[hospital_id].add(websocket)
        logger.info(f"Hospital {hospital_id} connected to WS.")

    def disconnect_hospital(self, websocket: WebSocket, hospital_id: int):
        if hospital_id in self.hospital_connections:
            self.hospital_connections[hospital_id].discard(websocket)
            if not self.hospital_connections[hospital_id]:
                del self.hospital_connections[hospital_id]
        logger.info(f"Hospital {hospital_id} disconnected from WS.")

    async def connect_dispatcher(self, websocket: WebSocket):
        await websocket.accept()
        self.dispatcher_connections.add(websocket)
        logger.info(f"Dispatcher connected to WS. Active dispatchers: {len(self.dispatcher_connections)}")

    def disconnect_dispatcher(self, websocket: WebSocket):
        self.dispatcher_connections.discard(websocket)
        logger.info("Dispatcher disconnected from WS.")

    async def _safe_send(self, websocket: WebSocket, message: dict) -> bool:
        try:
            await websocket.send_text(json.dumps(message))
            return True
        except Exception as e:
            logger.warning(f"Error sending message on websocket: {e}")
            return False

    async def send_to_user(self, user_id: int, event: str, data: Any):
        if user_id in self.user_connections:
            message = {"event": event, "data": data}
            dead_sockets = set()
            for ws in list(self.user_connections[user_id]):
                success = await self._safe_send(ws, message)
                if not success:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.user_connections[user_id].discard(ws)

    async def send_to_driver(self, driver_id: int, event: str, data: Any):
        if driver_id in self.driver_connections:
            message = {"event": event, "data": data}
            dead_sockets = set()
            for ws in list(self.driver_connections[driver_id]):
                success = await self._safe_send(ws, message)
                if not success:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.driver_connections[driver_id].discard(ws)

    async def broadcast_to_drivers(self, event: str, data: Any):
        """Broadcast an event to all connected driver clients."""
        message = {"event": event, "data": data}
        for driver_id, sockets in list(self.driver_connections.items()):
            dead_sockets = set()
            for ws in list(sockets):
                success = await self._safe_send(ws, message)
                if not success:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.driver_connections[driver_id].discard(ws)


    async def send_to_hospital(self, hospital_id: int, event: str, data: Any):
        if hospital_id in self.hospital_connections:
            message = {"event": event, "data": data}
            dead_sockets = set()
            for ws in list(self.hospital_connections[hospital_id]):
                success = await self._safe_send(ws, message)
                if not success:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.hospital_connections[hospital_id].discard(ws)

    async def send_to_dispatchers(self, event: Any, data: Any = None):
        if isinstance(event, dict) and data is None:
            message = event
        else:
            message = {"event": event, "data": data}
        dead_sockets = set()
        for ws in list(self.dispatcher_connections):
            success = await self._safe_send(ws, message)
            if not success:
                dead_sockets.add(ws)
        for ws in dead_sockets:
            self.dispatcher_connections.discard(ws)

    async def broadcast_emergency_location(self, emergency_id: int, user_id: Any, hospital_id: Any, data: Any):
        """Broadcast emergency ambulance location update to dispatchers, citizen, and hospital."""
        await self.send_to_dispatchers("LOCATION_UPDATE", data)
        await self.send_to_dispatchers("AMBULANCE_LOCATION_UPDATE", data)
        if user_id:
            await self.send_to_user(user_id, "LOCATION_UPDATE", data)
            await self.send_to_user(user_id, "AMBULANCE_LOCATION_UPDATE", data)
        if hospital_id:
            await self.send_to_hospital(hospital_id, "LOCATION_UPDATE", data)
            await self.send_to_hospital(hospital_id, "AMBULANCE_LOCATION_UPDATE", data)

    async def broadcast_all(self, event: str, data: Any):
        """Broadcasts to all dispatchers and all active connections"""
        await self.send_to_dispatchers(event, data)
        
        # Also broadcast to users, drivers, hospitals
        message = {"event": event, "data": data}
        for uid, sockets in list(self.user_connections.items()):
            for ws in list(sockets):
                await self._safe_send(ws, message)
        for did, sockets in list(self.driver_connections.items()):
            for ws in list(sockets):
                await self._safe_send(ws, message)
        for hid, sockets in list(self.hospital_connections.items()):
            for ws in list(sockets):
                await self._safe_send(ws, message)

manager = ConnectionManager()
