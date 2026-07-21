import React from 'react';
import { ShieldCheck, MapPin, Mail, Phone } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900/60 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-slate-955">A</div>
            <span className="font-bold text-lg text-slate-100">ARAVALLI</span>
          </div>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            Experience premium performances, classical recitals, and modern theatre at the state-of-the-art Aravalli Auditorium.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Venue Info</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <span>Aravalli Complex, Sector 2, New Delhi, India</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-brand shrink-0" />
              <span>desk@aravalliauditorium.com</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-brand shrink-0" />
              <span>+91 11 2611 9000</span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Security & Systems</h4>
          <p className="text-sm text-slate-400 leading-relaxed">
            Merchant clearance executes on active high security Razorpay protocols. Admission occurs strictly via original dynamic PDF barcoded tickets.
          </p>
          <div className="flex items-center gap-2 text-xs text-brand font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Razorpay Secured Gateway</span>
          </div>
        </div>
      </div>
      
      <div className="border-t border-slate-900/40 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Aravalli Auditorium Inc. Developed for internal administrative purposes.
      </div>
    </footer>
  );
};
