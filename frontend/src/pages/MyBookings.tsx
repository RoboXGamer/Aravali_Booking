import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Calendar, Download, Ticket } from 'lucide-react';

export const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/bookings')
      .then(res => {
        setBookings(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleDownload = (bookingId: string) => {
    window.open(api.getDownloadUrl(bookingId), '_blank');
  };

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-100 font-bold">My Cinema Passes</h1>
        <p className="text-slate-400 mt-1">Manage and access your original seat ticket credentials.</p>
      </div>

      {bookings.length === 0 ? (
        <Card className="text-center py-16 bg-cinema-card space-y-4">
          <Ticket className="w-12 h-12 text-slate-655 mx-auto" />
          <h3 className="text-slate-300 font-bold text-lg">No active tickets located</h3>
          <p className="text-sm text-slate-500">Select an event playbill from the schedule grid and complete checkout.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {bookings.map(booking => (
            <Card key={booking.id} className="bg-cinema-card flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-slate-900 gap-6">
              <div className="space-y-2">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest \${
                  booking.status === 'confirmed' ? 'bg-brand/10 text-brand border border-brand/20 text-gold font-bold' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {booking.status}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{booking.event_title || 'Aravalli Auditorium Performance'}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reserved on {new Date(booking.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Value: <strong className="text-slate-300">INR {booking.total_amount}</strong>
                </div>
              </div>
              
              {booking.status === 'confirmed' && (
                <Button onClick={() => handleDownload(booking.id)} variant="secondary" size="sm" className="gap-2 shrink-0">
                  <Download className="w-4 h-4" /> Download PDF Pass
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
