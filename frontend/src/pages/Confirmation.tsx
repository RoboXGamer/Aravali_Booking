import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { CheckCircle, Download, Compass } from 'lucide-react';

export const Confirmation: React.FC = () => {
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        const bookingsList = await api.get('/api/bookings');
        const match = bookingsList.find((b: any) => b.id === booking_id);
        setBooking(match);
      } catch (err) {
        console.error("Failed to retrieve booking confirmation details: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookingDetails();
  }, [booking_id]);

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!booking) return <div className="text-center py-20 text-slate-400">Booking configuration mismatch.</div>;

  const handleDownload = () => {
    const url = api.getDownloadUrl(booking.id);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-12 text-center">
      <Card className="bg-cinema-card p-8 space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-brand flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black font-bold text-gold">Admission Pass Locked Successfully</h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Your dynamic verification pass is ready. Please download your original PDF copy for security check desks.
          </p>
        </div>

        <div className="border border-dashed border-slate-800 bg-slate-900 rounded-2xl p-6 text-left space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Pass Clearance Reference</span>
            <span className="font-mono text-slate-200 text-[11px] font-bold">{booking.id}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Value Cleared</span>
            <span className="text-brand font-extrabold text-sm text-gold">INR {booking.total_amount}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button onClick={handleDownload} variant="primary" className="gap-2 justify-center py-3 text-xs uppercase tracking-wider font-bold">
            <Download className="w-4 h-4" /> Download Ticket
          </Button>
          <Button onClick={() => navigate('/events')} variant="secondary" className="gap-2 justify-center py-3 text-xs uppercase tracking-wider">
            <Compass className="w-4 h-4" /> Discover Movies
          </Button>
        </div>
      </Card>
    </div>
  );
};
