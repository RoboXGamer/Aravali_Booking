import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRazorpay } from '../hooks/useRazorpay';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';

export const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isScriptLoaded = useRazorpay();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const { booking, razorpay_order } = location.state || {};

  useEffect(() => {
    if (!booking || !razorpay_order) {
      navigate('/events');
    }
  }, [booking, razorpay_order, navigate]);

  const handlePayment = () => {
    if (!isScriptLoaded) {
      setError("Razorpay integration script could not be loaded.");
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
      amount: razorpay_order.amount,
      currency: razorpay_order.currency,
      name: "Aravalli Auditorium",
      description: `Cinema Ticketing pass for Booking ID \${booking.id}`,
      order_id: razorpay_order.id,
      handler: async (response: any) => {
        setVerifying(true);
        setError('');
        try {
          const verification = await api.post('/api/bookings/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (verification.status === 'success') {
            navigate(`/confirmation/\${verification.booking_id}`);
          } else {
            setError("Signature processing verification mismatch.");
          }
        } catch (err: any) {
          console.error("Verification error: ", err);
          setError("Gateway interface handshake error occurred.");
        } finally {
          setVerifying(false);
        }
      },
      prefill: {
        name: booking.customer_name,
        contact: booking.customer_phone,
      },
      theme: {
        color: "#D4AF37",
      },
      modal: {
        ondismiss: () => {
          setError("Payment check-out dismissed by customer.");
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  if (verifying) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <Spinner size="lg" />
        <h3 className="text-lg font-semibold text-slate-200 font-bold font-bold">Verifying Booking Payments Signature...</h3>
        <p className="text-sm text-slate-500">Please do not reload your browser interface.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <Card className="bg-cinema-card p-8 text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
          <CreditCard className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-bold font-bold">Secure Cinema Gate Clearance</h2>
          <p className="text-sm text-slate-400 mt-2">Ready to trigger payment gateway interfaces.</p>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 text-left space-y-2 border border-slate-800">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Invoice Ref</span>
            <span className="text-slate-200 font-mono text-[10px]">{booking?.id}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Passes Volume</span>
            <span className="text-slate-200">{booking?.quantity} Seat(s)</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Clearance Value</span>
            <span className="text-brand font-bold text-gold">INR {booking?.total_amount}</span>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500 bg-rose-950/20 border border-rose-950/40 p-3 rounded-lg text-left">{error}</p>}

        <Button onClick={handlePayment} className="w-full gap-2 py-4 text-sm font-bold bg-gold-gradient text-slate-950" disabled={!isScriptLoaded}>
          Launch Merchant Frame <ArrowRight className="w-4 h-4" />
        </Button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5" /> Secured by 256-bit encryption pipelines.
        </div>
      </Card>
    </div>
  );
};
