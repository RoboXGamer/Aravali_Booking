import { useQuery } from "convex/react";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Spinner } from "../components/common/Spinner";
import { auditoriumToday } from "../lib/auditoriumDate";

interface ShowtimeSelectionProps {
  adminMode?: boolean;
}

function localDateParts() {
  return { today: auditoriumToday() };
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

export function ShowtimeSelection({ adminMode = false }: ShowtimeSelectionProps) {
  const { movie_id: movieId } = useParams();
  const now = useMemo(localDateParts, []);
  const data = useQuery(
    api.events.listUpcomingByMovie,
    movieId ? { movieId: movieId as Id<"movies">, ...now } : "skip",
  );
  const showsByDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof data>["shows"]>();
    for (const show of data?.shows ?? []) {
      const current = groups.get(show.date) ?? [];
      current.push(show);
      groups.set(show.date, current);
    }
    return [...groups.entries()];
  }, [data]);
  const backTo = adminMode ? "/admin/bookings/reservations" : "/";

  if (data === undefined) {
    return <div className="grid min-h-screen place-items-center bg-background"><Spinner size="lg" /></div>;
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <section className="max-w-md text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-600" />
          <h1 className="mt-4 text-2xl font-black text-white">Movie not found</h1>
          <p className="mt-2 text-sm text-slate-400">This movie is no longer available for booking.</p>
          <Link to={backTo} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-300">
            <ArrowLeft className="h-4 w-4" /> Go back
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgb(var(--booking-selected-start)/.14),transparent_38%),rgb(var(--booking-background))] px-4 py-4 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-5xl">
        <header className="flex min-h-11 items-center gap-3">
          <Link
            to={backTo}
            aria-label="Go back"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            {adminMode && <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-400">Admin reservation</p>}
            <h1 className="text-lg font-black text-white sm:text-xl">Select a showtime</h1>
          </div>
        </header>

        <section className="mt-4 grid overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/45 shadow-2xl shadow-black/20 md:grid-cols-[230px_1fr]">
          <div className="relative min-h-64 overflow-hidden bg-slate-900 md:min-h-[520px]">
            {data.movie.poster_url ? (
              <>
                <img src={data.movie.poster_url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
                <img src={data.movie.poster_url} alt={`${data.movie.title} poster`} className="relative mx-auto h-full max-h-[520px] w-auto object-contain" />
              </>
            ) : (
              <div className="grid h-full place-items-center"><Ticket className="h-12 w-12 text-slate-700" /></div>
            )}
          </div>

          <div className="p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-400">Now showing</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{data.movie.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> {data.movie.duration_minutes} min</span>
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Aravalli Auditorium Main Hall</span>
            </div>

            <div className="mt-7 border-t border-slate-800 pt-6">
              {showsByDay.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-8 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-600" />
                  <h3 className="mt-3 font-bold text-white">No upcoming showtimes</h3>
                  <p className="mt-1 text-sm text-slate-400">New dates and times will appear here once scheduled.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {showsByDay.map(([date, shows]) => (
                    <section key={date} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-violet-400" />
                        <h3 className="text-sm font-bold text-white">{formatDay(date)}</h3>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {shows.map((show) => (
                          <Link
                            key={show.id}
                            to={adminMode ? `/admin/book/${show.id}` : `/book/${show.id}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-500/10 px-4 text-sm font-bold text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/20 hover:text-white"
                          >
                            <Clock3 className="h-4 w-4" />
                            {formatTime(show.time)}
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
