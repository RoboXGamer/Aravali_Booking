import { CalendarDays, Clock, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { api } from "../services/api";
import type { Show } from "../types";

export function EventsPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Show[]>("/api/events")
      .then(setShows)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => shows.filter((show) => show.title.toLowerCase().includes(search.trim().toLowerCase())),
    [search, shows],
  );

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <div className="flex flex-col justify-between gap-6 border-b border-slate-800 pb-8 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400">Upcoming</p>
          <h1 className="mt-2 text-3xl font-black text-white">Choose a showtime</h1>
          <p className="mt-2 text-slate-400">Select a screening to view details and seats.</p>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search movie"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-11 py-3 text-sm text-white outline-none focus:border-amber-500"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-10 rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-rose-300">{error}</p>
      ) : filtered.length === 0 ? (
        <Card className="mt-10 py-14 text-center text-slate-400">No matching showtimes found.</Card>
      ) : (
        <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((show) => (
            <Link key={show.id} to={`/shows/${show.id}`}>
              <Card className="group h-full p-0">
                <img
                  src={show.poster_url || "https://placehold.co/600x900/20252C/D4AF37?text=Aravalli"}
                  alt={show.title}
                  className="h-72 w-full object-cover"
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-extrabold text-white group-hover:text-amber-400">{show.title}</h2>
                    <span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300">{show.certificate}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{show.genre} · {show.language} · {show.duration_minutes} min</p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
                    <span className="flex items-center gap-2 text-slate-300"><CalendarDays className="h-4 w-4 text-amber-400" />{show.date}</span>
                    <span className="flex items-center gap-2 font-bold text-white"><Clock className="h-4 w-4 text-amber-400" />{show.time.slice(0, 5)}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
