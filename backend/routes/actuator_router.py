from fastapi import APIRouter, Depends
from controllers import actuator_controller
from schemas.actuator_schemas import *
from utils.auth import get_current_user

router = APIRouter(prefix="/actuators", tags=["Actuator"])


@router.post("/{actuator_id}/control", response_model=ResponseSchema)
async def control_actuator_route(actuator_id: str, payload: ActuatorControl, current_user: dict = Depends(get_current_user)):
    """
    Điều khiển actuator
    POST /actuators/{actuator_id}/control
    {
      "state": true
    }
    """
    user_id = str(current_user["_id"])
    return actuator_controller.control_actuator(actuator_id, payload.state, user_id)


@router.get("/device/{device_id}", response_model=ResponseSchema)
async def get_actuators_by_device_route(device_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy danh sách actuator theo thiết bị của user"""
    user_id = str(current_user["_id"])
    return actuator_controller.get_actuators_by_device(device_id, user_id)
