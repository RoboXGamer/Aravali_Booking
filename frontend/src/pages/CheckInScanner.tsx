import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Scan, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const CheckInScanner: React.FC = () => {
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post(`/api/admin/check-in/\${bookingId.trim()}`, {});
      setResult(response);
    } catch (err: any) {
      setError(err.message || "Checking ticket state failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearScanner = () => {
    setBookingId('');
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <Card className="bg-cinema-card p-8 border border-amber-500/20 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 items-center justify-center">
            <Scan className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 font-bold font-bold">Auditorium Check-In Scanner</h2>
          <p className="text-sm text-slate-400">Scan or enter the Booking ID of the ticket pass.</p>
        </div>

        {!result && !error ? (
          <form onSubmit={handleScanSubmit} className="space-y-4">
            <Input
              label="Enter Ticket ID"
              placeholder="e.g. ARA2026102345"
              value={bookingId}
              onChange={e => setBookingId(e.target.value)}
              required
            />
            <Button
              type="submit"
              className="w-full bg-gold-gradient text-slate-950 font-bold"
              disabled={loading || !bookingId.trim()}
            >
              {loading ? <Spinner size="sm" /> : 'Validate & Check In'}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
                <div>
                  <h4 className="font-bold text-red-500">Ticket Validation Failed</h4>
                  <p className="text-sm text-slate-300 mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-xl text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <div>
                  <h4 className="font-bold text-emerald-500 font-bold">Access Granted Successfully</h4>
                  <p className="text-sm text-slate-300 mt-1">Booking {result.booking_id} checked in successfully.</p>
                  <p className="text-xs text-slate-400 mt-2">Pass Holder: {result.customer_name}</p>
                </div>
              </div>
            )}

            <Button onClick={clearScanner} className="w-full" variant="secondary">
              Scan Next Ticket
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
