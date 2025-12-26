from fastapi import status
from fastapi.responses import JSONResponse
from utils.database import notifications_collection, sanitize_for_json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def get_notifications(user_id: str, limit: int = 20, unread_only: bool = False):
    """
    Lấy danh sách notifications của user
    GET /notifications?limit=100&unread_only=false
    """
    try:
        query = {"user_id": user_id}
        
        if unread_only:
            query["read"] = False
        
        # Lấy notifications, sắp xếp theo created_at giảm dần (mới nhất trước)
        notifications = list(
            notifications_collection.find(query)
            .sort("created_at", -1)
            .limit(limit)
        )
        
        # Convert ObjectId và datetime, đảm bảo có field "id"
        for notif in notifications:
            # Ưu tiên message_id làm id, nếu không có thì dùng _id
            if "message_id" in notif:
                notif["id"] = notif["message_id"]
            elif "_id" in notif:
                notif["id"] = str(notif["_id"])
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Notifications retrieved successfully",
                "data": {"notifications": sanitize_for_json(notifications)}
            }
        )
    
    except Exception as e:
        logger.error(f"Lỗi lấy thông báo: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


def mark_notification_as_read(user_id: str, notification_id: str):
    """
    Đánh dấu notification là đã đọc
    POST /notifications/{notification_id}/read
    """
    try:
        # Kiểm tra notification thuộc về user
        notification = notifications_collection.find_one({
            "message_id": notification_id,
            "user_id": user_id
        })
        
        if not notification:
            # Thử tìm với _id nếu message_id không tìm thấy
            from bson import ObjectId
            try:
                notification = notifications_collection.find_one({
                    "_id": ObjectId(notification_id),
                    "user_id": user_id
                })
            except:
                pass
        
        if not notification:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Notification not found",
                    "data": None
                }
            )
        
        # Cập nhật read = true
        notifications_collection.update_one(
            {"message_id": notification_id, "user_id": user_id},
            {"$set": {"read": True}}
        )
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Notification marked as read",
                "data": {"notification_id": notification_id}
            }
        )
    
    except Exception as e:
        logger.error(f"Lỗi đánh dấu thông báo đã đọc: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


def mark_all_notifications_as_read(user_id: str):
    """
    Đánh dấu tất cả notifications của user là đã đọc
    POST /notifications/read-all
    """
    try:
        result = notifications_collection.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True}}
        )
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "All notifications marked as read",
                "data": {"updated_count": result.modified_count}
            }
        )
    
    except Exception as e:
        logger.error(f"Lỗi đánh dấu tất cả thông báo đã đọc: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


def get_unread_count(user_id: str):
    """
    Lấy số lượng notifications chưa đọc
    GET /notifications/unread-count
    """
    try:
        count = notifications_collection.count_documents({
            "user_id": user_id,
            "read": False
        })
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Unread count retrieved successfully",
                "data": {"count": count}
            }
        )
    
    except Exception as e:
        logger.error(f"Lỗi lấy số lượng chưa đọc: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )
