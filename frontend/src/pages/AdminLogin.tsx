import { LockKeyhole } from "lucide-react";
import { useConvexAuth } from "convex/react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { authClient } from "../lib/auth-client";

export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    const destination = (location.state as { from?: string } | null)?.from || "/admin";
    navigate(destination, { replace: true });
  }, [isAuthenticated, location.state, navigate]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = creating
        ? await authClient.signUp.email({ email: normalizedEmail, password, name: "Auditorium Administrator" })
        : await authClient.signIn.email({ email: normalizedEmail, password });
      if (result.error) throw new Error(result.error.message || "Unable to sign in.");
    } catch (reason) {
      setError((reason as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <Card className="p-8">
        <LockKeyhole className="h-9 w-9 text-[rgb(var(--booking-accent-text))]" />
        <h1 className="mt-5 text-2xl font-black text-white">Administrator access</h1>
        <p className="mt-2 text-sm text-slate-400">Authorized auditorium operators only.</p>
        <form onSubmit={login} className="mt-7 space-y-4">
          <Input label="Admin email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="rounded-lg border border-rose-900 bg-rose-950/20 p-3 text-xs text-rose-300">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Finishing sign-in…" : creating ? "Create admin account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-slate-400 transition hover:text-white"
            onClick={() => { setCreating((value) => !value); setError(""); }}
          >
            {creating ? "Already have an account? Sign in" : "First-time authorized admin? Create account"}
          </button>
        </form>
      </Card>
    </div>
  );
}
