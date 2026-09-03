from __future__ import annotations

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import (
    ApiError,
    Booking,
    CreateBookingRequest,
    CreateEventTypeRequest,
    ErrorCode,
    EventType,
    EventTypeId,
    Owner,
    SlotWindow,
)
from .store import InMemoryStore, StoreError


def error_response(status_code: int, code: ErrorCode, message: str) -> JSONResponse:
    body = ApiError(code=code, message=message)
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json", by_alias=True))


def create_app(store: InMemoryStore | None = None) -> FastAPI:
    storage = store or InMemoryStore()
    application = FastAPI(
        title="Calendar Booking API",
        version="1.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.exception_handler(StoreError)
    async def handle_store_error(_request: Request, exception: StoreError) -> JSONResponse:
        return error_response(exception.status_code, exception.code, exception.message)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exception: RequestValidationError,
    ) -> JSONResponse:
        errors = exception.errors()
        is_syntax_error = any(
            error.get("type") == "json_invalid" or error.get("loc", [None])[0] == "path"
            for error in errors
        )
        status_code = 400 if is_syntax_error else 422
        return error_response(status_code, ErrorCode.INVALID_REQUEST, "Request validation failed.")

    @application.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, _exception: Exception) -> JSONResponse:
        return error_response(500, ErrorCode.INTERNAL_ERROR, "Internal server error.")

    @application.get("/owner", response_model=Owner)
    def get_owner() -> Owner:
        return storage.owner

    @application.get("/owner/bookings", response_model=list[Booking])
    def list_upcoming_bookings() -> list[Booking]:
        return storage.list_upcoming_bookings()

    @application.get("/event-types", response_model=list[EventType])
    def list_event_types() -> list[EventType]:
        return storage.list_event_types()

    @application.post("/event-types", response_model=EventType, status_code=201)
    def create_event_type(request: CreateEventTypeRequest, response: Response) -> EventType:
        event_type = storage.create_event_type(request)
        response.headers["Location"] = f"/event-types/{event_type.id}"
        return event_type

    @application.get("/event-types/{eventTypeId}", response_model=EventType)
    def get_event_type(eventTypeId: EventTypeId) -> EventType:
        return storage.get_event_type(eventTypeId)

    @application.get("/event-types/{eventTypeId}/slots", response_model=SlotWindow)
    def list_available_slots(eventTypeId: EventTypeId) -> SlotWindow:
        return storage.list_slots(eventTypeId)

    @application.post("/bookings", response_model=Booking, status_code=201)
    def create_booking(request: CreateBookingRequest, response: Response) -> Booking:
        booking = storage.create_booking(request)
        response.headers["Location"] = f"/bookings/{booking.id}"
        return booking

    return application


app = create_app()
