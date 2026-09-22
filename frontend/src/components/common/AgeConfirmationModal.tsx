import { ShieldAlert } from "lucide-react";

import { Button } from "./Button";

interface AgeConfirmationModalProps {
  movieTitle: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AgeConfirmationModal({ movieTitle, open, onCancel, onConfirm }: AgeConfirmationModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5 backdrop-blur-sm" role="presentation">
      <section
        className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-confirmation-title"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-rose-300">A certificate · Adults only</p>
        <h2 id="age-confirmation-title" className="mt-2 text-2xl font-black text-white">You must be 18 or older</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          <strong className="text-slate-200">{movieTitle}</strong> is certified for adults. Please confirm your age before continuing to seat selection.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Go back</Button>
          <Button type="button" onClick={onConfirm}>I am 18 or older</Button>
        </div>
      </section>
    </div>
  );
}
