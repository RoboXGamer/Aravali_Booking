import { FormEvent, useEffect, useState } from "react";

import { adminBackend } from "../../services/admin";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { Input } from "../common/Input";
import type { AdminRole } from "../../types";

export interface AppSettings {
  id: string | number;
  max_seats_per_booking: number | string;
  seat_hold_minutes: number | string;
  razorpay_fee_percentage: number | string;
}

export interface AdminAccess {
  id: string;
  email: string;
  isAdmin: boolean;
  role: AdminRole;
}

interface Props {
  view?: "all" | "booking" | "access";
  settings: AppSettings | null;
  adminUsers: AdminAccess[];
  saving: boolean;
  perform: (action: () => Promise<unknown>) => Promise<boolean>;
}

const emptyForm = {
  max_seats_per_booking: "6",
  seat_hold_minutes: "10",
  razorpay_fee_percentage: "2",
};

export function ApplicationSettings({ view = "all", settings, adminUsers, saving, perform }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState<AdminRole>("operations");

  useEffect(() => {
    if (!settings) return;
    setForm({
      max_seats_per_booking: String(settings.max_seats_per_booking),
      seat_hold_minutes: String(settings.seat_hold_minutes),
      razorpay_fee_percentage: String(settings.razorpay_fee_percentage),
    });
  }, [settings]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    void perform(() => adminBackend.settings.update({
      max_seats_per_booking: Number(form.max_seats_per_booking),
      seat_hold_minutes: Number(form.seat_hold_minutes),
      razorpay_fee_percentage: Number(form.razorpay_fee_percentage),
    }));
  };

  const addAdmin = async (event: FormEvent) => {
    event.preventDefault();
    const succeeded = await perform(() => adminBackend.admins.setAccess(adminEmail, true, adminRole));
    if (succeeded) setAdminEmail("");
  };

  return (
    <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,720px)_1fr]">
      {(view === "all" || view === "booking") && <Card>
        <h2 className="text-lg font-black text-white">Application settings</h2>
        <p className="mt-1 text-sm text-slate-400">These values are used by the live seat-selection and checkout flow.</p>
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={save}>
          <Input label="Maximum seats per booking" type="number" min="1" max="20" required value={form.max_seats_per_booking} onChange={(event) => setForm({ ...form, max_seats_per_booking: event.target.value })} />
          <Input label="Seat hold duration (minutes)" type="number" min="1" max="30" required value={form.seat_hold_minutes} onChange={(event) => setForm({ ...form, seat_hold_minutes: event.target.value })} />
          <Input label="Razorpay fee percentage" type="number" min="0" max="100" step="0.01" required value={form.razorpay_fee_percentage} onChange={(event) => setForm({ ...form, razorpay_fee_percentage: event.target.value })} />
          <div className="flex items-end">
            <Button type="submit" disabled={saving || !settings} className="w-full">Save settings</Button>
          </div>
        </form>
      </Card>}
      {(view === "all" || view === "access") && <Card>
        <h3 className="font-black text-white">Administrator access</h3>
        <p className="mt-1 text-sm text-slate-400">Enable access before a new administrator creates their account.</p>
        <form className="mt-5 grid gap-2 sm:grid-cols-[1fr_180px_auto]" onSubmit={(event) => void addAdmin(event)}>
          <Input label="Admin email" type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            Role
            <select value={adminRole} onChange={(event) => setAdminRole(event.target.value as AdminRole)} className="min-h-11 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm font-normal normal-case tracking-normal text-white">
              <option value="operations">Operations Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <div className="flex items-end"><Button type="submit" disabled={saving}>Add</Button></div>
        </form>
        <div className="mt-5 divide-y divide-slate-800">
          {adminUsers.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between gap-3 py-3">
              <div><p className="text-sm font-semibold text-white">{admin.email}</p><p className="text-xs text-slate-500">{admin.isAdmin ? `${admin.role === "super_admin" ? "Super Admin" : "Operations Admin"} · enabled` : "Admin disabled"}</p></div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Role for ${admin.email}`}
                  value={admin.role}
                  disabled={saving || !admin.isAdmin}
                  onChange={(event) => void perform(() => adminBackend.admins.setAccess(admin.email, true, event.target.value as AdminRole))}
                  className="min-h-9 rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-white disabled:opacity-50"
                >
                  <option value="operations">Operations Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <Button
                size="sm"
                variant={admin.isAdmin ? "danger" : "secondary"}
                disabled={saving}
                onClick={() => void perform(() => adminBackend.admins.setAccess(admin.email, !admin.isAdmin, admin.role))}
              >
                {admin.isAdmin ? "Disable" : "Enable"}
              </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>}
    </section>
  );
}
