from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
async def list_user_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(
            or_(
                Notification.user_id == current_user.id,
                Notification.role_target == current_user.role.value,
                Notification.role_target == "ALL",
            )
        )
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await db.get(Notification, notification_id)
    if notif:
        notif.is_read = True
        await db.commit()
    return {"status": "success"}

@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(
            or_(
                Notification.user_id == current_user.id,
                Notification.role_target == current_user.role.value,
            )
        )
    )
    res = await db.execute(stmt)
    for n in res.scalars().all():
        n.is_read = True
    await db.commit()
    return {"status": "all_marked_read"}
