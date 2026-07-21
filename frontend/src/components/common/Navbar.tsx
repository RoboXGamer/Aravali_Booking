import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Compass, LogOut, LayoutDashboard, Ticket } from 'lucide-react';
import { Button } from './Button';

export const Navbar: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-slate-900 py-4 px-6 md:px-12 flex justify-between items-center">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-slate-955 tracking-wider">A</div>
        <span className="font-bold text-lg tracking-wider text-slate-100">ARAVALLI</span>
      </Link>
      
      <div className="flex items-center gap-6">
        <Link to="/events" className="text-sm font-semibold text-slate-300 hover:text-brand transition flex items-center gap-2">
          <Compass className="w-4 h-4 text-brand" />
          Events
        </Link>
        
        {user ? (
          <>
            <Link to="/bookings" className="text-sm font-semibold text-slate-300 hover:text-brand transition flex items-center gap-2">
              <Ticket className="w-4 h-4 text-brand" />
              My Tickets
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin" className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Admin
                </Link>
                <Link to="/admin/check-in" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-2">
                  Check-In
                </Link>
              </>
            )}
            <div className="h-4 w-px bg-slate-800" />
            <button 
              onClick={() => signOut().then(() => navigate('/'))} 
              className="text-slate-400 hover:text-rose-400 transition"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        ) : (
          <Button onClick={() => navigate('/login')} variant="primary" size="sm">
            Sign In
          </Button>
        )}
      </div>
    </nav>
  );
};
