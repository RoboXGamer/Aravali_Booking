import { FormEvent, useEffect, useState } from "react";

import { api } from "../../services/api";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { Input } from "../common/Input";

export interface AppSettings {
  id: number;
  max_seats_per_booking: number | string;
  seat_hold_minutes: number | string;
  convenience_fee_per_seat: number | string;
  gst_percentage: number | string;
  razorpay_fee_percentage: number | string;
}

interface Props {
  settings: AppSettings | null;
  saving: boolean;
  perform: (action: () => Promise<unknown>) => Promise<boolean>;
}

const emptyForm = {
  max_seats_per_booking: "6",
  seat_hold_minutes: "10",
  convenience_fee_per_seat: "0",
  gst_percentage: "0",
  razorpay_fee_percentage: "2",
};

export function ApplicationSettings({ settings, saving, perform }: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!settings) return;
    setForm({
      max_seats_per_booking: String(settings.max_seats_per_booking),
      seat_hold_minutes: String(settings.seat_hold_minutes),
      convenience_fee_per_seat: String(settings.convenience_fee_per_seat),
      gst_percentage: String(settings.gst_percentage),
      razorpay_fee_percentage: String(settings.razorpay_fee_percentage),
    });
  }, [settings]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    void perform(() => api.put("/api/admin/settings", {
      max_seats_per_booking: Number(form.max_seats_per_booking),
      seat_hold_minutes: Number(form.seat_hold_minutes),
      convenience_fee_per_seat: Number(form.convenience_fee_per_seat),
      gst_percentage: Number(form.gst_percentage),
      razorpay_fee_percentage: Number(form.razorpay_fee_percentage),
    }));
  };

  return (
    <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,720px)_1fr]">
      <Card>
        <h2 className="text-lg font-black text-white">Application settings</h2>
        <p className="mt-1 text-sm text-slate-400">These values are used by the live seat-selection and checkout flow.</p>
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={save}>
          <Input label="Maximum seats per booking" type="number" min="1" max="20" required value={form.max_seats_per_booking} onChange={(event) => setForm({ ...form, max_seats_per_booking: event.target.value })} />
          <Input label="Seat hold duration (minutes)" type="number" min="1" max="30" required value={form.seat_hold_minutes} onChange={(event) => setForm({ ...form, seat_hold_minutes: event.target.value })} />
          <Input label="Convenience fee per seat (INR)" type="number" min="0" step="0.01" required value={form.convenience_fee_per_seat} onChange={(event) => setForm({ ...form, convenience_fee_per_seat: event.target.value })} />
          <Input label="GST percentage" type="number" min="0" max="100" step="0.01" required value={form.gst_percentage} onChange={(event) => setForm({ ...form, gst_percentage: event.target.value })} />
          <Input label="Razorpay fee percentage" type="number" min="0" max="100" step="0.01" required value={form.razorpay_fee_percentage} onChange={(event) => setForm({ ...form, razorpay_fee_percentage: event.target.value })} />
          <div className="flex items-end">
            <Button type="submit" disabled={saving || !settings} className="w-full">Save settings</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h3 className="font-black text-white">What these control</h3>
        <dl className="mt-5 space-y-4 text-sm">
          <div><dt className="font-bold text-slate-200">Booking limit</dt><dd className="mt-1 text-slate-500">Maximum seats a customer can purchase in one booking.</dd></div>
          <div><dt className="font-bold text-slate-200">Seat hold</dt><dd className="mt-1 text-slate-500">How long selected seats remain unavailable during checkout.</dd></div>
          <div><dt className="font-bold text-slate-200">Fees and tax</dt><dd className="mt-1 text-slate-500">Included in the total calculated before the Razorpay order is created.</dd></div>
        </dl>
      </Card>
    </section>
  );
}
