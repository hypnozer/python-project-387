import type {
  ApiErrorBody,
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  Owner,
  SlotWindow,
} from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ApiErrorBody["code"];

  constructor(status: number, message: string, code?: ApiErrorBody["code"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.");
  }

  if (!response.ok) {
    let body: Partial<ApiErrorBody> | undefined;
    try {
      body = (await response.json()) as Partial<ApiErrorBody>;
    } catch {
      body = undefined;
    }

    throw new ApiError(
      response.status,
      body?.message ?? `Сервер вернул ошибку ${response.status}.`,
      body?.code,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  getOwner: () => request<Owner>("/owner"),
  getUpcomingBookings: () => request<Booking[]>("/owner/bookings"),
  getEventTypes: () => request<EventType[]>("/event-types"),
  getEventType: (eventTypeId: string) =>
    request<EventType>(`/event-types/${encodeURIComponent(eventTypeId)}`),
  getSlots: (eventTypeId: string) =>
    request<SlotWindow>(`/event-types/${encodeURIComponent(eventTypeId)}/slots`),
  createEventType: (payload: CreateEventTypeRequest) =>
    request<EventType>("/event-types", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createBooking: (payload: CreateBookingRequest) =>
    request<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
