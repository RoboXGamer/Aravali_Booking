import { Menu, Search, Ticket, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 text-sm font-semibold transition ${
    isActive ? "text-amber-400" : "text-slate-300 hover:text-white"
  }`;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0F1115]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-gradient font-black text-slate-950">
            A
          </span>
          <span className="font-extrabold tracking-[0.18em] text-slate-100">ARAVALLI</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <NavLink to="/shows" className={navClass}>
            <Ticket className="h-4 w-4" /> Showtimes
          </NavLink>
          <NavLink to="/find-booking" className={navClass}>
            <Search className="h-4 w-4" /> Find booking
          </NavLink>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-slate-800 px-5 py-5 md:hidden">
          <NavLink to="/shows" className={navClass} onClick={() => setOpen(false)}>
            <Ticket className="h-4 w-4" /> Showtimes
          </NavLink>
          <NavLink to="/find-booking" className={navClass} onClick={() => setOpen(false)}>
            <Search className="h-4 w-4" /> Find booking
          </NavLink>
        </div>
      )}
    </nav>
  );
}
