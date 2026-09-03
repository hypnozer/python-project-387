from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.store import InMemoryStore


FIXED_NOW = datetime(2026, 8, 31, 8, tzinfo=UTC)


@pytest.fixture
def client() -> TestClient:
    store = InMemoryStore(clock=lambda: FIXED_NOW)
    return TestClient(create_app(store))


def create_event_type(
    client: TestClient,
    event_type_id: str = "consultation",
    *,
    duration_minutes: int = 60,
) -> None:
    response = client.post(
        "/event-types",
        json={
            "id": event_type_id,
            "title": "Consultation",
            "description": "A focused meeting.",
            "durationMinutes": duration_minutes,
        },
    )
    assert response.status_code == 201


def booking_payload(event_type_id: str, starts_at: str) -> dict[str, object]:
    return {
        "eventTypeId": event_type_id,
        "startsAt": starts_at,
        "guest": {"name": "Guest", "email": "guest@example.com"},
    }


def test_owner_and_empty_collections(client: TestClient) -> None:
    owner = client.get("/owner")
    assert owner.status_code == 200
    assert owner.json()["timeZone"] == "Europe/Moscow"
    assert len(owner.json()["weeklyAvailability"]) == 7
    assert client.get("/event-types").json() == []
    assert client.get("/owner/bookings").json() == []


def test_event_type_lifecycle_and_duplicate_id(client: TestClient) -> None:
    create_event_type(client)

    listed = client.get("/event-types")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == "consultation"
    assert client.get("/event-types/consultation").status_code == 200

    duplicate = client.post(
        "/event-types",
        json={
            "id": "consultation",
            "title": "Another",
            "description": "Another meeting.",
            "durationMinutes": 30,
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "EVENT_TYPE_ID_EXISTS"


def test_slot_window_uses_owner_calendar_dates(client: TestClient) -> None:
    create_event_type(client)
    response = client.get("/event-types/consultation/slots")

    assert response.status_code == 200
    body = response.json()
    assert body["startsOn"] == "2026-08-31"
    assert body["endsOn"] == "2026-09-13"
    assert body["ownerTimeZone"] == "Europe/Moscow"
    assert body["slots"][0]["startsAt"] == "2026-08-31T12:00:00+03:00"
    assert all(slot["eventTypeId"] == "consultation" for slot in body["slots"])


def test_booking_is_created_and_removes_overlapping_slots(client: TestClient) -> None:
    create_event_type(client)
    payload = booking_payload("consultation", "2026-08-31T12:00:00+03:00")

    created = client.post("/bookings", json=payload)
    assert created.status_code == 201
    assert created.headers["location"].startswith("/bookings/")
    assert created.json()["endsAt"] == "2026-08-31T13:00:00+03:00"

    conflict = client.post("/bookings", json=payload)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "SLOT_UNAVAILABLE"

    available = client.get("/event-types/consultation/slots").json()["slots"]
    assert "2026-08-31T12:00:00+03:00" not in {slot["startsAt"] for slot in available}


def test_overlap_rule_applies_across_event_types_and_allows_adjacency(client: TestClient) -> None:
    create_event_type(client, "long-meeting", duration_minutes=60)
    create_event_type(client, "short-meeting", duration_minutes=30)
    assert client.post(
        "/bookings",
        json=booking_payload("long-meeting", "2026-08-31T12:00:00+03:00"),
    ).status_code == 201

    overlap = client.post(
        "/bookings",
        json=booking_payload("short-meeting", "2026-08-31T12:30:00+03:00"),
    )
    adjacent = client.post(
        "/bookings",
        json=booking_payload("short-meeting", "2026-08-31T13:00:00+03:00"),
    )

    assert overlap.status_code == 409
    assert overlap.json()["code"] == "SLOT_UNAVAILABLE"
    assert adjacent.status_code == 201


def test_invalid_booking_slots_are_classified(client: TestClient) -> None:
    create_event_type(client)

    outside = client.post(
        "/bookings",
        json=booking_payload("consultation", "2026-08-31T10:00:00+03:00"),
    )
    not_offered = client.post(
        "/bookings",
        json=booking_payload("consultation", "2026-08-31T12:30:00+03:00"),
    )

    assert outside.status_code == 422
    assert outside.json()["code"] == "SLOT_OUTSIDE_BOOKING_WINDOW"
    assert not_offered.status_code == 422
    assert not_offered.json()["code"] == "SLOT_NOT_OFFERED"


def test_validation_and_not_found_errors_follow_contract(client: TestClient) -> None:
    missing = client.get("/event-types/missing")
    bad_path = client.get("/event-types/INVALID_ID")
    malformed = client.post(
        "/event-types",
        content="{",
        headers={"Content-Type": "application/json"},
    )

    assert missing.status_code == 404
    assert missing.json()["code"] == "EVENT_TYPE_NOT_FOUND"
    assert bad_path.status_code == 400
    assert bad_path.json()["code"] == "INVALID_REQUEST"
    assert malformed.status_code == 400
    assert malformed.json()["code"] == "INVALID_REQUEST"


def test_booking_creation_is_atomic(client: TestClient) -> None:
    create_event_type(client)
    payload = booking_payload("consultation", "2026-08-31T12:00:00+03:00")

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(lambda _: client.post("/bookings", json=payload).status_code, range(2)))

    assert sorted(statuses) == [201, 409]
