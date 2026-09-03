# Integration scenarios

## Booking flow

1. The calendar owner opens the owner page and creates an event type.
2. The new event type appears on the public page.
3. A guest opens the event type and selects the first available slot.
4. The guest enters a name and email address and confirms the booking.
5. The confirmation page displays the booked event type.
6. The booking appears in the owner's upcoming meetings with the guest details.

The Playwright test starts both application parts and performs this flow in a
real Chromium browser. The backend uses a fresh in-memory store for each run.
