# Domain model and contract decisions

## Roles and entities

- **Owner** is the single predefined calendar profile. It owns an IANA time
  zone and a predefined weekly availability schedule. There is no owner login,
  registration, or schedule-management API in this scope.
- **Event type** is created by the owner and has a caller-supplied slug ID,
  title, description, and duration in minutes.
- **Slot** is not stored or created by a guest. It is a free interval computed
  for a selected event type from the owner's schedule, existing bookings, and
  the current time.
- **Guest** is contact data attached to a booking. A guest has no account.
- **Booking** is a confirmed interval for one event type and one guest. It
  preserves the event type title and duration used when it was created.

## Availability and time

The availability endpoint returns today and the following 13 calendar dates in
the owner's time zone. Past starts on the first date are excluded. Slot
timestamps include their UTC offset so daylight-saving transitions are
unambiguous. A slot must fit completely inside one predefined availability
interval. The concrete slot cadence is an implementation detail exposed by the
returned list; a booking is valid only when its start exactly matches an
advertised slot.

The booking request contains no end time. The server derives it from the
current duration of the selected event type and revalidates the slot in one
atomic operation. This prevents a stale UI or two concurrent guests from
creating conflicting meetings.

Two half-open booking intervals overlap when:

```text
newStart < existingEnd AND existingStart < newEnd
```

The rule applies across all event types. Meetings where one ends exactly when
the next begins are allowed.

## Error policy

- `400 INVALID_REQUEST`: malformed request, invalid path value, or invalid
  date-time representation.
- `404 EVENT_TYPE_NOT_FOUND`: the selected event type does not exist.
- `409 EVENT_TYPE_ID_EXISTS`: an owner tries to reuse an event type ID.
- `409 SLOT_UNAVAILABLE`: a previously offered slot is now occupied, including
  a race with another booking.
- `422 SLOT_OUTSIDE_BOOKING_WINDOW`: start is in the past or outside the rolling
  window.
- `422 SLOT_NOT_OFFERED`: start does not exactly match a generated slot or the
  meeting no longer fits the owner's schedule.
- `500 INTERNAL_ERROR`: unexpected server failure.

Validation failures for otherwise well-formed fields (blank/too-long strings,
invalid email, or duration outside 1–1440 minutes) use `422`.

## Scenario coverage

| Scenario | Contract operation |
| --- | --- |
| Read the fixed owner and schedule | `GET /owner` |
| Owner creates an event type | `POST /event-types` |
| Guest browses event types | `GET /event-types` |
| Guest opens an event type | `GET /event-types/{eventTypeId}` |
| Guest sees free slots for 14 dates | `GET /event-types/{eventTypeId}/slots` |
| Guest creates a booking | `POST /bookings` |
| Owner sees all upcoming meetings | `GET /owner/bookings` |

Updates, deletion, cancellation, authentication, and registration are outside
this contract because they are not part of the requested scenarios.
