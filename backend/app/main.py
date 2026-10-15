from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings
from app.database import check_database, make_engine
from app.job_list import router as job_list_router
from app.job_details import router as job_details_router


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.engine = make_engine(settings or Settings())
        try:
            yield
        finally:
            application.state.engine.dispose()

    application = FastAPI(title="QTrace API", lifespan=lifespan)
    application.include_router(job_list_router)
    application.include_router(job_details_router)

    @application.get("/health/live")
    def live() -> dict[str, str]:
        return {"status": "ok", "service": "qtrace-api"}

    @application.get("/health/ready")
    def ready(request: Request) -> JSONResponse:
        try:
            check_database(request.app.state.engine)
        except SQLAlchemyError:
            # Do not expose database credentials, hostnames, or driver exceptions.
            return JSONResponse(
                status_code=503,
                content={"status": "not_ready", "database": "unavailable"},
            )
        return JSONResponse(content={"status": "ready", "database": "reachable"})

    return application


app = create_app()
