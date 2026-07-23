import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Navigate, useLocation } from "react-router-dom";

import { api } from "../../convex/_generated/api";
import { Spinner } from "./common/Spinner";

export function AdminGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const admin = useQuery(api.auth.getCurrentAdmin, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && admin === undefined)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  }
  if (!isAuthenticated || !admin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
