import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { EventBookingPage } from "./pages/EventBookingPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OwnerPage } from "./pages/OwnerPage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/event-types/:eventTypeId" element={<EventBookingPage />} />
        <Route path="/owner" element={<OwnerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
