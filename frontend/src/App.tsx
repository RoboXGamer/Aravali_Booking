import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { EventsPage } from './pages/EventsPage';
import { EventDetails } from './pages/EventDetails';
import { TicketBooking } from './pages/TicketBooking';
import { Checkout } from './pages/Checkout';
import { Confirmation } from './pages/Confirmation';
import { MyBookings } from './pages/MyBookings';
import { AdminDashboard } from './pages/AdminDashboard';
import { CheckInScanner } from './pages/CheckInScanner';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="flex flex-col min-h-screen bg-background">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                {/* Public Elements */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:event_id" element={<EventDetails />} />

                {/* Booking elements */}
                <Route path="/book/:event_id" element={<TicketBooking />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/confirmation/:booking_id" element={<Confirmation />} />
                <Route path="/bookings" element={<MyBookings />} />

                {/* Operator Level */}
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/check-in" element={
                  <ProtectedRoute requireAdmin>
                    <CheckInScanner />
                  </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
