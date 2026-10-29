import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { type Role, roleHome, useAuth } from "./store";

/** UI convenience only; the API enforces roles server-side on every router. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />;
  return <>{children}</>;
}

export function RoleRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome[user.role] : "/login"} replace />;
}
