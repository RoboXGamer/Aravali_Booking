import { CalendarDays, Clapperboard, LayoutDashboard, LogOut, Menu, ScanLine, Settings2, Ticket, X } from "lucide-react";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  BookingsSection,
  type BookingRow,
  type DashboardData,
  type Movie,
  OverviewSection,
  ProgrammingSection,
  type ProgrammingView,
  type BookingView,
  type SeatRow,
  SetupSection,
  type SetupView,
  type ShowRow,
} from "../components/admin/AdminSections";
import type { AdminAccess, AppSettings } from "../components/admin/ApplicationSettings";
import type { AdminPoll } from "../components/admin/PollManagement";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { api } from "../../convex/_generated/api";
import { authClient } from "../lib/auth-client";
import { adminBackend } from "../services/admin";
import type { AdminRole } from "../types";
import "../admin-dashboard.css";

type AdminSection = "overview" | "programming" | "bookings" | "setup";

const navigation: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "programming", label: "Programming", icon: Clapperboard },
  { id: "bookings", label: "Bookings", icon: Ticket },
  { id: "setup", label: "Setup", icon: Settings2 },
];

const sectionViews = {
  programming: ["schedule", "movies", "poll"],
  bookings: ["orders", "reservations"],
  setup: ["seats", "booking", "access"],
} as const;

const availableViews = (section: AdminSection, role: AdminRole): readonly string[] => {
  if (section === "overview") return [];
  if (role === "super_admin") return sectionViews[section];
  if (section === "programming") return ["movies", "poll"];
  if (section === "bookings") return ["reservations"];
  return ["seats"];
};

const sectionPath = (section: AdminSection, role: AdminRole) => {
  if (section === "overview") return "/admin";
  return `/admin/${section}/${availableViews(section, role)[0]}`;
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const params = useParams<{ section?: string; view?: string }>();
  const admin = useQuery(api.auth.getCurrentAdmin);
  const role: AdminRole = admin?.role ?? "operations";
  const allowedNavigation = role === "super_admin"
    ? navigation
    : navigation.filter((item) => item.id !== "overview");
  const defaultSection: AdminSection = role === "super_admin" ? "overview" : "bookings";
  const requestedSection = params.section;
  const section: AdminSection = allowedNavigation.some((item) => item.id === requestedSection)
    ? requestedSection as AdminSection
    : defaultSection;
  const requestedView = params.view;
  const views = availableViews(section, role);
  const sectionView = section === "overview"
    ? null
    : views.includes(requestedView ?? "")
      ? requestedView
      : views[0];

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [polls, setPolls] = useState<AdminPoll[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [admins, setAdmins] = useState<AdminAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadSection = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let result = await adminBackend.loadSection(section);
      if (role === "super_admin" && section === "setup" && !result.settings) {
        await adminBackend.initializeSettings();
        result = await adminBackend.loadSection(section);
      }
      if (result.dashboard) setDashboard(result.dashboard as unknown as DashboardData);
      setMovies(result.movies as unknown as Movie[]);
      setShows(result.shows as unknown as ShowRow[]);
      setSeats(result.seats as unknown as SeatRow[]);
      setBookings(result.bookings as unknown as BookingRow[]);
      setPolls(result.polls as unknown as AdminPoll[]);
      setSettings(result.settings as unknown as AppSettings | null);
      setAdmins(result.adminUsers as unknown as AdminAccess[]);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, [role, section]);

  useEffect(() => {
    void loadSection();
    const refreshTimer = window.setInterval(() => void loadSection(), 10 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [loadSection]);

  useEffect(() => {
    if (!admin) return;
    if ((requestedSection && !allowedNavigation.some((item) => item.id === requestedSection)) || (!requestedSection && defaultSection !== "overview")) {
      navigate(sectionPath(defaultSection, role), { replace: true });
      return;
    }
    if (section === "overview") {
      if (requestedView) navigate("/admin", { replace: true });
      return;
    }
    if (!requestedView || !views.includes(requestedView)) {
      navigate(sectionPath(section, role), { replace: true });
    }
  }, [admin, allowedNavigation, defaultSection, navigate, requestedSection, requestedView, role, section, views]);

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

  const perform = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError("");
    try {
      await action();
      await loadSection();
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goToSection = (nextSection: AdminSection) => {
    setMobileNavOpen(false);
    navigate(sectionPath(nextSection, role));
  };

  if (admin === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="admin-page">
      <main className="admin-shell">
        <header className="admin-header">
          <div className="admin-header-title">
            <button className="admin-menu-button" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open administration menu"><Menu /></button>
            <div><span className="admin-header-kicker">{role === "super_admin" ? "Super Admin" : "Operations Admin"}</span><h1>{navigation.find((item) => item.id === section)?.label}</h1></div>
          </div>
          <div className="admin-header-actions">
            {role === "super_admin" && section === "overview" && <Button onClick={() => goToSection("programming")}><CalendarDays className="h-4 w-4" /> Schedule show</Button>}
            <Link to="/admin/check-in"><Button variant="secondary"><ScanLine className="h-4 w-4" /> Check-in</Button></Link>
            <Button variant="ghost" onClick={() => { void authClient.signOut().finally(() => navigate("/admin/login")); }}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </header>

        <nav className="admin-tabs admin-tabs-desktop" aria-label="Administration sections">
          {allowedNavigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => goToSection(id)} className={section === id ? "is-active" : ""} aria-current={section === id ? "page" : undefined}>
              <Icon />{label}
            </button>
          ))}
        </nav>

        {mobileNavOpen && <div className="admin-mobile-nav" role="presentation">
          <button className="admin-mobile-nav-backdrop" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close administration menu" />
          <aside className="admin-mobile-drawer" role="dialog" aria-modal="true" aria-label="Administration menu">
            <div className="admin-mobile-drawer-header"><div><span>Administration</span><strong>Auditorium operations</strong></div><button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close administration menu"><X /></button></div>
            <nav className="admin-mobile-tabs" aria-label="Administration sections">
              {allowedNavigation.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => goToSection(id)} className={section === id ? "is-active" : ""} aria-current={section === id ? "page" : undefined}><Icon /><span>{label}</span></button>
              ))}
            </nav>
            <div className="admin-mobile-drawer-actions">
              <Link to="/admin/check-in" onClick={() => setMobileNavOpen(false)}><ScanLine />Check-in</Link>
              <button type="button" onClick={() => { setMobileNavOpen(false); void authClient.signOut().finally(() => navigate("/admin/login")); }}><LogOut />Sign out</button>
            </div>
          </aside>
        </div>}

        {error && <p className="mt-5 rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-sm text-rose-300">{error}</p>}
        {loading ? <div className="flex min-h-[55vh] items-center justify-center"><Spinner size="lg" /></div> : <>
          {role === "super_admin" && section === "overview" && dashboard && <OverviewSection dashboard={dashboard} onOpenProgramming={() => goToSection("programming")} />}
          {section === "programming" && <ProgrammingSection view={sectionView as ProgrammingView} movies={movies} shows={shows} polls={polls} saving={saving} perform={perform} role={role} />}
          {section === "bookings" && <BookingsSection view={sectionView as BookingView} bookings={bookings} movies={movies} shows={shows} saving={saving} perform={perform} role={role} />}
          {section === "setup" && <SetupSection view={sectionView as SetupView} seats={seats} settings={settings} admins={admins} saving={saving} perform={perform} role={role} />}
        </>}
      </main>
    </div>
  );
}
