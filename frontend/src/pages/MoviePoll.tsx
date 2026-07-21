import { CheckCircle2, Clock3, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { api } from "../services/api";
import type { PollResponse } from "../types";

const VISITOR_KEY = "aravalli.poll.visitor";

function getVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, generated);
  return generated;
}

function formatRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return "Voting closed";
  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h ${minutes}m remaining`;
}

export function MoviePoll() {
  const visitorId = useMemo(getVisitorId, []);
  const [data, setData] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingOption, setVotingOption] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.get<PollResponse>(`/api/polls/current?visitor_id=${encodeURIComponent(visitorId)}`)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [visitorId]);

  const vote = async (optionId: string) => {
    setVotingOption(optionId);
    setError("");
    try {
      const updated = await api.post<PollResponse>("/api/polls/vote", {
        poll_option_id: optionId,
        visitor_id: visitorId,
      });
      setData(updated);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setVotingOption(null);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  if (!data?.poll) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <Trophy className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-5 text-3xl font-black text-white">No poll is open</h1>
        <p className="mt-2 text-slate-400">The next weekly movie poll will appear here.</p>
        {error && <p className="mt-5 text-sm text-rose-300">{error}</p>}
      </div>
    );
  }

  const { poll, options, total_votes: totalVotes, has_voted: hasVoted, selected_option_id: selectedId } = data;
  const remaining = new Date(poll.voting_ends_at).getTime() - now;
  const open = data.is_open && remaining > 0;
  const winner = poll.winning_movie || options.find((option) => option.movie_id === poll.winning_movie_id)?.movie;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">Weekly audience choice</p>
        <h1 className="mt-3 text-4xl font-black text-white">Choose the next movie</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          One vote per browser. The winner automatically becomes the auditorium's movie for the week of {poll.week_start}.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs font-bold">
          <span className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-slate-300"><Clock3 className="h-4 w-4 text-amber-400" />{open ? formatRemaining(remaining) : "Voting closed"}</span>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-slate-300">{totalVotes} total votes</span>
          {hasVoted && <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-emerald-400"><CheckCircle2 className="h-4 w-4" />Vote recorded</span>}
        </div>
      </div>

      {!open && winner && (
        <Card className="mx-auto mt-9 max-w-3xl border-amber-500/30 text-center">
          <Trophy className="mx-auto h-8 w-8 text-amber-400" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Winning movie</p>
          <h2 className="mt-2 text-2xl font-black text-white">{winner.title}</h2>
          <p className="mt-2 text-sm text-slate-400">Its official showtimes have been added automatically.</p>
        </Card>
      )}

      {error && <p className="mx-auto mt-7 max-w-3xl rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-center text-sm text-rose-300">{error}</p>}

      <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const selected = selectedId === option.id;
          return (
            <Card key={option.id} className={`p-0 ${selected ? "ring-2 ring-emerald-500" : ""}`}>
              <img
                src={option.movie.poster_url || "https://placehold.co/600x900/20252C/D4AF37?text=Movie"}
                alt={option.movie.title}
                className="h-72 w-full object-cover"
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-black text-white">{option.movie.title}</h2>
                  {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">{option.movie.synopsis}</p>
                <p className="mt-3 text-xs text-slate-500">{option.movie.genre} · {option.movie.language} · {option.movie.duration_minutes} min</p>

                <div className="mt-5">
                  <div className="flex justify-between text-xs font-bold"><span className="text-slate-400">{option.votes_count} votes</span><span className="text-amber-400">{option.percentage.toFixed(1)}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gold-gradient transition-all" style={{ width: `${option.percentage}%` }} /></div>
                </div>

                <Button
                  className="mt-5 w-full"
                  variant={selected ? "secondary" : "primary"}
                  disabled={!open || hasVoted || votingOption !== null}
                  onClick={() => void vote(option.id)}
                >
                  {selected ? "Your vote" : votingOption === option.id ? "Recording…" : open ? "Vote for this movie" : "Voting closed"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
