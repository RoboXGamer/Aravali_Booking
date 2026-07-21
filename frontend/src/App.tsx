import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Footer } from "./components/common/Footer";
import { Navbar } from "./components/common/Navbar";
import { BookingLookup } from "./pages/BookingLookup";
import { Checkout } from "./pages/Checkout";
import { Confirmation } from "./pages/Confirmation";
import { EventDetails } from "./pages/EventDetails";
import { EventsPage } from "./pages/EventsPage";
import { LandingPage } from "./pages/LandingPage";
import { TicketBooking } from "./pages/TicketBooking";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/shows" element={<EventsPage />} />
            <Route path="/shows/:event_id" element={<EventDetails />} />
            <Route path="/book/:event_id" element={<TicketBooking />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmation/:booking_code" element={<Confirmation />} />
            <Route path="/find-booking" element={<BookingLookup />} />

            {/* Temporary aliases for old shared links. */}
            <Route path="/events" element={<Navigate to="/shows" replace />} />
            <Route path="/events/:event_id" element={<EventDetails />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
