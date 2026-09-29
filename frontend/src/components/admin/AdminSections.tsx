import { PaymentRecovery } from "./PaymentRecovery";
import { BarChart3, CalendarDays, Download, ImageUp, LayoutGrid, ScanLine, Search, Ticket, Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { adminBackend } from "../../services/admin";
import { auditoriumToday } from "../../lib/auditoriumDate";
import type { AdminRole } from "../../types";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { Input } from "../common/Input";
import { ApplicationSettings, type AdminAccess, type AppSettings } from "./ApplicationSettings";
import { PollManagement, type AdminPoll } from "./PollManagement";

export interface Movie {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  poster_url: string;
  poster_storage_id: string | null;
  certificate: "U" | "U/A" | "A";
  language: string;
}

export interface ShowRow {
  id: string;
  movie_id: string;
  date: string;
  time: string;
  is_enabled: boolean;
  movies: Movie;
  sold_seats?: number;
  capacity?: number;
  occupancy_percentage?: number;
}

export interface SeatRow {
  id: string;
  section_name: string;
  row_prefix: string;
  row_index: number;
  col_index: number;
  seat_number: string;
  category_name: "Gold" | "Silver";
  price: number | string;
  status: string;
  is_visible: boolean;
}

export interface BookingRow {
  can_restore?: boolean;
  id: string;
  booking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  total_amount: string | number;
  status: string;
  created_at: string;
  shows: ShowRow;
  booking_seats: Array<{ seat_number: string }>;
}

export interface DashboardData {
  today_bookings: number;
  today_revenue: number;
  weekly_revenue: number;
  monthly_revenue: number;
  occupancy_percentage: number;
  upcoming_shows: ShowRow[];
}

interface SectionProps {
  saving: boolean;
  perform: (action: () => Promise<unknown>) => Promise<boolean>;
}

function Subnav<T extends string>({ value, items }: { value: T; items: Array<{ id: T; label: string; to: string }> }) {
  return (
    <nav className="admin-subnav" aria-label="Section views">
      {items.map((item) => (
        <Link key={item.id} to={item.to} className={value === item.id ? "is-active" : ""} aria-current={value === item.id ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

const showDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "2-digit",
  month: "short",
}).format(new Date(`${value}T00:00:00`));

const showTime = (value: string) => {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(2000, 0, 1, hours, minutes));
};

export function OverviewSection({ dashboard, onOpenProgramming }: { dashboard: DashboardData; onOpenProgramming: () => void }) {
  return (
    <section className="admin-dashboard-view">
      <div className="admin-quick-actions">
        <Button onClick={onOpenProgramming}><CalendarDays className="h-4 w-4" /> Schedule show</Button>
        <Link to="/admin/check-in"><Button variant="secondary"><ScanLine className="h-4 w-4" /> Check in ticket</Button></Link>
      </div>
      <div className="admin-metrics">{[
        { label: "Today's bookings", value: dashboard.today_bookings, caption: "Confirmed today", icon: Ticket },
        { label: "Today's revenue", value: `INR ${dashboard.today_revenue.toFixed(2)}`, caption: "Gross sales today", icon: BarChart3 },
        { label: "Weekly revenue", value: `INR ${dashboard.weekly_revenue.toFixed(2)}`, caption: "Current week", icon: BarChart3 },
        { label: "Monthly revenue", value: `INR ${dashboard.monthly_revenue.toFixed(2)}`, caption: "Current month", icon: LayoutGrid },
        { label: "Occupancy", value: `${dashboard.occupancy_percentage}%`, caption: "Upcoming shows", icon: Users },
      ].map(({ label, value, caption, icon: Icon }) => (
        <article className="admin-metric-card" key={label}>
          <div className="admin-metric-icon"><Icon /></div>
          <div><p>{label}</p><strong>{value}</strong><span>{caption}</span></div>
        </article>
      ))}</div>

      <section className="admin-shows-panel">
        <div className="admin-panel-header">
          <div><p className="admin-panel-kicker">Schedule</p><h2>Upcoming shows</h2></div>
          <span>{dashboard.upcoming_shows.length} scheduled</span>
        </div>
        <div className="admin-show-list">
          {dashboard.upcoming_shows.length === 0 ? <p className="admin-empty-state">No upcoming shows are scheduled.</p> : dashboard.upcoming_shows.map((show) => (
            <article key={show.id} className="admin-show-row">
              <img src={show.movies.poster_url} alt="" />
              <div className="admin-show-title"><strong>{show.movies.title}</strong><span>{show.movies.duration_minutes} min</span></div>
              <div className="admin-show-date"><CalendarDays /><span>{showDate(show.date)}</span></div>
              <div className="admin-show-time"><span>{showTime(show.time)}</span></div>
              <div className="admin-show-occupancy"><strong>{show.occupancy_percentage ?? 0}%</strong><span>{show.sold_seats ?? 0}/{show.capacity ?? 0} seats</span></div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export type ProgrammingView = "schedule" | "movies" | "poll";

export function ProgrammingSection({ view, movies, shows, polls, saving, perform, role }: SectionProps & { view: ProgrammingView; movies: Movie[]; shows: ShowRow[]; polls: AdminPoll[]; role: AdminRole }) {
  const [movieForm, setMovieForm] = useState({ title: "", description: "", duration_minutes: "", certificate: "U" as Movie["certificate"], language: "" });
  const [editingMovie, setEditingMovie] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [posterError, setPosterError] = useState("");
  const [posterInputKey, setPosterInputKey] = useState(0);
  const [showForm, setShowForm] = useState({ movie_id: movies[0]?.id ?? "", date: "", time: "19:00" });

  const saveMovie = async (event: FormEvent) => {
    event.preventDefault();
    const existingMovie = editingMovie ? movies.find((movie) => movie.id === editingMovie) : null;
    if (!posterFile && !existingMovie?.poster_storage_id) {
      setPosterError("Choose a poster image.");
      return;
    }
    setPosterError("");
    let uploadedStorageId: string | null = null;
    const succeeded = await perform(async () => {
      if (posterFile) uploadedStorageId = await adminBackend.movies.uploadPoster(posterFile);
      const posterStorageId = uploadedStorageId ?? existingMovie?.poster_storage_id;
      if (!posterStorageId) throw new Error("Choose a poster image.");
      const payload = {
        ...movieForm,
        duration_minutes: Number(movieForm.duration_minutes),
        poster_storage_id: posterStorageId,
      };
      try {
        return editingMovie
          ? await adminBackend.movies.update(editingMovie, payload)
          : await adminBackend.movies.create(payload);
      } catch (reason) {
        if (uploadedStorageId) await adminBackend.movies.discardPoster(uploadedStorageId);
        throw reason;
      }
    });
    if (succeeded) {
      if (posterPreview.startsWith("blob:")) URL.revokeObjectURL(posterPreview);
      setMovieForm({ title: "", description: "", duration_minutes: "", certificate: "U", language: "" });
      setEditingMovie(null);
      setPosterFile(null);
      setPosterPreview("");
      setPosterInputKey((key) => key + 1);
    }
  };

  const choosePoster = (file: File | null) => {
    if (posterPreview.startsWith("blob:")) URL.revokeObjectURL(posterPreview);
    setPosterError("");
    if (!file) {
      setPosterFile(null);
      setPosterPreview("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPosterError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPosterError("Poster must be 10 MB or smaller.");
      return;
    }
    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));
  };

  return (
    <section>
      <Subnav value={view} items={[
        ...(role === "super_admin" ? [
          { id: "schedule" as const, label: "Schedule", to: "/admin/programming/schedule" },
        ] : []),
        { id: "movies", label: "Movie library", to: "/admin/programming/movies" },
        { id: "poll", label: "Weekly poll", to: "/admin/programming/poll" },
      ]} />

      {role === "super_admin" && view === "schedule" && <section className="mt-6 space-y-6">
        <Card><h2 className="font-black text-white">Schedule show</h2><form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); void perform(() => adminBackend.shows.create({ ...showForm, movie_id: showForm.movie_id || movies[0]?.id || "", is_enabled: true })); }}><select required value={showForm.movie_id || movies[0]?.id || ""} onChange={(event) => setShowForm({ ...showForm, movie_id: event.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white sm:col-span-2">{movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select><Input type="date" required value={showForm.date} onChange={(event) => setShowForm({ ...showForm, date: event.target.value })} /><Input type="time" required value={showForm.time} onChange={(event) => setShowForm({ ...showForm, time: event.target.value })} /><Button type="submit" disabled={saving || movies.length === 0} className="sm:col-span-4">Add show</Button></form></Card>
        <Card><div className="divide-y divide-slate-800">{shows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No shows scheduled yet.</p>}{shows.map((show) => <div key={show.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><div><p className="font-bold text-white">{show.movies.title}</p><p className="text-xs text-slate-500">{show.date} · {show.time.slice(0, 5)} · {show.occupancy_percentage ?? 0}% occupied ({show.sold_seats ?? 0}/{show.capacity ?? 0})</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void perform(() => adminBackend.shows.setEnabled(show.id, !show.is_enabled))}>{show.is_enabled ? "Disable" : "Enable"}</Button><Button size="sm" variant="danger" onClick={() => { if (window.confirm("Delete this show? Cancelled tickets and all related booking records will also be permanently deleted.")) void perform(() => adminBackend.shows.delete(show.id)); }}>Delete</Button></div></div>)}</div></Card>
      </section>}

      {view === "movies" && <section className="mt-6 grid gap-7 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="font-black text-white">{editingMovie ? "Edit movie" : "Add movie"}</h2>
          <form onSubmit={(event) => void saveMovie(event)} className="mt-5 space-y-3">
            <Input label="Movie name" required value={movieForm.title} onChange={(event) => setMovieForm({ ...movieForm, title: event.target.value })} />
            <Input label="Description" required value={movieForm.description} onChange={(event) => setMovieForm({ ...movieForm, description: event.target.value })} />
            <Input label="Duration (minutes)" type="number" min="1" required value={movieForm.duration_minutes} onChange={(event) => setMovieForm({ ...movieForm, duration_minutes: event.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Certificate
                <select required value={movieForm.certificate} onChange={(event) => setMovieForm({ ...movieForm, certificate: event.target.value as Movie["certificate"] })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm font-normal normal-case tracking-normal text-white">
                  <option value="U">U</option>
                  <option value="U/A">U/A</option>
                  <option value="A">A (18+)</option>
                </select>
              </label>
              <Input label="Language" required value={movieForm.language} onChange={(event) => setMovieForm({ ...movieForm, language: event.target.value })} />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-300">Poster image</span>
              <span className="flex min-h-32 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 transition hover:border-violet-500/70">
                {posterPreview ? (
                  <img src={posterPreview} alt="Poster preview" className="h-28 w-20 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-28 w-20 place-items-center rounded-lg bg-slate-950 text-slate-600"><ImageUp className="h-7 w-7" /></span>
                )}
                <span className="min-w-0 text-sm text-slate-400">
                  <strong className="block text-slate-200">{posterFile ? posterFile.name : editingMovie ? "Replace poster" : "Choose poster"}</strong>
                  <span className="mt-1 block text-xs">JPEG, PNG or WebP · maximum 10 MB</span>
                </span>
              </span>
              <input
                key={posterInputKey}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => choosePoster(event.target.files?.[0] ?? null)}
              />
            </label>
            {posterError && <p className="text-xs font-medium text-rose-400">{posterError}</p>}
            <Button type="submit" disabled={saving} className="w-full">{editingMovie ? "Save movie" : "Add movie"}</Button>
          </form>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{movies.length === 0 && <Card><p className="text-sm text-slate-500">No movies in the library yet.</p></Card>}{movies.map((movie) => <Card key={movie.id} className="p-0"><img src={movie.poster_url} className="h-44 w-full object-cover" alt="" /><div className="p-4"><h3 className="font-black text-white">{movie.title}</h3><p className="mt-1 line-clamp-2 text-xs text-slate-500">{movie.description}</p><p className="mt-2 text-xs text-slate-400">{movie.duration_minutes} min · {movie.language} · {movie.certificate}</p><div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={() => { if (posterPreview.startsWith("blob:")) URL.revokeObjectURL(posterPreview); setEditingMovie(movie.id); setMovieForm({ title: movie.title, description: movie.description, duration_minutes: String(movie.duration_minutes), certificate: movie.certificate, language: movie.language }); setPosterFile(null); setPosterPreview(movie.poster_url); setPosterError(""); setPosterInputKey((key) => key + 1); }}>Edit</Button><Button size="sm" variant="danger" onClick={() => void perform(() => adminBackend.movies.delete(movie.id))}>Delete</Button></div></div></Card>)}</div>
      </section>}

      {view === "poll" && <PollManagement movies={movies} polls={polls} saving={saving} perform={perform} />}
    </section>
  );
}

export type BookingView = "orders" | "reservations";

export function BookingsSection({ view, bookings, movies, shows, perform, role }: SectionProps & { view: BookingView; bookings: BookingRow[]; movies: Movie[]; shows: ShowRow[]; role: AdminRole }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [movieFilter, setMovieFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const phoneDigits = search.replace(/\D/g, "");
    return bookings.filter((booking) => {
      const matchesSearch = !term
        || `${booking.booking_code} ${booking.customer_name} ${booking.customer_email} ${booking.customer_phone || ""}`.toLowerCase().includes(term)
        || (phoneDigits.length > 0 && (booking.customer_phone || "").replace(/\D/g, "").includes(phoneDigits));
      return matchesSearch
        && (!movieFilter || booking.shows.movie_id === movieFilter)
        && (!dateFilter || booking.shows.date === dateFilter);
    });
  }, [bookings, search, movieFilter, dateFilter]);
  const upcomingShows = useMemo(() => {
    const today = auditoriumToday();
    return shows
      .filter((show) => show.is_enabled && show.date >= today)
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [shows]);
  const upcomingMovies = useMemo(
    () => [...new Map(upcomingShows.map((show) => [show.movie_id, show.movies])).entries()],
    [upcomingShows],
  );

  const exportCsv = () => {
    const rows = [["Booking code", "Movie", "Name", "Email", "Phone", "Seats", "Amount", "Status", "Created"], ...filtered.map((booking) => [booking.booking_code, booking.shows.movies.title, booking.customer_name, booking.customer_email, booking.customer_phone || "", booking.booking_seats.map((seat) => seat.seat_number).join(" "), String(booking.total_amount), booking.status, booking.created_at])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "aravalli-bookings.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section>
      <Subnav value={view} items={[
        ...(role === "super_admin" ? [{ id: "orders" as const, label: "Bookings", to: "/admin/bookings/orders" }] : []),
        { id: "reservations", label: "Reserve seats", to: "/admin/bookings/reservations" },
      ]} />
      {view === "orders" && role === "super_admin" && <PaymentRecovery />}
      {view === "orders" && <section className="mt-6"><div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px_170px_auto]"><label className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, email or code" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white" /></label><select value={movieFilter} onChange={(event) => setMovieFilter(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option value="">All movies</option>{movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white" /><Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button></div><Card className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr>{["Booking", "Movie", "Customer", "Seats", "Amount", "Status", "Actions"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No bookings match these filters.</td></tr>}{filtered.map((booking) => <tr key={booking.id}><td className="px-4 py-3 font-mono text-[rgb(var(--booking-accent-text))]">{booking.booking_code}</td><td className="px-4 py-3 text-white">{booking.shows.movies.title}</td><td className="px-4 py-3 text-slate-300"><span className="font-medium text-slate-100">{booking.customer_name}</span><br /><span className="text-xs text-slate-500">{booking.customer_email || "No email"}</span><br /><span className="text-xs text-slate-600">{booking.customer_phone || "No phone"}</span></td><td className="px-4 py-3 text-slate-300">{booking.booking_seats.map((seat) => seat.seat_number).join(", ")}</td><td className="px-4 py-3 text-white">INR {booking.total_amount}</td><td className="px-4 py-3 text-slate-300">{booking.status}</td><td className="px-4 py-3">{booking.status === "confirmed" ? <Button size="sm" variant="secondary" onClick={() => { if (window.confirm("Cancel this booking? Any online payment will be queued for a full refund. Online bookings cannot be restored after cancellation.")) void perform(() => adminBackend.bookings.setStatus(booking.id, "cancelled")); }}>Cancel</Button> : booking.status === "cancelled" && booking.can_restore ? <Button size="sm" variant="secondary" onClick={() => void perform(() => adminBackend.bookings.setStatus(booking.id, "confirmed"))}>Restore</Button> : null}</td></tr>)}</tbody></table></Card></section>}
      {view === "reservations" && (
        <section className="mt-6 max-w-xl">
          <Card>
            <h2 className="font-black text-white">Create an admin booking</h2>
            <p className="mt-2 text-sm text-slate-400">Choose the movie, then select its day and time before reserving seats without an online payment.</p>
            <div className="mt-5 space-y-3">
              {upcomingMovies.map(([movieId, movie]) => (
                <button
                  key={movieId}
                  type="button"
                  onClick={() => navigate(`/admin/showtimes/${movieId}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-violet-500/60 hover:bg-violet-500/10"
                >
                  {movie.poster_url && <img src={movie.poster_url} alt="" className="h-16 w-11 rounded-md object-cover" />}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-white">{movie.title}</strong>
                    <span className="mt-1 block text-xs text-slate-400">
                      {upcomingShows.filter((show) => show.movie_id === movieId).length} showtimes
                    </span>
                  </span>
                  <span className="text-xs font-bold text-violet-300">Choose showtime</span>
                </button>
              ))}
              {upcomingMovies.length === 0 && <p className="text-sm text-slate-500">No enabled upcoming shows are available.</p>}
            </div>
          </Card>
        </section>
      )}
    </section>
  );
}

export type SetupView = "seats" | "booking" | "access";

export function SetupSection({ view, seats, settings, admins, saving, perform, role }: SectionProps & { view: SetupView; seats: SeatRow[]; settings: AppSettings | null; admins: AdminAccess[]; role: AdminRole }) {
  const emptySeat = { section_name: "", row_prefix: "", row_index: "1", col_index: "1", seat_number: "", category_name: "Gold" as SeatRow["category_name"], price: "120", status: "active", is_visible: true };
  const [form, setForm] = useState(emptySeat);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section>
      <Subnav value={view} items={[
        { id: "seats", label: "Seat layout", to: "/admin/setup/seats" },
        ...(role === "super_admin" ? [
          { id: "booking" as const, label: "Booking & payments", to: "/admin/setup/booking" },
          { id: "access" as const, label: "Admin access", to: "/admin/setup/access" },
        ] : []),
      ]} />
      {view === "seats" && <section className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]"><Card><h2 className="font-black text-white">{editingId ? "Edit seat" : "Add seat"}</h2><form onSubmit={(event) => { event.preventDefault(); const payload = { ...form, row_index: Number(form.row_index), col_index: Number(form.col_index), price: Number(form.price) }; void perform(() => editingId ? adminBackend.seats.update(editingId, payload) : adminBackend.seats.create(payload)); }} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><Input label="Section" required value={form.section_name} onChange={(event) => setForm({ ...form, section_name: event.target.value })} /><Input label="Row" required value={form.row_prefix} onChange={(event) => setForm({ ...form, row_prefix: event.target.value })} /><Input label="Seat number" required value={form.seat_number} onChange={(event) => setForm({ ...form, seat_number: event.target.value })} /><Input label="Row index" type="number" required value={form.row_index} onChange={(event) => setForm({ ...form, row_index: event.target.value })} /><Input label="Column" type="number" required value={form.col_index} onChange={(event) => setForm({ ...form, col_index: event.target.value })} /><Input label="Base price" type="number" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /><select value={form.category_name} onChange={(event) => { const category = event.target.value as SeatRow["category_name"]; setForm({ ...form, category_name: category, price: category === "Gold" ? "120" : "80" }); }} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"><option>Gold</option><option>Silver</option></select><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"><option value="active">Active</option><option value="disabled">Disabled</option></select><Button type="submit" disabled={saving}>{editingId ? "Save seat" : "Add seat"}</Button></form></Card><Card><div className="flex flex-wrap gap-2">{seats.map((seat) => <span key={seat.id} className={`inline-flex items-center overflow-hidden rounded-lg border text-xs font-bold ${seat.status === "active" ? "border-slate-700 bg-slate-900 text-white" : "border-slate-800 bg-slate-950 text-slate-600"}`}><button onClick={() => { setEditingId(seat.id); setForm({ section_name: seat.section_name, row_prefix: seat.row_prefix, row_index: String(seat.row_index), col_index: String(seat.col_index), seat_number: seat.seat_number, category_name: seat.category_name, price: String(seat.price), status: seat.status, is_visible: seat.is_visible }); }} className="px-3 py-2">{seat.seat_number} · {seat.category_name}</button><button onClick={() => void perform(() => adminBackend.seats.delete(seat.id))} className="border-l border-slate-700 px-2 py-2 text-rose-400">×</button></span>)}</div></Card></section>}
      {role === "super_admin" && view === "booking" && <ApplicationSettings view="booking" settings={settings} adminUsers={admins} saving={saving} perform={perform} />}
      {role === "super_admin" && view === "access" && <ApplicationSettings view="access" settings={settings} adminUsers={admins} saving={saving} perform={perform} />}
    </section>
  );
}
