from fastapi import APIRouter, Depends, Query
from controllers import notification_controller
from schemas.sensor_schemas import ResponseSchema
from utils.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=ResponseSchema)
async def get_notifications_route(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of notifications to return"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy danh sách notifications của user
    GET /notifications?limit=100&unread_only=false
    """
    user_id = str(current_user["_id"])
    return notification_controller.get_notifications(user_id, limit, unread_only)


@router.post("/{notification_id}/read", response_model=ResponseSchema)
async def mark_notification_as_read_route(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Đánh dấu notification là đã đọc
    POST /notifications/{notification_id}/read
    """
    user_id = str(current_user["_id"])
    return notification_controller.mark_notification_as_read(user_id, notification_id)


@router.post("/read-all", response_model=ResponseSchema)
async def mark_all_notifications_as_read_route(
    current_user: dict = Depends(get_current_user)
):
    """
    Đánh dấu tất cả notifications của user là đã đọc
    POST /notifications/read-all
    """
    user_id = str(current_user["_id"])
    return notification_controller.mark_all_notifications_as_read(user_id)


@router.get("/unread-count", response_model=ResponseSchema)
async def get_unread_count_route(
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy số lượng notifications chưa đọc
    GET /notifications/unread-count
    """
    user_id = str(current_user["_id"])
    return notification_controller.get_unread_count(user_id)
