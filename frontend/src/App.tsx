import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminGuard } from "./components/AdminGuard";
import { AdminCheckIn } from "./pages/AdminCheckIn";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/AdminLogin";
import { Checkout } from "./pages/Checkout";
import { Confirmation } from "./pages/Confirmation";
import { LandingPage } from "./pages/LandingPage";
import { TicketBooking } from "./pages/TicketBooking";

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-grow">
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/book/:event_id" element={<TicketBooking />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmation/:booking_code" element={<Confirmation />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/book/:event_id" element={<AdminGuard><TicketBooking adminMode /></AdminGuard>} />
            <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/:section" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/:section/:view" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/check-in" element={<AdminGuard><AdminCheckIn /></AdminGuard>} />
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
