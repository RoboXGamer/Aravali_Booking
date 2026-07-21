import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Spinner } from '../components/common/Spinner';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { BarChart3, Database, FileText, Plus, Trash2 } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [genre, setGenre] = useState('');
  const [certificate, setCertificate] = useState('');
  const [language, setLanguage] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/admin/dashboard-stats'),
      api.get('/api/admin/bookings'),
      api.get('/api/events')
    ]).then(([statsRes, bookingsRes, eventsRes]) => {
      setStats(statsRes);
      setBookings(bookingsRes);
      setEvents(eventsRes);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCSV = () => {
    const headers = ['Booking ID', 'Movie Title', 'Customer Name', 'Customer Phone', 'Amount Paid', 'Status', 'Timestamp'];
    const rows = bookings.map(b => [
      b.id,
      b.event_title,
      b.customer_name,
      b.customer_phone,
      b.total_amount,
      b.status,
      b.created_at
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "aravalli_movie_bookings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);

    if (!title || !date || !time) {
      setFormError('Title, Date and Time are mandatory parameters.');
      setCreating(false);
      return;
    }

    try {
      const movieRes = await api.post('/api/events/', {
        title,
        description,
        date,
        time,
        venue: "Aravalli Auditorium Main Hall",
        poster_url: "",
        status: "active",
        categories: [
          { name: "Gold", price: 1200, total_seats: 50 },
          { name: "Silver", price: 800, total_seats: 100 },
          { name: "Bronze", price: 450, total_seats: 150 }
        ]
      });

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to establish movie database session.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm("Confirm deletion of this showtime program?")) {
      try {
        await api.delete(`/api/admin/events/\${eventId}`);
        loadData();
      } catch (err) {
        alert("Failed to remove target event playbill record.");
      }
    }
  };

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-bold">Auditorium Administration Panel</h1>
          <p className="text-slate-400 mt-1 font-medium">Verify daily check-ins, occupancy counts, revenue metrics, and seating layouts.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setIsModalOpen(true)} variant="primary" className="gap-2 bg-gold-gradient text-slate-950 font-bold">
            <Plus className="w-4 h-4" /> Add Showtime Playbill
          </Button>
          <Button onClick={handleExportCSV} variant="secondary">
            Export Report CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-cinema-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-bold">Weekly Seated Revenue</span>
            <p className="text-3xl font-extrabold text-slate-100 mt-2 text-gold">INR {stats?.total_revenue?.toLocaleString() || '0'}</p>
          </div>
          <BarChart3 className="w-10 h-10 text-brand opacity-80 text-gold" />
        </Card>
        <Card className="bg-cinema-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-bold">Cinema Occupancy Count</span>
            <p className="text-3xl font-extrabold text-slate-100 mt-2">{stats?.total_seats_sold || '0'}</p>
          </div>
          <Database className="w-10 h-10 text-brand opacity-80 text-gold" />
        </Card>
        <Card className="bg-cinema-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-bold">Reserved Seats (Admin Lock)</span>
            <p className="text-3xl font-extrabold text-slate-100 mt-2">{stats?.total_reserved_seats || '0'}</p>
          </div>
          <FileText className="w-10 h-10 text-brand opacity-80 text-gold" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-lg font-bold">Manage Event List</h3>
          <div className="space-y-4">
            {events.map(event => (
              <Card key={event.id} className="p-4 bg-cinema-card flex items-center justify-between border-slate-900">
                <div>
                  <h4 className="font-bold text-slate-200">{event.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{event.date} at {event.time}</p>
                </div>
                <button 
                  onClick={() => handleDeleteEvent(event.id)}
                  className="text-slate-500 hover:text-rose-500 p-2 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-lg font-bold">Live Cinema Reservations Ledgers</h3>
          <div className="bg-cinema-card rounded-2xl border border-slate-900 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs uppercase bg-slate-900/60 text-slate-400 font-bold border-b border-slate-850">
                <tr>
                  <th className="px-6 py-4">Booking Ref</th>
                  <th className="px-6 py-4">Movie Showtime</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Value</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-900/10 transition">
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{booking.id}</td>
                    <td className="px-6 py-4 text-slate-200 font-semibold">{booking.event_title}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 font-medium">{booking.customer_name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{booking.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-100 font-semibold">INR {booking.total_amount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest \${
                        booking.status === 'confirmed' ? 'bg-brand/10 text-brand border border-brand/20 text-gold font-bold' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Film Scheduled Showtime">
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <Input label="Movie Title" required value={title} onChange={e => setTitle(e.target.value)} />
          <Input label="Synopsis" value={description} onChange={e => setDescription(e.target.value)} />
          
          <div className="flex gap-4">
            <Input label="Scheduled Screening Date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
            <Input label="Session Showtime" type="time" required value={time} onChange={e => setTime(e.target.value)} />
          </div>

          {formError && <p className="text-xs text-rose-500">{formError}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={creating}>{creating ? 'Saving...' : 'Add Showtime'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
