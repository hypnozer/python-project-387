from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .main import create_app


def create_deployment_app(static_dir: Path | None = None) -> FastAPI:
    frontend = (
        static_dir
        or Path(__file__).resolve().parents[2] / "frontend" / "dist"
    )
    index = frontend / "index.html"

    application = FastAPI(
        title="Calendar Booking",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    application.mount("/api", create_app())
    application.mount("/assets", StaticFiles(directory=frontend / "assets"), name="assets")

    @application.get("/{path:path}", include_in_schema=False)
    def serve_frontend(path: str) -> FileResponse:
        requested = (frontend / path).resolve()
        if frontend.resolve() in requested.parents and requested.is_file():
            return FileResponse(requested)
        return FileResponse(index)

    return application


app = create_deployment_app()
