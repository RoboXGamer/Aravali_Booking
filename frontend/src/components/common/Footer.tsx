import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-900 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-10 sm:flex-row sm:items-center md:px-8">
        <div>
          <p className="font-extrabold tracking-[0.16em] text-white">ARAVALLI AUDITORIUM</p>
          <p className="mt-2 max-w-md text-sm text-slate-500">Weekly cinema screenings with secure, account-free seat booking.</p>
        </div>
        <div className="flex gap-6 text-sm font-semibold text-slate-400">
          <Link to="/shows" className="hover:text-white">Showtimes</Link>
          <Link to="/find-booking" className="hover:text-white">Find booking</Link>
        </div>
      </div>
      <div className="border-t border-slate-900 py-5 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Aravalli Auditorium
      </div>
    </footer>
  );
}
