import { LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { api, saveAdminSession } from "../services/api";

interface LoginResponse {
  access_token: string;
  admin: { email: string; full_name?: string };
}

export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.post<LoginResponse>("/api/admin/auth/login", { email, password });
      saveAdminSession(result.access_token);
      const destination = (location.state as { from?: string } | null)?.from || "/admin";
      navigate(destination, { replace: true });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
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
          <Input label="Password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="rounded-lg border border-rose-900 bg-rose-950/20 p-3 text-xs text-rose-300">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>
        </form>
      </Card>
    </div>
  );
}
