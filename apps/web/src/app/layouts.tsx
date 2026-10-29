import { LogOut } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { RequireRole } from "@/features/auth/RequireRole";
import { type Role, roleLabel, useAuth } from "@/features/auth/store";
import { AppShell } from "./AppShell";

const TitleContext = createContext<(t: string) => void>(() => undefined);

/** Pages call this to set the top-bar title and document title. */
export function usePageTitle(title: string) {
  const set = useContext(TitleContext);
  useEffect(() => {
    set(title);
    document.title = `${title} · EduProctor`;
  }, [set, title]);
}

function UserFooter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isInternship = location.pathname.includes("/internship");
  if (!user) return null;

  const roleBadge = isInternship
    ? user.role === "mentor"
      ? "Manager"
      : user.role === "candidate"
        ? "Mentee"
        : "Admin"
    : roleLabel[user.role];

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-text">
          <span className="truncate">{user.name}</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
            {roleBadge}
          </span>
        </div>
        <div className="truncate text-[11px] text-muted">{user.email}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-text cursor-pointer shrink-0"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function RoleLayout({ role }: { role: Role }) {
  const [title, setTitle] = useState("");
  return (
    <RequireRole roles={[role]}>
      <TitleContext.Provider value={setTitle}>
        <AppShell title={title} roleLabel={roleLabel[role]} sidebarFooter={<UserFooter />}>
          <Outlet />
        </AppShell>
      </TitleContext.Provider>
    </RequireRole>
  );
}
