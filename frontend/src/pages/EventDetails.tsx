import { ArrowLeft, CalendarDays, Clock, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { api } from "../services/api";
import type { Show } from "../types";

export function EventDetails() {
  const { event_id } = useParams();
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!event_id) return;
    api.get<Show>(`/api/events/${event_id}`)
      .then(setShow)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [event_id]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  if (!show) return <div className="mx-auto max-w-3xl px-5 py-20 text-center text-rose-300">{error || "Show not found."}</div>;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
      <Link to="/shows" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All showtimes
      </Link>

      <div className="grid gap-10 md:grid-cols-[340px_1fr]">
        <img
          src={show.poster_url || "https://placehold.co/600x900/20252C/D4AF37?text=Aravalli"}
          alt={show.title}
          className="h-[500px] w-full rounded-2xl object-cover shadow-2xl"
        />
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            {[show.genre, show.language, show.certificate, `${show.duration_minutes} min`].map((value) => (
              <span key={value} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">{value}</span>
            ))}
          </div>
          <h1 className="mt-6 text-4xl font-black text-white md:text-5xl">{show.title}</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-400">{show.description}</p>

          <Card className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-amber-400" />
              <div><p className="text-xs text-slate-500">Date</p><p className="font-bold text-white">{show.date}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400" />
              <div><p className="text-xs text-slate-500">Showtime</p><p className="font-bold text-white">{show.time.slice(0, 5)}</p></div>
            </div>
          </Card>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={`/book/${show.id}`}><Button size="lg">Choose seats</Button></Link>
            {show.trailer_url && (
              <a href={show.trailer_url} target="_blank" rel="noreferrer">
                <Button size="lg" variant="secondary" className="gap-2"><PlayCircle className="h-4 w-4" /> Trailer</Button>
              </a>
            )}
          </div>

          <div className="mt-8 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
            <p><span className="text-slate-500">Director:</span> {show.director || "—"}</p>
            <p><span className="text-slate-500">Cast:</span> {show.cast_members || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
