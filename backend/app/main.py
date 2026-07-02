from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .api.v1.routes import router
from .core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production API for CAPTCHA Optical Character Recognition using ResNet-18",
    version=settings.VERSION,
    contact={
        "name": "AI Engineer",
        "url": "https://github.com/hardikgautam/captcha-ocr",
    },
)

# Content length limits to mitigate Denial of Service (BUG-001)
@app.middleware("http")
async def limit_content_length(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        max_size = settings.MAX_FILE_SIZE_BYTES
        # Allow larger requests for batch upload
        if request.url.path.endswith("/predict/batch"):
            max_size = settings.MAX_FILE_SIZE_BYTES * settings.MAX_BATCH_SIZE
            
        if content_length:
            try:
                if int(content_length) > max_size:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": f"Request size exceeds limit of {max_size // (1024*1024)}MB"}
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header"}
                )
    return await call_next(request)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.API_V1_STR)

@app.get("/", summary="Root endpoint")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health"
    }
