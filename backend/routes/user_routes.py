from fastapi import APIRouter, Depends
from controllers import user_controller
from schemas.user_schemas import *
from utils.auth import get_current_user
from controllers.user_controller import *


router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=ResponseSchema)
async def register_user_route(payload: UserRegister):
    return register_user(payload)

@router.post("/login", response_model=ResponseSchema)
async def login_user_route(payload: UserLogin):
    return login_user(payload)


@router.post("/logout", response_model=ResponseSchema)
async def login_user_route(payload: UserLogin):
    return logout_user(payload)


@router.get("/info", response_model=ResponseSchema)
async def info_user_route(current_user: dict = Depends(get_current_user)):
    return info_user(current_user)


@router.put("/change-info", response_model=ResponseSchema)
async def change_user_info_route(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    return change_user_info(payload, current_user)
