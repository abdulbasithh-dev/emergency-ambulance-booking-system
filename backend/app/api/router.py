from fastapi import APIRouter
from app.api.v1 import (
    auth,
    emergencies,
    ambulances,
    hospitals,
    dispatch,
    notifications,
    analytics,
    simulation,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(emergencies.router)
api_router.include_router(ambulances.router)
api_router.include_router(hospitals.router)
api_router.include_router(dispatch.router)
api_router.include_router(notifications.router)
api_router.include_router(analytics.router)
api_router.include_router(simulation.router)
