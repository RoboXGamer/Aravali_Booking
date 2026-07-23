import { BarChart3, CalendarDays, Clock3, Download, Film, LayoutGrid, LogOut, Menu, ScanLine, Search, Settings2, Ticket, Users, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Spinner } from "../components/common/Spinner";
import { ApplicationSettings, type AdminAccess, type AppSettings } from "../components/admin/ApplicationSettings";
import { PollManagement, type AdminPoll } from "../components/admin/PollManagement";
import { authClient } from "../lib/auth-client";
import { adminBackend } from "../services/admin";
import "../admin-dashboard.css";

type Tab = "dashboard" | "movies" | "shows" | "seats" | "bookings" | "polls" | "settings";

interface Movie {
  id: string; title: string; description: string; duration_minutes: number; poster_url: string;
}
interface ShowRow { id: string; movie_id: string; date: string; time: string; is_enabled: boolean; movies: Movie; sold_seats?: number; capacity?: number; occupancy_percentage?: number }
interface SeatRow { id: string; section_name: string; row_prefix: string; row_index: number; col_index: number; seat_number: string; category_name: string; price: number | string; status: string; is_visible: boolean }
interface BookingRow { id: string; booking_code: string; customer_name: string; customer_email: string; customer_phone: string | null; total_amount: string | number; status: string; created_at: string; shows: ShowRow; booking_seats: Array<{ seat_number: string }> }
interface ReservationRow { id: string; show_id: string; seat_layout_id: string; reason: string | null; shows: ShowRow; seat_layouts: SeatRow }
interface DashboardData { today_bookings: number; today_revenue: number; weekly_revenue: number; monthly_revenue: number; total_revenue: number; total_seats_sold: number; occupancy_percentage: number; upcoming_shows: ShowRow[]; current_poll: AdminPoll | null }

const emptyMovie = { title: "", description: "", duration_minutes: "", poster_url: "" };
const emptySeat = { section_name: "", row_prefix: "", row_index: "1", col_index: "1", seat_number: "", category_name: "Gold", price: "400", status: "active", is_visible: true };

const formatShowDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "2-digit",
  month: "short",
}).format(new Date(`${value}T00:00:00`));

