"""
Utility functions for handling Vietnam timezone (Asia/Ho_Chi_Minh)
"""
from datetime import datetime
import pytz

# Vietnam timezone
VIETNAM_TZ = pytz.timezone('Asia/Ho_Chi_Minh')


def get_vietnam_now() -> datetime:
    """
    Lấy thời gian hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
    Returns: datetime object với timezone Việt Nam
    """
    return datetime.now(VIETNAM_TZ)


def get_vietnam_now_naive() -> datetime:
    """
    Lấy thời gian hiện tại theo múi giờ Việt Nam nhưng không có timezone info (naive datetime)
    Phù hợp để lưu vào MongoDB (MongoDB lưu datetime dạng naive)
    Returns: naive datetime object (không có timezone info)
    """
    return datetime.now(VIETNAM_TZ).replace(tzinfo=None)


def convert_to_vietnam(dt: datetime) -> datetime:
    """
    Chuyển đổi datetime sang timezone Việt Nam
    Nếu datetime là naive (không có timezone), giả định là UTC
    Nếu datetime đã có timezone, chuyển đổi sang Việt Nam
    """
    if dt.tzinfo is None:
        # Nếu là naive datetime, giả định là UTC
        dt = pytz.UTC.localize(dt)
    return dt.astimezone(VIETNAM_TZ)


def convert_to_vietnam_naive(dt: datetime) -> datetime:
    """
    Chuyển đổi datetime sang timezone Việt Nam và trả về naive datetime
    Phù hợp để lưu vào MongoDB
    """
    vietnam_dt = convert_to_vietnam(dt)
    return vietnam_dt.replace(tzinfo=None)

