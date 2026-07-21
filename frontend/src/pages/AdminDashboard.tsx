import { BarChart3, CalendarDays, Download, Film, LayoutGrid, LogOut, RefreshCw, Search, Ticket, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Spinner } from "../components/common/Spinner";
import { api, clearAdminSession } from "../services/api";

type Tab = "dashboard" | "movies" | "shows" | "seats" | "bookings" | "polls";

interface Movie {
  id: string; title: string; synopsis: string | null; duration_minutes: number; genre: string;
  certificate: string; language: string; cast_members: string | null; director: string | null;
  release_year: number; poster_url: string | null; trailer_url: string | null; is_active: boolean;
}
interface ShowRow { id: string; movie_id: string; date: string; time: string; is_enabled: boolean; movies: Movie }
interface SeatRow { id: string; section_name: string; row_prefix: string; row_index: number; col_index: number; seat_number: string; category_name: string; price: number | string; status: string; is_visible: boolean }
interface BookingRow { id: string; booking_code: string; customer_name: string; customer_email: string; customer_phone: string | null; total_amount: string | number; status: string; created_at: string; shows: ShowRow; booking_seats: Array<{ seat_number: string }> }
interface PollRow { id: string; week_start: string; voting_starts_at: string; voting_ends_at: string; status: string; winning_movie_id: string | null; poll_options: Array<{ id: string; movie_id: string; votes_count: number; movies: Movie }> }
interface ReservationRow { id: string; show_id: string; seat_layout_id: string; reason: string | null; shows: ShowRow; seat_layouts: SeatRow }
interface DashboardData { today_bookings: number; today_revenue: number; weekly_revenue: number; monthly_revenue: number; total_revenue: number; total_seats_sold: number; occupancy_percentage: number; upcoming_shows: ShowRow[]; current_poll: PollRow | null }

const emptyMovie = { title: "", synopsis: "", duration_minutes: "", genre: "", certificate: "U/A", language: "Hindi", cast_members: "", director: "", release_year: new Date().getFullYear().toString(), poster_url: "", trailer_url: "", is_active: true };
const emptySeat = { section_name: "", row_prefix: "", row_index: "1", col_index: "1", seat_number: "", category_name: "Gold", price: "400", status: "active", is_visible: true };

