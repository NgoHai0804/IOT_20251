from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from controllers import user_controller
from schemas.user_schemas import *
from utils.auth import get_current_user



router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=ResponseSchema)
async def register_user_route(payload: UserRegister):
    return user_controller.register_user(payload)

@router.post("/login", response_model=ResponseSchema)
async def login_user_route(payload: UserLogin):
    return user_controller.login_user(payload)


@router.post("/logout", response_model=ResponseSchema)
async def logout_user_route(payload: Optional[RefreshTokenRequest] = None):
    """
    Logout endpoint - không yêu cầu authentication để cho phép logout khi token hết hạn
    Chỉ cần refresh_token để thu hồi token (optional)
    """
    refresh_token = payload.refresh_token if payload else None
    return user_controller.logout_user(None, refresh_token)


@router.post("/refresh", response_model=ResponseSchema)
async def refresh_token_route(payload: RefreshTokenRequest):
    return user_controller.refresh_access_token(payload.refresh_token)


@router.get("/info", response_model=ResponseSchema)
async def info_user_route(current_user: dict = Depends(get_current_user)):
    return user_controller.info_user(current_user)


@router.post("/update", response_model=ResponseSchema)
async def change_user_info_route(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    return user_controller.change_user_info(payload, current_user)


@router.post("/change-password", response_model=ResponseSchema)
async def change_password_route(payload: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    return user_controller.change_password(payload, current_user)