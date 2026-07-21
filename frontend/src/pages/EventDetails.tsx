import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Calendar, MapPin, Clock, ArrowLeft } from 'lucide-react';

export const EventDetails: React.FC = () => {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (event_id) {
      api.get(`/api/events/${event_id}`)
        .then(res => {
          setEvent(res);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [event_id]);

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!event) return <div className="text-center py-20 text-slate-400">Show details not located.</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to listings
      </button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-5 h-[400px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
          <img 
            src={event.poster_url || "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=600"} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="md:col-span-7 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold text-slate-100">{event.title}</h1>
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>

          <Card className="grid grid-cols-2 gap-6 bg-cinema-card border-slate-900/60">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 font-bold">Scheduled Date</span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{event.date}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 font-bold">Session Bell</span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{event.time}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-start gap-3 border-t border-slate-900 pt-4">
              <MapPin className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 font-bold">Venue Location</span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{event.venue}</p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between border-t border-slate-900/60 pt-6">
            <div>
              <span className="text-xs text-slate-500 font-medium font-bold">Aravalli Seating Layouts</span>
              <p className="text-xl font-extrabold text-slate-200">Interactive Map</p>
            </div>
            <Button onClick={() => navigate(`/book/${event.id}`)} variant="primary" size="lg">
              Book Dynamic Seat Ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
