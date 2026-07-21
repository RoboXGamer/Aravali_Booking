import { ArrowRight, BarChart3, CalendarDays, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { api } from "../services/api";
import type { Show } from "../types";

export function LandingPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Show[]>("/api/events").then(setShows).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden px-5 py-24 text-center md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.14),_transparent_52%)]" />
        <div className="relative mx-auto max-w-4xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
            Aravalli Auditorium
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-7xl">
            One great movie. Every week.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
            Pick a show, choose your exact seats and pay securely. No account or sign-in required.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/shows">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                View showtimes <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/find-booking">
              <Button size="lg" variant="secondary" className="w-full gap-2 sm:w-auto">
                <Search className="h-4 w-4" /> Find booking
              </Button>
            </Link>
            <Link to="/poll">
              <Button size="lg" variant="ghost" className="w-full gap-2 sm:w-auto">
                <BarChart3 className="h-4 w-4" /> Vote for next week
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400">Now booking</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Upcoming screenings</h2>
          </div>
          <Link to="/shows" className="text-sm font-semibold text-amber-400 hover:text-amber-300">
            See all
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : shows.length === 0 ? (
          <Card className="py-12 text-center text-slate-400">No upcoming shows have been scheduled.</Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {shows.slice(0, 3).map((show) => (
              <Link key={show.id} to={`/shows/${show.id}`}>
                <Card className="group h-full p-0">
                  <img
                    src={show.poster_url || "https://placehold.co/600x900/20252C/D4AF37?text=Aravalli"}
                    alt={show.title}
                    className="h-64 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white">{show.title}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                      <CalendarDays className="h-4 w-4 text-amber-400" /> {show.date} · {show.time.slice(0, 5)}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarDays, title: "Official schedule", text: "Wednesday through Sunday screenings." },
            { icon: ShieldCheck, title: "Secure payment", text: "Razorpay payment verification on the backend." },
            { icon: Search, title: "No account needed", text: "Retrieve tickets with booking code and email." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/35 p-5">
              <Icon className="h-5 w-5 text-amber-400" />
              <h3 className="mt-4 font-bold text-white">{title}</h3>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
