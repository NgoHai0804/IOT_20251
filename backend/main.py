from fastapi import FastAPI
from routes import user_routes

app = FastAPI(title="User API")

# Include routes
app.include_router(user_routes.router)

# Optional: root endpoint
@app.get("/")
def root():
    return {"status": True, "message": "API is running", "data": None}


# uvicorn main:app --reload
