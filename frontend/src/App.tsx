import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminGuard } from "./components/AdminGuard";
import { AdminCheckIn } from "./pages/AdminCheckIn";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/AdminLogin";
import { BookingLookup } from "./pages/BookingLookup";
import { Checkout } from "./pages/Checkout";
import { Confirmation } from "./pages/Confirmation";
import { EventDetails } from "./pages/EventDetails";
import { EventsPage } from "./pages/EventsPage";
import { LandingPage } from "./pages/LandingPage";
import { MoviePoll } from "./pages/MoviePoll";
import { TicketBooking } from "./pages/TicketBooking";

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-grow">
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/shows" element={<EventsPage />} />
            <Route path="/shows/:event_id" element={<EventDetails />} />
            <Route path="/book/:event_id" element={<TicketBooking />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmation/:booking_code" element={<Confirmation />} />
            <Route path="/find-booking" element={<BookingLookup />} />
            <Route path="/poll" element={<MoviePoll />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/check-in" element={<AdminGuard><AdminCheckIn /></AdminGuard>} />

            {/* Temporary aliases for old shared links. */}
            <Route path="/events" element={<Navigate to="/shows" replace />} />
            <Route path="/events/:event_id" element={<EventDetails />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
