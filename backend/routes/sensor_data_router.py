from fastapi import APIRouter, Depends, Query
from controllers import sensor_data_controller
from schemas.sensor_data_schemas import ResponseSchema
from utils.auth import get_current_user
from typing import Optional


router = APIRouter(prefix="/sensor-data", tags=["SensorData"])


@router.get("/", response_model=ResponseSchema)
async def get_sensor_data_route(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    sensor_id: Optional[str] = Query(None, description="Filter by sensor ID"),
    sensor_type: Optional[str] = Query(None, description="Filter by sensor type"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    start_time: Optional[str] = Query(None, description="Start time in ISO format (e.g., 2024-01-01T00:00:00Z)"),
    end_time: Optional[str] = Query(None, description="End time in ISO format (e.g., 2024-01-01T23:59:59Z)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy dữ liệu sensor từ database
    
    - **device_id**: Lọc theo device ID (optional)
    - **sensor_id**: Lọc theo sensor ID (optional)
    - **sensor_type**: Lọc theo loại sensor (optional)
    - **limit**: Số lượng records tối đa (1-1000, mặc định: 100)
    - **start_time**: Thời gian bắt đầu (ISO format)
    - **end_time**: Thời gian kết thúc (ISO format)
    
    Trả về danh sách dữ liệu sensor, sắp xếp theo timestamp giảm dần (mới nhất trước)
    """
    return sensor_data_controller.get_sensor_data(
        current_user,
        device_id=device_id,
        sensor_id=sensor_id,
        sensor_type=sensor_type,
        limit=limit,
        start_time=start_time,
        end_time=end_time
    )


@router.get("/latest", response_model=ResponseSchema)
async def get_latest_sensor_data_route(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    sensor_id: Optional[str] = Query(None, description="Filter by sensor ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy dữ liệu sensor mới nhất cho mỗi sensor
    
    - **device_id**: Lọc theo device ID (optional)
    - **sensor_id**: Lọc theo sensor ID (optional)
    
    Trả về dữ liệu mới nhất của mỗi sensor
    """
    return sensor_data_controller.get_latest_sensor_data(
        current_user,
        device_id=device_id,
        sensor_id=sensor_id
    )


@router.get("/statistics", response_model=ResponseSchema)
async def get_sensor_statistics_route(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    sensor_id: Optional[str] = Query(None, description="Filter by sensor ID"),
    sensor_type: Optional[str] = Query(None, description="Filter by sensor type"),
    start_time: Optional[str] = Query(None, description="Start time in ISO format"),
    end_time: Optional[str] = Query(None, description="End time in ISO format"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy thống kê dữ liệu sensor (min, max, avg, count)
    
    - **device_id**: Lọc theo device ID (optional)
    - **sensor_id**: Lọc theo sensor ID (optional)
    - **sensor_type**: Lọc theo loại sensor (optional)
    - **start_time**: Thời gian bắt đầu (ISO format)
    - **end_time**: Thời gian kết thúc (ISO format)
    
    Trả về thống kê: count, min_value, max_value, avg_value cho mỗi sensor
    """
    return sensor_data_controller.get_sensor_statistics(
        current_user,
        device_id=device_id,
        sensor_id=sensor_id,
        sensor_type=sensor_type,
        start_time=start_time,
        end_time=end_time
    )


@router.get("/trends", response_model=ResponseSchema)
async def get_sensor_trends_route(
    device_id: Optional[str] = Query(None, description="Filter by device ID (nếu có thì chỉ lấy dữ liệu của device này)"),
    room: Optional[str] = Query(None, description="Filter by room/location (nếu có thì lấy dữ liệu của tất cả devices trong phòng)"),
    hours: int = Query(24, ge=1, le=168, description="Number of hours to look back (1-168, default: 24)"),
    limit_per_type: int = Query(100, ge=10, le=500, description="Maximum data points per sensor type (10-500, default: 100)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy dữ liệu trends đã được format sẵn cho charts
    
    - **device_id**: Lọc theo device ID (nếu có thì chỉ lấy dữ liệu của device này)
    - **room**: Lọc theo room/location (nếu có thì lấy dữ liệu của tất cả devices trong phòng)
    - **hours**: Số giờ quay lại để lấy dữ liệu (1-168, mặc định: 24)
    - **limit_per_type**: Số điểm dữ liệu tối đa cho mỗi loại sensor (10-500, mặc định: 100)
    
    Lưu ý: Nếu có cả device_id và room, device_id sẽ được ưu tiên.
    Nếu không có cả hai, lấy tất cả devices của user.
    
    Trả về dữ liệu đã được format sẵn theo sensor type:
    - temperature: Array of {time, value}
    - humidity: Array of {time, value}
    - energy: Array of {time, value}
    
    Dữ liệu được sắp xếp theo thời gian và tự động giới hạn số lượng điểm để tối ưu hiển thị.
    """
    return sensor_data_controller.get_sensor_trends(
        current_user,
        device_id=device_id,
        room=room,
        hours=hours,
        limit_per_type=limit_per_type
    )

