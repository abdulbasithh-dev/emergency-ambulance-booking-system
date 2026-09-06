import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.api.router import api_router
from app.websocket.connection_manager import manager
from seed_data import seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("resq.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and demo data exist
    logger.info("Starting up ResQ Dispatch Platform...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        await seed()
    except Exception as e:
        logger.warning(f"Seed note: {e}")
    yield
    logger.info("Shutting down ResQ Dispatch Platform...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Emergency Response & Real-Time Ambulance Tracking SaaS API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API under both /api/v1 and /api for backwards compatibility
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "platform": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "status": "OPERATIONAL",
        "docs": "/docs",
        "version": "1.0.0",
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

# --- Real-Time WebSocket Endpoints ---

@app.websocket("/ws/user/{user_id}")
async def websocket_user(websocket: WebSocket, user_id: int):
    await manager.connect_user(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Respond to heartbeats/ping
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_user(websocket, user_id)
    except Exception as e:
        logger.warning(f"WS error for user {user_id}: {e}")
        manager.disconnect_user(websocket, user_id)

@app.websocket("/ws/driver/{driver_id}")
async def websocket_driver(websocket: WebSocket, driver_id: int):
    await manager.connect_driver(websocket, driver_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_driver(websocket, driver_id)
    except Exception as e:
        logger.warning(f"WS error for driver {driver_id}: {e}")
        manager.disconnect_driver(websocket, driver_id)

@app.websocket("/ws/hospital/{hospital_id}")
async def websocket_hospital(websocket: WebSocket, hospital_id: int):
    await manager.connect_hospital(websocket, hospital_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_hospital(websocket, hospital_id)
    except Exception as e:
        logger.warning(f"WS error for hospital {hospital_id}: {e}")
        manager.disconnect_hospital(websocket, hospital_id)

@app.websocket("/ws/dispatcher")
async def websocket_dispatcher(websocket: WebSocket):
    await manager.connect_dispatcher(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_dispatcher(websocket)
    except Exception as e:
        logger.warning(f"WS error for dispatcher: {e}")
        manager.disconnect_dispatcher(websocket)
