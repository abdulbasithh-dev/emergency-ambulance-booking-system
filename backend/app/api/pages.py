import os
from pathlib import Path
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core.config import settings

# Base directory for templates
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

pages_router = APIRouter(include_in_schema=False)


@pages_router.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    return templates.TemplateResponse(
        "pages/index.html",
        {
            "request": request,
            "project_name": settings.PROJECT_NAME,
            "tagline": settings.TAGLINE,
            "active_page": "portal",
        },
    )


@pages_router.get("/citizen", response_class=HTMLResponse)
async def citizen_page(request: Request):
    return templates.TemplateResponse(
        "pages/citizen.html",
        {
            "request": request,
            "project_name": settings.PROJECT_NAME,
            "tagline": settings.TAGLINE,
            "active_page": "citizen",
        },
    )


@pages_router.get("/driver", response_class=HTMLResponse)
async def driver_page(request: Request):
    return templates.TemplateResponse(
        "pages/driver.html",
        {
            "request": request,
            "project_name": settings.PROJECT_NAME,
            "tagline": settings.TAGLINE,
            "active_page": "driver",
        },
    )


@pages_router.get("/hospital", response_class=HTMLResponse)
async def hospital_page(request: Request):
    return templates.TemplateResponse(
        "pages/hospital.html",
        {
            "request": request,
            "project_name": settings.PROJECT_NAME,
            "tagline": settings.TAGLINE,
            "active_page": "hospital",
        },
    )


@pages_router.get("/dispatcher", response_class=HTMLResponse)
async def dispatcher_page(request: Request):
    return templates.TemplateResponse(
        "pages/dispatcher.html",
        {
            "request": request,
            "project_name": settings.PROJECT_NAME,
            "tagline": settings.TAGLINE,
            "active_page": "dispatcher",
        },
    )


@pages_router.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse(
        "pages/admin.html",
        {
            "request": request,
            "project_name": settings.PROJECT_NAME,
            "tagline": settings.TAGLINE,
            "active_page": "admin",
        },
    )
