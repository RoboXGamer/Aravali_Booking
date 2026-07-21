import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Compass, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { api } from '../services/api';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/events')
      .then(setEvents)
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen">
      <section className="relative h-[80vh] flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-background to-background z-0" />
        
        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-brand"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Delhi's Premier Cinema Experience
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400"
          >
            Experience Cinema in Majesty
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Curated movie showtimes, weekly public polls, and luxury seat maps for the ultimate weekend screening.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-4 justify-center pt-4"
          >
            <Button onClick={() => navigate('/events')} variant="primary" size="lg" className="gap-2">
              Explore Showtimes <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Curated Playbills</h2>
            <p className="text-slate-400 text-sm mt-1">Select from our weekly verified screenings list.</p>
          </div>
          <Button onClick={() => navigate('/events')} variant="ghost" className="text-brand hover:text-brand-light gap-2 font-bold">
            View All Showtimes <Compass className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {events.slice(0, 3).map((event) => (
            <motion.div 
              key={event.id}
              whileHover={{ y: -5 }}
              className="group cursor-pointer"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <Card className="h-full flex flex-col p-0 bg-cinema-card">
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={event.poster_url || "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=600"} 
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800/60 px-3 py-1 rounded-md text-xs text-brand font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {event.date}
                  </div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-brand transition duration-200">{event.title}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2 mt-2 leading-relaxed">{event.description}</p>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-slate-900">
                    <span className="text-xs text-slate-500 font-semibold font-bold">Premium Seating Tiers</span>
                    <span className="text-xs font-semibold text-brand flex items-center gap-1 font-bold">
                      Details <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
