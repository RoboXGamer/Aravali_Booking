import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { api, clearAdminSession, hasAdminSession } from "../services/api";
import { Spinner } from "./common/Spinner";

export function AdminGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasAdminSession()) {
      setAuthorized(false);
      return;
    }
    api.get("/api/admin/auth/me")
      .then(() => setAuthorized(true))
      .catch(() => {
        clearAdminSession();
        setAuthorized(false);
      });
  }, []);

  if (authorized === null) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  if (!authorized) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
}
