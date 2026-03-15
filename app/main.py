"""ECG Classifier — FastAPI entry point."""
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import dashboard, models, predict, visualize
from app.config import MAX_UPLOAD_SIZE

app = FastAPI(title="ECG Classifier")


class MaxUploadMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/predict" and request.method == "POST":
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_UPLOAD_SIZE:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=422,
                    content={"detail": "File too large. Maximum size is 50MB."},
                )
        return await call_next(request)


app.add_middleware(MaxUploadMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(visualize.router, prefix="/api")
app.include_router(models.router, prefix="/api")

static_path = Path(__file__).resolve().parent / "static"
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
