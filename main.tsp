import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "Calendar Booking API" })
@info(#{
  version: "1.0.0",
  summary: "Contract for a single-owner calendar and its public booking flow"
})
@server("http://localhost:8000", "Local development server")
@doc("The API has one predefined owner and no registration or authentication. Owner routes serve the administrative UI; event type, slot, and booking creation routes serve guests.")
namespace CalendarBookingApi;

@doc("Stable identifier supplied by the owner. It is a lowercase URL-safe slug.")
@pattern("^[a-z0-9]+(?:-[a-z0-9]+)*$")
@minLength(1)
@maxLength(64)
scalar EventTypeId extends string;

@doc("Opaque server-generated identifier.")
@format("uuid")
scalar ResourceId extends string;

@doc("An IANA time-zone identifier such as Europe/Moscow.")
@minLength(1)
scalar IanaTimeZone extends string;

enum DayOfWeek {
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
}

@doc("A local-time interval in the owner's predefined weekly schedule. startsAt must be earlier than endsAt.")
model AvailabilityInterval {
  startsAt: plainTime;
  endsAt: plainTime;
}

@doc("Predefined working intervals for one weekday. Intervals for the same day do not overlap.")
model WeeklyAvailability {
  dayOfWeek: DayOfWeek;
  intervals: AvailabilityInterval[];
}

@doc("The application's single predefined calendar owner.")
model Owner {
  id: ResourceId;

  @minLength(1)
  @maxLength(120)
  name: string;

  timeZone: IanaTimeZone;
  weeklyAvailability: WeeklyAvailability[];
}

@doc("A kind of meeting guests can book.")
model EventType {
  id: EventTypeId;

  @minLength(1)
  @maxLength(120)
  title: string;

  @minLength(1)
  @maxLength(2000)
  description: string;

  @minValue(1)
  @maxValue(1440)
  durationMinutes: int32;
}

@doc("Payload used by the owner to create an event type.")
model CreateEventTypeRequest {
  id: EventTypeId;

  @minLength(1)
  @maxLength(120)
  title: string;

  @minLength(1)
  @maxLength(2000)
  description: string;

  @minValue(1)
  @maxValue(1440)
  durationMinutes: int32;
}

@doc("A currently free interval computed for one event type. Timestamps include a UTC offset.")
model Slot {
  eventTypeId: EventTypeId;
  startsAt: offsetDateTime;
  endsAt: offsetDateTime;
}

@doc("A rolling 14-calendar-date availability window in the owner's time zone. startsOn is today and endsOn is the thirteenth following date.")
model SlotWindow {
  startsOn: plainDate;
  endsOn: plainDate;
  ownerTimeZone: IanaTimeZone;
  slots: Slot[];
}

@doc("Contact data supplied by a guest without creating an account.")
model Guest {
  @minLength(1)
  @maxLength(120)
  name: string;

  @format("email")
  @maxLength(254)
  email: string;
}

@doc("A confirmed meeting. endsAt is derived from the event type duration by the server.")
model Booking {
  id: ResourceId;
  eventTypeId: EventTypeId;
  eventTypeTitle: string;
  durationMinutes: int32;
  guest: Guest;
  startsAt: offsetDateTime;
  endsAt: offsetDateTime;
  createdAt: utcDateTime;
}

@doc("Guest request for a currently advertised slot. The server derives the end time and atomically rechecks availability.")
model CreateBookingRequest {
  eventTypeId: EventTypeId;
  startsAt: offsetDateTime;
  guest: Guest;
}

enum ErrorCode {
  INVALID_REQUEST,
  EVENT_TYPE_NOT_FOUND,
  EVENT_TYPE_ID_EXISTS,
  SLOT_OUTSIDE_BOOKING_WINDOW,
  SLOT_NOT_OFFERED,
  SLOT_UNAVAILABLE,
  INTERNAL_ERROR,
}

@doc("Machine-readable API error with a human-readable explanation.")
model ApiError {
  code: ErrorCode;
  message: string;
}

model CreatedResponse<T> {
  @statusCode statusCode: 201;
  @header location: string;
  @body body: T;
}

@error
model BadRequestResponse {
  @statusCode statusCode: 400;
  @body body: ApiError;
}

@error
model NotFoundResponse {
  @statusCode statusCode: 404;
  @body body: ApiError;
}

@error
model ConflictResponse {
  @statusCode statusCode: 409;
  @body body: ApiError;
}

@error
model UnprocessableEntityResponse {
  @statusCode statusCode: 422;
  @body body: ApiError;
}

@error
model InternalServerErrorResponse {
  @statusCode statusCode: 500;
  @body body: ApiError;
}

@route("/owner")
@tag("Owner")
interface OwnerOperations {
  @get
  @summary("Get the predefined owner profile")
  getOwner(): Owner | InternalServerErrorResponse;
}

@route("/owner/bookings")
@tag("Owner")
interface OwnerBookingOperations {
  @get
  @summary("List all upcoming bookings across every event type")
  @doc("Returns bookings whose startsAt is in the future, ordered by startsAt ascending. An empty result is returned as [].")
  listUpcomingBookings(): Booking[] | InternalServerErrorResponse;
}

@route("/event-types")
@tag("Event types")
interface EventTypeOperations {
  @get
  @summary("List event types for the public booking page")
  @doc("Returns all event types ordered by title ascending. An empty result is returned as [].")
  listEventTypes(): EventType[] | InternalServerErrorResponse;

  @post
  @summary("Create an event type as the calendar owner")
  createEventType(@body request: CreateEventTypeRequest):
    | CreatedResponse<EventType>
    | BadRequestResponse
    | ConflictResponse
    | UnprocessableEntityResponse
    | InternalServerErrorResponse;

  @get
  @route("/{eventTypeId}")
  @summary("Get one event type for the public booking page")
  getEventType(@path eventTypeId: EventTypeId):
    | EventType
    | NotFoundResponse
    | InternalServerErrorResponse;

  @get
  @route("/{eventTypeId}/slots")
  @summary("List free slots for an event type in the rolling 14-day window")
  @doc("Returns only slots that fit fully inside predefined owner availability, start in the future, and do not overlap any booking regardless of event type. Slots are ordered by startsAt ascending. Adjacent meetings are allowed. An empty result is returned as slots: [].")
  listAvailableSlots(@path eventTypeId: EventTypeId):
    | SlotWindow
    | NotFoundResponse
    | InternalServerErrorResponse;
}

@route("/bookings")
@tag("Bookings")
interface BookingOperations {
  @post
  @summary("Book an advertised free slot as a guest")
  @doc("The start must exactly match a slot currently offered for the chosen event type. The server derives endsAt, validates the rolling window, and checks interval overlap atomically. A conflict exists when newStart < existingEnd and existingStart < newEnd, across all event types.")
  createBooking(@body request: CreateBookingRequest):
    | CreatedResponse<Booking>
    | BadRequestResponse
    | NotFoundResponse
    | ConflictResponse
    | UnprocessableEntityResponse
    | InternalServerErrorResponse;
}
