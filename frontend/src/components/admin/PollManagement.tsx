import { FormEvent, useState } from "react";
import { Pencil, Play, Square, Trash2, Trophy } from "lucide-react";

import { api } from "../../services/api";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { Input } from "../common/Input";

interface PollMovie {
  id: string;
  title: string;
  is_active: boolean;
}

interface PollOption {
  id: string;
  movie_id: string;
  votes_count: number;
  movies: PollMovie;
}

export interface AdminPoll {
  id: string;
  week_start: string;
  voting_starts_at: string;
  voting_ends_at: string;
  status: string;
  winning_movie_id: string | null;
  poll_options: PollOption[];
}

interface Props {
  movies: PollMovie[];
  polls: AdminPoll[];
  saving: boolean;
  perform: (action: () => Promise<unknown>) => Promise<boolean>;
}

const emptyForm = {
  week_start: "",
  voting_starts_at: "",
  voting_ends_at: "",
  status: "draft" as "draft" | "voting",
  movie_ids: [] as string[],
};

const toLocalInput = (value: string) => {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export function PollManagement({ movies, polls, saving, perform }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      voting_starts_at: new Date(form.voting_starts_at).toISOString(),
      voting_ends_at: new Date(form.voting_ends_at).toISOString(),
    };
    const succeeded = await perform(() => editingId
      ? api.put(`/api/admin/polls/${editingId}`, payload)
      : api.post("/api/admin/polls", payload));
    if (succeeded) reset();
  };

  const edit = (poll: AdminPoll) => {
    setEditingId(poll.id);
    setForm({
      week_start: poll.week_start,
      voting_starts_at: toLocalInput(poll.voting_starts_at),
      voting_ends_at: toLocalInput(poll.voting_ends_at),
      status: poll.status === "voting" ? "voting" : "draft",
      movie_ids: poll.poll_options.map((option) => option.movie_id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeStatus = (poll: AdminPoll, status: "draft" | "voting" | "closed") => {
    if (status === "closed" && !window.confirm("Close voting and schedule the leading movie?")) return;
    void perform(() => api.patch(`/api/admin/polls/${poll.id}/status`, { status }));
  };

  const remove = (poll: AdminPoll) => {
    if (!window.confirm(`Delete the poll for week ${poll.week_start}? Voting data will be removed.`)) return;
    void perform(() => api.delete(`/api/admin/polls/${poll.id}`));
  };

  const overrideWinner = (poll: AdminPoll, option: PollOption) => {
    if (!window.confirm(`Set ${option.movies.title} as the winner and schedule its shows?`)) return;
    void perform(() => api.post(`/api/admin/polls/${poll.id}/override`, { movie_id: option.movie_id }));
  };

  return (
    <section className="mt-7 grid gap-7 lg:grid-cols-[380px_1fr]">
      <Card>
        <h2 className="font-black text-white">{editingId ? "Edit poll" : "Create poll"}</h2>
        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
          <Input label="Movie week (Monday)" type="date" required value={form.week_start} onChange={(event) => setForm({ ...form, week_start: event.target.value })} />
          <Input label="Voting starts" type="datetime-local" required value={form.voting_starts_at} onChange={(event) => setForm({ ...form, voting_starts_at: event.target.value })} />
          <Input label="Voting ends" type="datetime-local" required value={form.voting_ends_at} onChange={(event) => setForm({ ...form, voting_ends_at: event.target.value })} />
          <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            Initial status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "draft" | "voting" })} className="rounded-lg border border-[rgb(var(--booking-control-border))] bg-[rgb(var(--booking-control))] px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-100">
              <option value="draft">Draft</option>
              <option value="voting">Open for voting</option>
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Movie options</legend>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-800 p-3">
              {movies.filter((movie) => movie.is_active).map((movie) => (
                <label key={movie.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-white/5">
                  <input type="checkbox" checked={form.movie_ids.includes(movie.id)} onChange={() => setForm({ ...form, movie_ids: form.movie_ids.includes(movie.id) ? form.movie_ids.filter((id) => id !== movie.id) : [...form.movie_ids, movie.id] })} />
                  {movie.title}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving || form.movie_ids.length < 2}>{editingId ? "Save poll" : "Create poll"}</Button>
            {editingId && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <div className="space-y-4">
        {polls.length === 0 && <Card><p className="text-sm text-slate-400">No polls have been created.</p></Card>}
        {polls.map((poll) => {
          const votes = poll.poll_options.reduce((sum, option) => sum + option.votes_count, 0);
          const completed = poll.status === "closed" || poll.status === "overridden";
          return (
            <Card key={poll.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-black text-white">Week of {poll.week_start}</h3><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase text-violet-300">{poll.status}</span></div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(poll.voting_starts_at).toLocaleString()} – {new Date(poll.voting_ends_at).toLocaleString()}</p>
                </div>
                <strong className="text-sm text-[rgb(var(--booking-accent-text))]">{votes} votes</strong>
              </div>
              <div className="mt-4 space-y-2">
                {poll.poll_options.map((option) => {
                  const isWinner = poll.winning_movie_id === option.movie_id;
                  return (
                    <div key={option.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-3 text-sm">
                      <span className="flex items-center gap-2 text-white">{isWinner && <Trophy className="h-4 w-4 text-violet-400" />}{option.movies.title}<span className="text-slate-500">{option.votes_count}</span></span>
                      <Button size="sm" variant="secondary" onClick={() => overrideWinner(poll, option)} disabled={saving || isWinner}>Set winner</Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                {!completed && <Button size="sm" variant="secondary" className="gap-2" onClick={() => edit(poll)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                {poll.status === "draft" && <Button size="sm" className="gap-2" onClick={() => changeStatus(poll, "voting")}><Play className="h-3.5 w-3.5" /> Start voting</Button>}
                {poll.status === "voting" && <Button size="sm" variant="secondary" className="gap-2" onClick={() => changeStatus(poll, "closed")}><Square className="h-3.5 w-3.5" /> Close voting</Button>}
                <Button size="sm" variant="danger" className="gap-2" onClick={() => remove(poll)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
