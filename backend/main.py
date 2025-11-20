from fastapi import FastAPI
from routes import user_routes, user_device_router

app = FastAPI(title="User API")


# Include routes
app.include_router(user_routes.router)
app.include_router(user_device_router.router)

# Optional: root endpoint
@app.get("/")
def root():
    return {"status": True, "message": "API is running", "data": None}


# uvicorn main:app --reload
