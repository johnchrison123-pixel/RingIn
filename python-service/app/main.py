"""
RingIn Python ML & Analytics Service
Provides: recommendations, matching, content moderation, feed ranking, analytics.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import recommendations, matching, detection, feed, analytics, ai_features

load_dotenv()

app = FastAPI(
    title="RingIn ML Service",
    description="ML-powered recommendations, matching, moderation, and analytics for RingIn",
    version="1.0.0",
)

# CORS - allow frontend to call this service
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS + ["*"] if "*" in ALLOWED_ORIGINS else ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(recommendations.router, prefix="/api/recommend", tags=["recommendations"])
app.include_router(matching.router, prefix="/api/match", tags=["matching"])
app.include_router(detection.router, prefix="/api/detect", tags=["detection"])
app.include_router(feed.router, prefix="/api/feed", tags=["feed"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(ai_features.router, prefix="/api/ai", tags=["ai"])


@app.get("/")
def root():
    return {
        "service": "RingIn ML Service",
        "version": "1.0.0",
        "status": "healthy",
        "endpoints": {
            "recommendations": "/api/recommend/*",
            "matching": "/api/match/*",
            "detection": "/api/detect/*",
            "feed": "/api/feed/*",
            "analytics": "/api/analytics/*",
            "ai": "/api/ai/*",
            "docs": "/docs",
        },
    }


@app.get("/health")
def health():
    return {"status": "ok"}