export function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [bookingMovieFilter, setBookingMovieFilter] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("");

  const [movieForm, setMovieForm] = useState(emptyMovie);
  const [editingMovie, setEditingMovie] = useState<string | null>(null);
  const [showForm, setShowForm] = useState({ movie_id: "", date: "", time: "19:00" });
  const [duplicateForm, setDuplicateForm] = useState({ source_week_start: "", target_week_start: "" });
  const [seatForm, setSeatForm] = useState(emptySeat);
  const [editingSeat, setEditingSeat] = useState<string | null>(null);
  const [reservationForm, setReservationForm] = useState({ show_id: "", seat_layout_id: "", reason: "" });
  const [pollForm, setPollForm] = useState({ week_start: "", voting_starts_at: "", voting_ends_at: "", movie_ids: [] as string[] });

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [dash, movieRows, showRows, seatRows, bookingRows, pollRows, reservationRows] = await Promise.all([
        api.get<DashboardData>("/api/admin/dashboard"), api.get<Movie[]>("/api/admin/movies"),
        api.get<ShowRow[]>("/api/admin/shows"), api.get<SeatRow[]>("/api/admin/seats"),
        api.get<BookingRow[]>("/api/admin/bookings"), api.get<PollRow[]>("/api/admin/polls"),
        api.get<ReservationRow[]>("/api/admin/reservations"),
      ]);
      setDashboard(dash); setMovies(movieRows); setShows(showRows); setSeats(seatRows); setBookings(bookingRows); setPolls(pollRows); setReservations(reservationRows);
      if (!showForm.movie_id && movieRows[0]) setShowForm((value) => ({ ...value, movie_id: movieRows[0].id }));
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);
  const perform = async (action: () => Promise<unknown>) => { setSaving(true); setError(""); try { await action(); await loadAll(); } catch (reason) { setError((reason as Error).message); } finally { setSaving(false); } };

  const saveMovie = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...movieForm, duration_minutes: Number(movieForm.duration_minutes), release_year: Number(movieForm.release_year), synopsis: movieForm.synopsis || null, cast_members: movieForm.cast_members || null, director: movieForm.director || null, poster_url: movieForm.poster_url || null, trailer_url: movieForm.trailer_url || null };
    void perform(() => editingMovie ? api.put(`/api/admin/movies/${editingMovie}`, payload) : api.post("/api/admin/movies", payload));
    setMovieForm(emptyMovie); setEditingMovie(null);
  };
  const editMovie = (movie: Movie) => { setEditingMovie(movie.id); setMovieForm({ title: movie.title, synopsis: movie.synopsis || "", duration_minutes: String(movie.duration_minutes), genre: movie.genre, certificate: movie.certificate, language: movie.language, cast_members: movie.cast_members || "", director: movie.director || "", release_year: String(movie.release_year), poster_url: movie.poster_url || "", trailer_url: movie.trailer_url || "", is_active: movie.is_active }); };

  const saveSeat = (event: FormEvent) => { event.preventDefault(); const payload = { ...seatForm, row_index: Number(seatForm.row_index), col_index: Number(seatForm.col_index), price: Number(seatForm.price) }; void perform(() => editingSeat ? api.put(`/api/admin/seats/${editingSeat}`, payload) : api.post("/api/admin/seats", payload)); setSeatForm(emptySeat); setEditingSeat(null); };
  const editSeat = (seat: SeatRow) => { setEditingSeat(seat.id); setSeatForm({ section_name: seat.section_name, row_prefix: seat.row_prefix, row_index: String(seat.row_index), col_index: String(seat.col_index), seat_number: seat.seat_number, category_name: seat.category_name, price: String(seat.price), status: seat.status, is_visible: seat.is_visible }); };

  const filteredBookings = useMemo(() => bookings.filter((booking) =>
    `${booking.booking_code} ${booking.customer_email} ${booking.customer_phone || ""}`.toLowerCase().includes(search.toLowerCase())
    && (!bookingMovieFilter || booking.shows.movie_id === bookingMovieFilter)
    && (!bookingDateFilter || booking.shows.date === bookingDateFilter)
  ), [bookings, search, bookingMovieFilter, bookingDateFilter]);
  const exportCsv = () => {
    const rows = [["Booking code", "Movie", "Email", "Phone", "Seats", "Amount", "Status", "Created"], ...filteredBookings.map((booking) => [booking.booking_code, booking.shows.movies.title, booking.customer_email, booking.customer_phone || "", booking.booking_seats.map((seat) => seat.seat_number).join(" "), String(booking.total_amount), booking.status, booking.created_at])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "aravalli-bookings.csv"; link.click(); URL.revokeObjectURL(link.href);
  };

  if (loading && !dashboard) return <div className="flex min-h-[70vh] items-center justify-center"><Spinner size="lg" /></div>;

  const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 }, { id: "movies", label: "Movies", icon: Film },
    { id: "shows", label: "Shows", icon: CalendarDays }, { id: "seats", label: "Seats", icon: LayoutGrid },
    { id: "bookings", label: "Bookings", icon: Ticket }, { id: "polls", label: "Polls", icon: Users },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400">Protected administration</p><h1 className="mt-2 text-3xl font-black text-white">Auditorium operations</h1></div>
        <div className="flex gap-3"><Link to="/admin/check-in"><Button variant="secondary">Check-in</Button></Link><Button variant="ghost" className="gap-2" onClick={() => { clearAdminSession(); navigate("/admin/login"); }}><LogOut className="h-4 w-4" /> Sign out</Button></div>
      </div>

      <div className="seat-map-scrollbar mt-7 flex gap-2 overflow-x-auto pb-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${tab === id ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      {error && <p className="mt-5 rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-sm text-rose-300">{error}</p>}

      {tab === "dashboard" && dashboard && <section className="mt-7 space-y-7">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
          ["Today's bookings", dashboard.today_bookings], ["Today's revenue", `INR ${dashboard.today_revenue.toFixed(2)}`], ["Weekly revenue", `INR ${dashboard.weekly_revenue.toFixed(2)}`], ["Monthly revenue", `INR ${dashboard.monthly_revenue.toFixed(2)}`], ["Occupancy", `${dashboard.occupancy_percentage}%`],
        ].map(([label, value]) => <Card key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></Card>)}</div>
        <Card><div className="flex justify-between"><h2 className="font-black text-white">Upcoming shows</h2><Button size="sm" variant="ghost" onClick={() => void loadAll()} className="gap-2"><RefreshCw className="h-4 w-4" />Refresh</Button></div><div className="mt-4 divide-y divide-slate-800">{dashboard.upcoming_shows.map((show) => <div key={show.id} className="flex justify-between gap-4 py-3 text-sm"><span className="font-bold text-white">{show.movies.title}</span><span className="text-slate-400">{show.date} · {show.time.slice(0, 5)}</span></div>)}</div></Card>
      </section>}

      {tab === "movies" && <section className="mt-7 grid gap-7 lg:grid-cols-[380px_1fr]">
        <Card><h2 className="font-black text-white">{editingMovie ? "Edit movie" : "Add movie"}</h2><form onSubmit={saveMovie} className="mt-5 space-y-3"><Input label="Title" required value={movieForm.title} onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })} /><Input label="Synopsis" value={movieForm.synopsis} onChange={(e) => setMovieForm({ ...movieForm, synopsis: e.target.value })} /><div className="grid grid-cols-2 gap-3"><Input label="Duration" type="number" required value={movieForm.duration_minutes} onChange={(e) => setMovieForm({ ...movieForm, duration_minutes: e.target.value })} /><Input label="Release year" type="number" required value={movieForm.release_year} onChange={(e) => setMovieForm({ ...movieForm, release_year: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><Input label="Genre" required value={movieForm.genre} onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })} /><Input label="Certificate" required value={movieForm.certificate} onChange={(e) => setMovieForm({ ...movieForm, certificate: e.target.value })} /></div><Input label="Language" required value={movieForm.language} onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })} /><Input label="Cast" value={movieForm.cast_members} onChange={(e) => setMovieForm({ ...movieForm, cast_members: e.target.value })} /><Input label="Director" value={movieForm.director} onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })} /><Input label="Poster URL" value={movieForm.poster_url} onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })} /><Input label="Trailer URL" value={movieForm.trailer_url} onChange={(e) => setMovieForm({ ...movieForm, trailer_url: e.target.value })} /><Button type="submit" disabled={saving} className="w-full">{editingMovie ? "Save movie" : "Add movie"}</Button></form></Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{movies.map((movie) => <Card key={movie.id} className="p-0"><img src={movie.poster_url || "https://placehold.co/600x900/20252C/D4AF37?text=Movie"} className="h-44 w-full object-cover" alt="" /><div className="p-4"><h3 className="font-black text-white">{movie.title}</h3><p className="mt-1 text-xs text-slate-500">{movie.genre} · {movie.duration_minutes} min</p><div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={() => editMovie(movie)}>Edit</Button><Button size="sm" variant="danger" onClick={() => void perform(() => api.delete(`/api/admin/movies/${movie.id}`))}>Delete</Button></div></div></Card>)}</div>
      </section>}

      {tab === "shows" && <section className="mt-7 space-y-6"><div className="grid gap-5 lg:grid-cols-2"><Card><h2 className="font-black text-white">Schedule show</h2><form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); void perform(() => api.post("/api/admin/shows", { ...showForm, is_enabled: true })); }}><select required value={showForm.movie_id} onChange={(e) => setShowForm({ ...showForm, movie_id: e.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white sm:col-span-2">{movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select><Input type="date" required value={showForm.date} onChange={(e) => setShowForm({ ...showForm, date: e.target.value })} /><Input type="time" required value={showForm.time} onChange={(e) => setShowForm({ ...showForm, time: e.target.value })} /><Button type="submit" className="sm:col-span-4">Add show</Button></form></Card><Card><h2 className="font-black text-white">Duplicate week</h2><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void perform(() => api.post("/api/admin/shows/duplicate-week", duplicateForm)); }}><Input label="Source Monday" type="date" required value={duplicateForm.source_week_start} onChange={(e) => setDuplicateForm({ ...duplicateForm, source_week_start: e.target.value })} /><Input label="Target Monday" type="date" required value={duplicateForm.target_week_start} onChange={(e) => setDuplicateForm({ ...duplicateForm, target_week_start: e.target.value })} /><Button type="submit" className="sm:col-span-2">Duplicate schedule</Button></form></Card></div><Card><div className="divide-y divide-slate-800">{shows.map((show) => <div key={show.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><div><p className="font-bold text-white">{show.movies.title}</p><p className="text-xs text-slate-500">{show.date} · {show.time.slice(0, 5)}</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void perform(() => api.patch(`/api/admin/shows/${show.id}`, { is_enabled: !show.is_enabled }))}>{show.is_enabled ? "Disable" : "Enable"}</Button><Button size="sm" variant="danger" onClick={() => void perform(() => api.delete(`/api/admin/shows/${show.id}`))}>Delete</Button></div></div>)}</div></Card></section>}

      {tab === "seats" && <section className="mt-7 space-y-6"><div className="grid gap-5 xl:grid-cols-2"><Card><h2 className="font-black text-white">{editingSeat ? "Edit seat" : "Add seat"}</h2><form onSubmit={saveSeat} className="mt-4 grid gap-3 sm:grid-cols-3"><Input label="Section" required value={seatForm.section_name} onChange={(e) => setSeatForm({ ...seatForm, section_name: e.target.value })} /><Input label="Row" required value={seatForm.row_prefix} onChange={(e) => setSeatForm({ ...seatForm, row_prefix: e.target.value })} /><Input label="Seat number" required value={seatForm.seat_number} onChange={(e) => setSeatForm({ ...seatForm, seat_number: e.target.value })} /><Input label="Row index" type="number" required value={seatForm.row_index} onChange={(e) => setSeatForm({ ...seatForm, row_index: e.target.value })} /><Input label="Column" type="number" required value={seatForm.col_index} onChange={(e) => setSeatForm({ ...seatForm, col_index: e.target.value })} /><Input label="Price" type="number" required value={seatForm.price} onChange={(e) => setSeatForm({ ...seatForm, price: e.target.value })} /><select value={seatForm.category_name} onChange={(e) => setSeatForm({ ...seatForm, category_name: e.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option>VIP</option><option>Gold</option><option>Silver</option><option>Bronze</option></select><select value={seatForm.status} onChange={(e) => setSeatForm({ ...seatForm, status: e.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option value="active">Active</option><option value="disabled">Disabled</option></select><Button type="submit">{editingSeat ? "Save" : "Add seat"}</Button></form></Card><Card><h2 className="font-black text-white">Reserve for show</h2><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void perform(() => api.post("/api/admin/reservations", reservationForm)); }}><select required value={reservationForm.show_id} onChange={(e) => setReservationForm({ ...reservationForm, show_id: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"><option value="">Select show</option>{shows.map((show) => <option key={show.id} value={show.id}>{show.date} {show.time.slice(0, 5)} · {show.movies.title}</option>)}</select><select required value={reservationForm.seat_layout_id} onChange={(e) => setReservationForm({ ...reservationForm, seat_layout_id: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"><option value="">Select seat</option>{seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.seat_number} · {seat.section_name}</option>)}</select><Input placeholder="Reason (optional)" value={reservationForm.reason} onChange={(e) => setReservationForm({ ...reservationForm, reason: e.target.value })} /><Button type="submit" className="w-full">Reserve seat</Button></form></Card></div><Card><div className="flex flex-wrap gap-2">{seats.map((seat) => <span key={seat.id} className={`inline-flex items-center overflow-hidden rounded-lg border text-xs font-bold ${seat.status === "active" ? "border-slate-700 bg-slate-900 text-white" : "border-slate-800 bg-slate-950 text-slate-600"}`}><button onClick={() => editSeat(seat)} className="px-3 py-2">{seat.seat_number} · {seat.category_name}</button><button onClick={() => void perform(() => api.delete(`/api/admin/seats/${seat.id}`))} className="border-l border-slate-700 px-2 py-2 text-rose-400">×</button></span>)}</div></Card><Card><h2 className="font-black text-white">Active reservations</h2><div className="mt-3 divide-y divide-slate-800">{reservations.map((reservation) => <div key={reservation.id} className="flex justify-between gap-4 py-3 text-sm"><span className="text-white">{reservation.seat_layouts.seat_number} · {reservation.shows.date} {reservation.shows.time.slice(0, 5)}</span><Button size="sm" variant="danger" onClick={() => void perform(() => api.delete(`/api/admin/reservations/${reservation.id}`))}>Release</Button></div>)}</div></Card></section>}

      {tab === "bookings" && <section className="mt-7"><div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px_170px_auto]"><label className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, email or phone" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white" /></label><select value={bookingMovieFilter} onChange={(e) => setBookingMovieFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option value="">All movies</option>{movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select><input type="date" value={bookingDateFilter} onChange={(e) => setBookingDateFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white" /><Button variant="secondary" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button></div><Card className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr>{["Booking", "Movie", "Customer", "Seats", "Amount", "Status", "Actions"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filteredBookings.map((booking) => <tr key={booking.id}><td className="px-4 py-3 font-mono text-amber-400">{booking.booking_code}</td><td className="px-4 py-3 text-white">{booking.shows.movies.title}</td><td className="px-4 py-3 text-slate-300">{booking.customer_email}<br /><span className="text-xs text-slate-600">{booking.customer_phone || "No phone"}</span></td><td className="px-4 py-3 text-slate-300">{booking.booking_seats.map((seat) => seat.seat_number).join(", ")}</td><td className="px-4 py-3 text-white">INR {booking.total_amount}</td><td className="px-4 py-3 text-slate-300">{booking.status}</td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void perform(() => api.patch(`/api/admin/bookings/${booking.id}/status`, { status: "cancelled" }))}>Cancel</Button><Button size="sm" variant="danger" onClick={() => void perform(() => api.patch(`/api/admin/bookings/${booking.id}/status`, { status: "refunded" }))}>Refunded</Button></div></td></tr>)}</tbody></table></Card></section>}

      {tab === "polls" && <section className="mt-7 grid gap-7 lg:grid-cols-[380px_1fr]"><Card><h2 className="font-black text-white">Create poll</h2><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void perform(() => api.post("/api/admin/polls", { ...pollForm, voting_starts_at: new Date(pollForm.voting_starts_at).toISOString(), voting_ends_at: new Date(pollForm.voting_ends_at).toISOString() })); }}><Input label="Movie week (Monday)" type="date" required value={pollForm.week_start} onChange={(e) => setPollForm({ ...pollForm, week_start: e.target.value })} /><Input label="Voting starts" type="datetime-local" required value={pollForm.voting_starts_at} onChange={(e) => setPollForm({ ...pollForm, voting_starts_at: e.target.value })} /><Input label="Voting ends" type="datetime-local" required value={pollForm.voting_ends_at} onChange={(e) => setPollForm({ ...pollForm, voting_ends_at: e.target.value })} /><div><p className="mb-2 text-xs font-bold uppercase text-slate-500">Options</p>{movies.map((movie) => <label key={movie.id} className="flex items-center gap-2 py-1 text-sm text-slate-300"><input type="checkbox" checked={pollForm.movie_ids.includes(movie.id)} onChange={() => setPollForm({ ...pollForm, movie_ids: pollForm.movie_ids.includes(movie.id) ? pollForm.movie_ids.filter((id) => id !== movie.id) : [...pollForm.movie_ids, movie.id] })} />{movie.title}</label>)}</div><Button type="submit" className="w-full" disabled={pollForm.movie_ids.length < 2}>Create poll</Button></form></Card><div className="space-y-4">{polls.map((poll) => <Card key={poll.id}><div className="flex justify-between"><div><h3 className="font-black text-white">Week of {poll.week_start}</h3><p className="mt-1 text-xs text-slate-500">{poll.status} · ends {new Date(poll.voting_ends_at).toLocaleString()}</p></div><span className="text-sm font-bold text-amber-400">{poll.poll_options.reduce((sum, option) => sum + option.votes_count, 0)} votes</span></div><div className="mt-4 space-y-2">{poll.poll_options.map((option) => <div key={option.id} className="flex items-center justify-between rounded-lg bg-slate-900 p-3 text-sm"><span className="text-white">{option.movies.title} · {option.votes_count}</span><Button size="sm" variant="secondary" onClick={() => void perform(() => api.post(`/api/admin/polls/${poll.id}/override`, { movie_id: option.movie_id }))}>Set winner</Button></div>)}</div></Card>)}</div></section>}
    </div>
  );
}
