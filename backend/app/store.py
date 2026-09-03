from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from threading import RLock
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from .models import (
    AvailabilityInterval,
    Booking,
    CreateBookingRequest,
    CreateEventTypeRequest,
    DayOfWeek,
    ErrorCode,
    EventType,
    Owner,
    Slot,
    SlotWindow,
    WeeklyAvailability,
)


class StoreError(Exception):
    def __init__(self, status_code: int, code: ErrorCode, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


WEEKDAYS = list(DayOfWeek)


def default_owner() -> Owner:
    workday = [AvailabilityInterval(starts_at=time(9), ends_at=time(18))]
    return Owner(
        id=UUID("617ac74f-7dcc-4f3e-aac4-20c2c34db97d"),
        name="Александр",
        time_zone="Europe/Moscow",
        weekly_availability=[
            WeeklyAvailability(
                day_of_week=day,
                intervals=workday if day.value in {
                    "monday", "tuesday", "wednesday", "thursday", "friday"
                } else [],
            )
            for day in WEEKDAYS
        ],
    )


class InMemoryStore:
    def __init__(
        self,
        *,
        owner: Owner | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.owner = owner or default_owner()
        self._clock = clock or (lambda: datetime.now(UTC))
        self._event_types: dict[str, EventType] = {}
        self._bookings: dict[UUID, Booking] = {}
        self._lock = RLock()

    def list_event_types(self) -> list[EventType]:
        with self._lock:
            return sorted(self._event_types.values(), key=lambda item: (item.title.casefold(), item.id))

    def create_event_type(self, request: CreateEventTypeRequest) -> EventType:
        with self._lock:
            if request.id in self._event_types:
                raise StoreError(409, ErrorCode.EVENT_TYPE_ID_EXISTS, "Event type id already exists.")
            event_type = EventType.model_validate(request.model_dump())
            self._event_types[event_type.id] = event_type
            return event_type

    def get_event_type(self, event_type_id: str) -> EventType:
        with self._lock:
            event_type = self._event_types.get(event_type_id)
            if event_type is None:
                raise StoreError(404, ErrorCode.EVENT_TYPE_NOT_FOUND, "Event type was not found.")
            return event_type

    def list_upcoming_bookings(self) -> list[Booking]:
        now = self._now()
        with self._lock:
            return sorted(
                (booking for booking in self._bookings.values() if booking.starts_at > now),
                key=lambda booking: booking.starts_at.astimezone(UTC),
            )

    def list_slots(self, event_type_id: str) -> SlotWindow:
        with self._lock:
            event_type = self.get_event_type(event_type_id)
            now = self._now()
            owner_zone = ZoneInfo(self.owner.time_zone)
            starts_on = now.astimezone(owner_zone).date()
            ends_on = starts_on + timedelta(days=13)
            slots = self._available_slots(event_type, starts_on, ends_on, now, owner_zone)
            return SlotWindow(
                starts_on=starts_on,
                ends_on=ends_on,
                owner_time_zone=self.owner.time_zone,
                slots=slots,
            )

    def create_booking(self, request: CreateBookingRequest) -> Booking:
        with self._lock:
            event_type = self.get_event_type(request.event_type_id)
            now = self._now()
            owner_zone = ZoneInfo(self.owner.time_zone)
            requested_start = request.starts_at.astimezone(owner_zone)
            starts_on = now.astimezone(owner_zone).date()
            ends_on = starts_on + timedelta(days=13)

            if requested_start <= now.astimezone(owner_zone) or not (
                starts_on <= requested_start.date() <= ends_on
            ):
                raise StoreError(
                    422,
                    ErrorCode.SLOT_OUTSIDE_BOOKING_WINDOW,
                    "Slot is outside the rolling booking window.",
                )

            requested_end = self._offered_end(event_type, requested_start)
            if requested_end is None:
                raise StoreError(422, ErrorCode.SLOT_NOT_OFFERED, "Start does not match an offered slot.")

            if self._overlaps_booking(requested_start, requested_end):
                raise StoreError(409, ErrorCode.SLOT_UNAVAILABLE, "Slot is no longer available.")

            booking = Booking(
                id=uuid4(),
                event_type_id=event_type.id,
                event_type_title=event_type.title,
                duration_minutes=event_type.duration_minutes,
                guest=request.guest,
                starts_at=requested_start,
                ends_at=requested_end,
                created_at=now.astimezone(UTC),
            )
            self._bookings[booking.id] = booking
            return booking

    def _available_slots(
        self,
        event_type: EventType,
        starts_on: date,
        ends_on: date,
        now: datetime,
        owner_zone: ZoneInfo,
    ) -> list[Slot]:
        slots: list[Slot] = []
        current_date = starts_on
        while current_date <= ends_on:
            availability = self._availability_for(current_date)
            for interval in availability:
                starts_at = datetime.combine(current_date, interval.starts_at, owner_zone)
                interval_end = datetime.combine(current_date, interval.ends_at, owner_zone)
                step = timedelta(minutes=event_type.duration_minutes)
                while starts_at + step <= interval_end:
                    ends_at = starts_at + step
                    if starts_at > now.astimezone(owner_zone) and not self._overlaps_booking(starts_at, ends_at):
                        slots.append(
                            Slot(
                                event_type_id=event_type.id,
                                starts_at=starts_at,
                                ends_at=ends_at,
                            )
                        )
                    starts_at += step
            current_date += timedelta(days=1)
        return slots

    def _offered_end(self, event_type: EventType, starts_at: datetime) -> datetime | None:
        step = timedelta(minutes=event_type.duration_minutes)
        for interval in self._availability_for(starts_at.date()):
            interval_start = datetime.combine(starts_at.date(), interval.starts_at, starts_at.tzinfo)
            interval_end = datetime.combine(starts_at.date(), interval.ends_at, starts_at.tzinfo)
            candidate = interval_start
            while candidate + step <= interval_end:
                if candidate == starts_at:
                    return candidate + step
                candidate += step
        return None

    def _availability_for(self, target_date: date) -> list[AvailabilityInterval]:
        day = WEEKDAYS[target_date.weekday()]
        for weekly in self.owner.weekly_availability:
            if weekly.day_of_week == day:
                return weekly.intervals
        return []

    def _overlaps_booking(self, starts_at: datetime, ends_at: datetime) -> bool:
        starts_utc = starts_at.astimezone(UTC)
        ends_utc = ends_at.astimezone(UTC)
        return any(
            starts_utc < booking.ends_at.astimezone(UTC)
            and booking.starts_at.astimezone(UTC) < ends_utc
            for booking in self._bookings.values()
        )

    def _now(self) -> datetime:
        now = self._clock()
        if now.tzinfo is None or now.utcoffset() is None:
            raise RuntimeError("Clock must return a timezone-aware datetime")
        return now