const formatShowTime = (value: string) => {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(2000, 0, 1, hours, minutes));
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [polls, setPolls] = useState<AdminPoll[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [bookingMovieFilter, setBookingMovieFilter] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [movieForm, setMovieForm] = useState(emptyMovie);
  const [editingMovie, setEditingMovie] = useState<string | null>(null);
  const [showForm, setShowForm] = useState({ movie_id: "", date: "", time: "19:00" });
  const [seatForm, setSeatForm] = useState(emptySeat);
  const [editingSeat, setEditingSeat] = useState<string | null>(null);
  const [reservationForm, setReservationForm] = useState({ show_id: "", seat_layout_id: "", reason: "" });

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let result = await adminBackend.loadAll();
      if (!result.settings) {
        await adminBackend.initializeSettings();
        result = await adminBackend.loadAll();
      }
      const { dashboard: dash, movies: movieRows, shows: showRows, seats: seatRows, bookings: bookingRows, polls: pollRows, reservations: reservationRows, settings: settingsRow } = result;
      setDashboard(dash); setMovies(movieRows); setShows(showRows); setSeats(seatRows); setBookings(bookingRows); setPolls(pollRows); setReservations(reservationRows); setAppSettings(settingsRow); setAdminUsers(result.adminUsers);
      if (!showForm.movie_id && movieRows[0]) setShowForm((value) => ({ ...value, movie_id: movieRows[0].id }));
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadAll();
    const refreshTimer = window.setInterval(() => void loadAll(), 10 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [loadAll]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth > 760) setMobileNavOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [mobileNavOpen]);
  const perform = async (action: () => Promise<unknown>): Promise<boolean> => { setSaving(true); setError(""); try { await action(); await loadAll(); return true; } catch (reason) { setError((reason as Error).message); return false; } finally { setSaving(false); } };

  const saveMovie = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...movieForm, duration_minutes: Number(movieForm.duration_minutes) };
    void perform(() => editingMovie ? adminBackend.movies.update(editingMovie, payload) : adminBackend.movies.create(payload));
    setMovieForm(emptyMovie); setEditingMovie(null);
  };
  const editMovie = (movie: Movie) => { setEditingMovie(movie.id); setMovieForm({ title: movie.title, description: movie.description, duration_minutes: String(movie.duration_minutes), poster_url: movie.poster_url }); };

  const saveSeat = (event: FormEvent) => { event.preventDefault(); const payload = { ...seatForm, row_index: Number(seatForm.row_index), col_index: Number(seatForm.col_index), price: Number(seatForm.price) }; void perform(() => editingSeat ? adminBackend.seats.update(editingSeat, payload) : adminBackend.seats.create(payload)); setSeatForm(emptySeat); setEditingSeat(null); };
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
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="admin-page">
      <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-title">
          <button className="admin-menu-button" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open administration menu">
            <Menu />
          </button>
          <h1>Auditorium operations</h1>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/check-in"><Button variant="secondary" className="gap-2"><ScanLine className="h-4 w-4" /> Check-in</Button></Link>
          <Button variant="ghost" className="gap-2" onClick={() => { void authClient.signOut().finally(() => navigate("/admin/login")); }}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </header>

      <nav className="admin-tabs admin-tabs-desktop" aria-label="Administration sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined}>
            <Icon />{label}
          </button>
        ))}
      </nav>

      {mobileNavOpen && (
        <div className="admin-mobile-nav" role="presentation">
          <button className="admin-mobile-nav-backdrop" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close administration menu" />
          <aside className="admin-mobile-drawer" role="dialog" aria-modal="true" aria-label="Administration menu">
            <div className="admin-mobile-drawer-header">
              <div>
                <span>Administration</span>
                <strong>Auditorium operations</strong>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close administration menu"><X /></button>
            </div>

            <nav className="admin-mobile-tabs" aria-label="Administration sections">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setTab(id); setMobileNavOpen(false); }}
                  className={tab === id ? "is-active" : ""}
                  aria-current={tab === id ? "page" : undefined}
                >
                  <Icon /><span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="admin-mobile-drawer-actions">
              <Link to="/admin/check-in" onClick={() => setMobileNavOpen(false)}><ScanLine />Check-in</Link>
              <button type="button" onClick={() => { setMobileNavOpen(false); void authClient.signOut().finally(() => navigate("/admin/login")); }}>
                <LogOut />Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
      {error && <p className="mt-5 rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-sm text-rose-300">{error}</p>}

      {tab === "dashboard" && dashboard && <section className="admin-dashboard-view">
        <div className="admin-metrics">{[
          { label: "Today's bookings", value: dashboard.today_bookings, caption: "Confirmed today", icon: Ticket },
          { label: "Today's revenue", value: `INR ${dashboard.today_revenue.toFixed(2)}`, caption: "Gross sales today", icon: BarChart3 },
          { label: "Monthly revenue", value: `INR ${dashboard.monthly_revenue.toFixed(2)}`, caption: "Current month", icon: LayoutGrid },
          { label: "Occupancy", value: `${dashboard.occupancy_percentage}%`, caption: "Average across upcoming shows", icon: Users },
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
            {dashboard.upcoming_shows.length === 0 ? (
              <p className="admin-empty-state">No upcoming shows are scheduled.</p>
            ) : dashboard.upcoming_shows.map((show) => (
              <article key={show.id} className="admin-show-row">
                <img src={show.movies.poster_url} alt="" />
                <div className="admin-show-title"><strong>{show.movies.title}</strong><span>{show.movies.duration_minutes} min</span></div>
                <div className="admin-show-date"><CalendarDays /><span>{formatShowDate(show.date)}</span></div>
                <div className="admin-show-time"><Clock3 /><span>{formatShowTime(show.time)}</span></div>
                <div className="admin-show-occupancy"><strong>{show.occupancy_percentage ?? 0}%</strong><span>{show.sold_seats ?? 0}/{show.capacity ?? 0} seats</span></div>
              </article>
            ))}
          </div>
        </section>
      </section>}

      {tab === "movies" && <section className="mt-7 grid gap-7 lg:grid-cols-[380px_1fr]">
        <Card><h2 className="font-black text-white">{editingMovie ? "Edit movie" : "Add movie"}</h2><form onSubmit={saveMovie} className="mt-5 space-y-3"><Input label="Movie name" required value={movieForm.title} onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })} /><Input label="Description" required value={movieForm.description} onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })} /><Input label="Duration (minutes)" type="number" min="1" required value={movieForm.duration_minutes} onChange={(e) => setMovieForm({ ...movieForm, duration_minutes: e.target.value })} /><Input label="Poster URL" type="url" required value={movieForm.poster_url} onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })} /><Button type="submit" disabled={saving} className="w-full">{editingMovie ? "Save movie" : "Add movie"}</Button></form></Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{movies.map((movie) => <Card key={movie.id} className="p-0"><img src={movie.poster_url} className="h-44 w-full object-cover" alt="" /><div className="p-4"><h3 className="font-black text-white">{movie.title}</h3><p className="mt-1 line-clamp-2 text-xs text-slate-500">{movie.description}</p><p className="mt-2 text-xs text-slate-400">{movie.duration_minutes} min</p><div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={() => editMovie(movie)}>Edit</Button><Button size="sm" variant="danger" onClick={() => void perform(() => adminBackend.movies.delete(movie.id))}>Delete</Button></div></div></Card>)}</div>
      </section>}

      {tab === "shows" && <section className="mt-7 space-y-6"><Card><h2 className="font-black text-white">Schedule show</h2><form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); void perform(() => adminBackend.shows.create({ ...showForm, is_enabled: true })); }}><select required value={showForm.movie_id} onChange={(e) => setShowForm({ ...showForm, movie_id: e.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white sm:col-span-2">{movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select><Input type="date" required value={showForm.date} onChange={(e) => setShowForm({ ...showForm, date: e.target.value })} /><Input type="time" required value={showForm.time} onChange={(e) => setShowForm({ ...showForm, time: e.target.value })} /><Button type="submit" className="sm:col-span-4">Add show</Button></form></Card><Card><div className="divide-y divide-slate-800">{shows.map((show) => <div key={show.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><div><p className="font-bold text-white">{show.movies.title}</p><p className="text-xs text-slate-500">{show.date} · {show.time.slice(0, 5)} · {show.occupancy_percentage ?? 0}% occupied ({show.sold_seats ?? 0}/{show.capacity ?? 0})</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void perform(() => adminBackend.shows.setEnabled(show.id, !show.is_enabled))}>{show.is_enabled ? "Disable" : "Enable"}</Button><Button size="sm" variant="danger" onClick={() => void perform(() => adminBackend.shows.delete(show.id))}>Delete</Button></div></div>)}</div></Card></section>}

      {tab === "seats" && <section className="mt-7 space-y-6"><div className="grid gap-5 xl:grid-cols-2"><Card><h2 className="font-black text-white">{editingSeat ? "Edit seat" : "Add seat"}</h2><form onSubmit={saveSeat} className="mt-4 grid gap-3 sm:grid-cols-3"><Input label="Section" required value={seatForm.section_name} onChange={(e) => setSeatForm({ ...seatForm, section_name: e.target.value })} /><Input label="Row" required value={seatForm.row_prefix} onChange={(e) => setSeatForm({ ...seatForm, row_prefix: e.target.value })} /><Input label="Seat number" required value={seatForm.seat_number} onChange={(e) => setSeatForm({ ...seatForm, seat_number: e.target.value })} /><Input label="Row index" type="number" required value={seatForm.row_index} onChange={(e) => setSeatForm({ ...seatForm, row_index: e.target.value })} /><Input label="Column" type="number" required value={seatForm.col_index} onChange={(e) => setSeatForm({ ...seatForm, col_index: e.target.value })} /><Input label="Price" type="number" required value={seatForm.price} onChange={(e) => setSeatForm({ ...seatForm, price: e.target.value })} /><select value={seatForm.category_name} onChange={(e) => setSeatForm({ ...seatForm, category_name: e.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option>VIP</option><option>Gold</option><option>Silver</option><option>Bronze</option></select><select value={seatForm.status} onChange={(e) => setSeatForm({ ...seatForm, status: e.target.value })} className="rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option value="active">Active</option><option value="disabled">Disabled</option></select><Button type="submit">{editingSeat ? "Save" : "Add seat"}</Button></form></Card><Card><h2 className="font-black text-white">Reserve for show</h2><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void perform(() => adminBackend.reservations.create(reservationForm)); }}><select required value={reservationForm.show_id} onChange={(e) => setReservationForm({ ...reservationForm, show_id: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"><option value="">Select show</option>{shows.map((show) => <option key={show.id} value={show.id}>{show.date} {show.time.slice(0, 5)} · {show.movies.title}</option>)}</select><select required value={reservationForm.seat_layout_id} onChange={(e) => setReservationForm({ ...reservationForm, seat_layout_id: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"><option value="">Select seat</option>{seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.seat_number} · {seat.section_name}</option>)}</select><Input placeholder="Reason (optional)" value={reservationForm.reason} onChange={(e) => setReservationForm({ ...reservationForm, reason: e.target.value })} /><Button type="submit" className="w-full">Reserve seat</Button></form></Card></div><Card><div className="flex flex-wrap gap-2">{seats.map((seat) => <span key={seat.id} className={`inline-flex items-center overflow-hidden rounded-lg border text-xs font-bold ${seat.status === "active" ? "border-slate-700 bg-slate-900 text-white" : "border-slate-800 bg-slate-950 text-slate-600"}`}><button onClick={() => editSeat(seat)} className="px-3 py-2">{seat.seat_number} · {seat.category_name}</button><button onClick={() => void perform(() => adminBackend.seats.delete(seat.id))} className="border-l border-slate-700 px-2 py-2 text-rose-400">×</button></span>)}</div></Card><Card><h2 className="font-black text-white">Active reservations</h2><div className="mt-3 divide-y divide-slate-800">{reservations.map((reservation) => <div key={reservation.id} className="flex justify-between gap-4 py-3 text-sm"><span className="text-white">{reservation.seat_layouts.seat_number} · {reservation.shows.date} {reservation.shows.time.slice(0, 5)}</span><Button size="sm" variant="danger" onClick={() => void perform(() => adminBackend.reservations.delete(reservation.id))}>Release</Button></div>)}</div></Card></section>}

      {tab === "bookings" && <section className="mt-7"><div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px_170px_auto]"><label className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, email or phone" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white" /></label><select value={bookingMovieFilter} onChange={(e) => setBookingMovieFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white"><option value="">All movies</option>{movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select><input type="date" value={bookingDateFilter} onChange={(e) => setBookingDateFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white" /><Button variant="secondary" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button></div><Card className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr>{["Booking", "Movie", "Customer", "Seats", "Amount", "Status", "Actions"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filteredBookings.map((booking) => <tr key={booking.id}><td className="px-4 py-3 font-mono text-[rgb(var(--booking-accent-text))]">{booking.booking_code}</td><td className="px-4 py-3 text-white">{booking.shows.movies.title}</td><td className="px-4 py-3 text-slate-300">{booking.customer_email}<br /><span className="text-xs text-slate-600">{booking.customer_phone || "No phone"}</span></td><td className="px-4 py-3 text-slate-300">{booking.booking_seats.map((seat) => seat.seat_number).join(", ")}</td><td className="px-4 py-3 text-white">INR {booking.total_amount}</td><td className="px-4 py-3 text-slate-300">{booking.status}</td><td className="px-4 py-3"><div className="flex gap-2">{booking.status === "confirmed" && <Button size="sm" variant="secondary" onClick={() => void perform(() => adminBackend.bookings.setStatus(booking.id, "cancelled"))}>Cancel</Button>}{booking.status === "cancelled" && <Button size="sm" variant="secondary" onClick={() => void perform(() => adminBackend.bookings.setStatus(booking.id, "confirmed"))}>Restore</Button>}</div></td></tr>)}</tbody></table></Card></section>}

      {tab === "polls" && <PollManagement movies={movies} polls={polls} saving={saving} perform={perform} />}
      {tab === "settings" && <ApplicationSettings settings={appSettings} adminUsers={adminUsers} saving={saving} perform={perform} />}
      </main>
    </div>
  );
}
