import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Calendar, Search, MapPin } from 'lucide-react';

export const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/events')
      .then(res => {
        setEvents(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900 pb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-bold">Weekly Scheduled Cinema Showtimes</h1>
          <p className="text-slate-400 mt-1">Select from our scheduling and book dynamic placement seats easily.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Search movies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-3 pl-11 pr-4 text-sm text-slate-100 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filtered.map(event => (
          <Card key={event.id} className="p-0 flex flex-col group h-full bg-cinema-card">
            <div className="h-48 overflow-hidden relative">
              <img 
                src={event.poster_url || "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=600"} 
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-2">
                <h3 className="text-lg font-bold group-hover:text-brand transition">{event.title}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  <span>{event.date} at {event.time}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  <span>{event.venue}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-900/60">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-bold">Dynamic Tiers Pricing</span>
                  <span className="text-sm font-bold text-slate-200">Seated Pass</span>
                </div>
                <Button onClick={() => navigate(`/events/${event.id}`)} variant="primary" size="sm">
                  View Timing Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
