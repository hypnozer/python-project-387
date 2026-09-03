from __future__ import annotations

from datetime import date, datetime, time
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


EventTypeId = Annotated[
    str,
    Field(min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
]
Title = Annotated[str, Field(min_length=1, max_length=120)]
Description = Annotated[str, Field(min_length=1, max_length=2000)]
DurationMinutes = Annotated[int, Field(ge=1, le=1440)]
Email = Annotated[
    str,
    Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"),
]


class DayOfWeek(StrEnum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class AvailabilityInterval(ApiModel):
    starts_at: time
    ends_at: time


class WeeklyAvailability(ApiModel):
    day_of_week: DayOfWeek
    intervals: list[AvailabilityInterval]


class Owner(ApiModel):
    id: UUID
    name: Title
    time_zone: str = Field(min_length=1)
    weekly_availability: list[WeeklyAvailability]


class EventType(ApiModel):
    id: EventTypeId
    title: Title
    description: Description
    duration_minutes: DurationMinutes


class CreateEventTypeRequest(EventType):
    pass


class Slot(ApiModel):
    event_type_id: EventTypeId
    starts_at: datetime
    ends_at: datetime


class SlotWindow(ApiModel):
    starts_on: date
    ends_on: date
    owner_time_zone: str
    slots: list[Slot]


class Guest(ApiModel):
    name: Title
    email: Email


class Booking(ApiModel):
    id: UUID
    event_type_id: EventTypeId
    event_type_title: str
    duration_minutes: int
    guest: Guest
    starts_at: datetime
    ends_at: datetime
    created_at: datetime


class CreateBookingRequest(ApiModel):
    event_type_id: EventTypeId
    starts_at: datetime
    guest: Guest

    @field_validator("starts_at")
    @classmethod
    def require_utc_offset(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("startsAt must include a UTC offset")
        return value


class ErrorCode(StrEnum):
    INVALID_REQUEST = "INVALID_REQUEST"
    EVENT_TYPE_NOT_FOUND = "EVENT_TYPE_NOT_FOUND"
    EVENT_TYPE_ID_EXISTS = "EVENT_TYPE_ID_EXISTS"
    SLOT_OUTSIDE_BOOKING_WINDOW = "SLOT_OUTSIDE_BOOKING_WINDOW"
    SLOT_NOT_OFFERED = "SLOT_NOT_OFFERED"
    SLOT_UNAVAILABLE = "SLOT_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ApiError(ApiModel):
    code: ErrorCode
    message: str
