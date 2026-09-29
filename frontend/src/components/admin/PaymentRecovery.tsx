import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Card } from "../common/Card";
import { Button } from "../common/Button";

export function PaymentRecovery() {
  const data = useQuery(api.paymentState.attention);
  const retry = useMutation(api.paymentState.retry);
  const [message, setMessage] = useState("");
  if (!data || (!data.sessions.length && !data.unmatched.length)) return null;
  return <Card className="mt-6 border-amber-500/30">
    <h2 className="font-bold text-white">Payments needing attention</h2>
    <p className="mt-2 text-sm text-slate-400">Automatic recovery continues. A failed refund needs review in Razorpay; check the reference there before issuing another refund.</p>
    {data.sessions.map(item => <div key={item.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
      <div className="min-w-0"><p className="break-all font-mono text-sm">{item.orderId ?? item.id}</p>
        <p className="text-xs text-amber-300">{item.status}: {item.error || "Payment needs review."}</p></div>
      <Button size="sm" variant="secondary" onClick={() => void retry({ sessionId: item.id })
        .then(() => setMessage("Payment status refresh queued."))
        .catch(() => setMessage("Unable to queue recovery. Please try again."))}>Recheck payment</Button>
    </div>)}
    {data.unmatched.map(item => <p key={item.id} className="mt-3 break-all text-sm text-amber-300">
      No checkout found for {item.orderId} ({item.eventType}). Review this payment in Razorpay.
    </p>)}
    {message && <p role="status" className="mt-3 text-sm text-slate-300">{message}</p>}
  </Card>;
}
