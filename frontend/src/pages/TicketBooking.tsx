import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Spinner } from '../components/common/Spinner';
import { SeatMap } from '../components/common/SeatMap';
import { api } from '../services/api';
import { ShieldCheck, Info } from 'lucide-react';

export const TicketBooking: React.FC = () => {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [bookedSeatIds, setBookedSeatIds] = useState<string[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const showData = await api.get(`/api/events/${event_id}`);
      setShow(showData);

      const [allSeats, availability] = await Promise.all([
        api.get('/api/admin/seats/layout'),
        api.get(`/api/bookings/availability/${event_id}`)
      ]);

      setSeats(allSeats);
      setBookedSeatIds(availability.booked_seat_layout_ids || []);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch show configurations.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (event_id) {
      loadData();
    }
  }, [event_id]);

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  if (error || !show) return <div className="text-center py-20 text-red-500">{error || 'Session details missing.'}</div>;

  const selectedSeats = seats.filter(s => selectedSeatIds.includes(s.id));
  const subtotal = selectedSeats.reduce((sum, s) => sum + parseFloat(s.price), 0);
  const convenienceFee = 30.00 * selectedSeatIds.length;
  const gst = (subtotal + convenienceFee) * 0.18;
  const total = subtotal + convenienceFee + gst;

  const handleSeatSelect = (seatId: string) => {
    setSelectedSeatIds(prev =>
      prev.includes(seatId) ? prev.filter(id => id !== seatId) : [...prev, seatId]
    );
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeatIds.length === 0) {
      setError('Please select at least one seat from the auditorium map.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone details are required.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const checkoutData = await api.post('/api/bookings/', {
        show_id: show.id,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        seat_layout_ids: selectedSeatIds
      });

      navigate('/checkout', { state: { ...checkoutData } });
    } catch (err: any) {
      setError(err.message || "Failed to secure ticket seat booking lock.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="w-full md:w-3/5 space-y-8">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-3xl font-extrabold text-slate-100 font-bold">Select Seating Placement</h1>
            <p className="text-slate-400 mt-1">Select seat placements inside the auditorium. Max 6 seats per transaction.</p>
          </div>

          <Card className="bg-cinema-card p-8">
            <SeatMap
              seats={seats}
              bookedSeatIds={bookedSeatIds}
              selectedSeatIds={selectedSeatIds}
              onSeatSelect={handleSeatSelect}
              maxSelectable={6}
            />
          </Card>
        </div>

        <div className="w-full md:w-2/5 space-y-6">
          <form onSubmit={handleCheckout} className="space-y-6">
            <Card className="bg-cinema-card p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 mb-2 font-bold font-bold">1. Admission Pass Holder</h3>
              
              <Input label="Full Name" required value={name} onChange={e => setName(e.target.value)} />
              <Input label="Phone Number" required value={phone} onChange={e => setPhone(e.target.value)} />
              <Input label="Email (Optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />

              <div className="flex gap-2 text-[11px] text-slate-400 p-3 bg-slate-900 rounded-lg">
                <Info className="w-4 h-4 text-amber-500 shrink-0" />
                <span>No login required. We will use these details to dispatch your QR code ticket.</span>
              </div>
            </Card>

            <Card className="bg-cinema-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 mb-6 font-bold font-bold">2. Order Overview</h3>
              
              <div className="space-y-4 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Showtime Selected</span>
                  <span className="text-slate-100 font-semibold">{show.date} at {show.time}</span>
                </div>
                <div className="flex justify-between">
                  <span>Selected Seats</span>
                  <span className="text-amber-500 font-bold">
                    {selectedSeats.length > 0 ? selectedSeats.map(s => s.seat_number).join(', ') : 'None'}
                  </span>
                </div>

                <div className="h-px bg-slate-800 my-4" />

                <div className="flex justify-between text-xs">
                  <span>Seats Subtotal</span>
                  <span>INR {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Convenience Booking Fee</span>
                  <span>INR {convenienceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Calculated GST (18%)</span>
                  <span>INR {gst.toFixed(2)}</span>
                </div>

                <div className="h-px bg-slate-800 my-4" />

                <div className="flex justify-between items-end text-slate-100 font-bold">
                  <span className="text-sm font-semibold">Grand Total</span>
                  <span className="text-2xl text-amber-500">INR {total.toFixed(2)}</span>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-950/20 border border-red-900/50 p-3 rounded-lg mt-4">{error}</p>}

              <Button
                type="submit"
                className="w-full mt-6 bg-gold-gradient text-slate-950 font-bold gap-2"
                disabled={submitting || selectedSeatIds.length === 0 || !name || !phone}
              >
                <ShieldCheck className="w-5 h-5" /> Lock Seats & Checkout
              </Button>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};
