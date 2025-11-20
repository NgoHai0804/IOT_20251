from fastapi import APIRouter, Depends, HTTPException
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
async def login_user_route(payload: UserLogin):
    return user_controller.logout_user(current_user)


@router.get("/info", response_model=ResponseSchema)
async def info_user_route(current_user: dict = Depends(get_current_user)):
    return user_controller.info_user(current_user)


@router.post("/update", response_model=ResponseSchema)
async def change_user_info_route(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    return user_controller.change_user_info(payload, current_user)