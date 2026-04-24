from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import Settings, get_settings
from app.core.database import init_db
from app.routes import api_router


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="Générateur de courses multi-drives",
        version=settings.app_version,
        debug=settings.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    app.include_router(api_router)

    @app.get("/health")
    def health():
        return {"status": "ok", "version": settings.app_version}

    _mount_frontend(app, settings.frontend_dist)
    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    if not dist.exists():
        return

    assets_dir = dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    def serve_index():
        return FileResponse(str(dist / "index.html"))

    @app.get("/manifest.json")
    def serve_manifest():
        return FileResponse(str(dist / "manifest.json"))

    @app.get("/sw.js")
    def serve_sw():
        return FileResponse(str(dist / "sw.js"))

    @app.get("/icon-{w}x{h}.png")
    def serve_icon(w: int, h: int):
        icon = dist / f"icon-{w}x{h}.png"
        if not icon.exists():
            raise HTTPException(status_code=404)
        return FileResponse(str(icon))


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
