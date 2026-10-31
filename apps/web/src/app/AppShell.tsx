import {
  Bell,
  GraduationCap,
  LogOut,
  type LucideIcon,
  Rocket,
  Search,
  Target,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { type Role, useAuth } from "@/features/auth/store";
import {
  type AppModuleMode,
  setActiveAppModule,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { navFor } from "./nav";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function NavLinks({ nav, compact = false }: { nav: NavItem[]; compact?: boolean }) {
  return (
    <>
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              compact && "gap-2",
              isActive
                ? "bg-primary-50 font-medium text-primary-700 shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-text",
            )
          }
        >
          <item.icon className="size-4.5" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function AppShell({
  nav = [],
  title,
  roleLabel: _roleLabel,
  topRight,
  sidebarFooter,
  children,
}: {
  nav?: NavItem[];
  title: string;
  roleLabel?: string;
  topRight?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  const [activeModule, setActiveModuleState] = useState<AppModuleMode>(() => {
    if (location.pathname.includes("/internship")) return "internship";
    return "interview";
  });

  useEffect(() => {
    if (location.pathname.includes("/internship")) {
      setActiveModuleState("internship");
      setActiveAppModule("internship");
    } else {
      setActiveModuleState("interview");
      setActiveAppModule("interview");
    }
  }, [location.pathname]);

  const currentRole: Role = user?.role ?? "mentor";

  const handleModuleChange = (mode: AppModuleMode) => {
    setActiveModuleState(mode);
    setActiveAppModule(mode);
    if (mode === "internship") {
      if (currentRole === "admin") navigate("/admin/internship");
      else if (currentRole === "candidate") navigate("/candidate/internship");
      else navigate("/mentor/internship");
    } else {
      if (currentRole === "admin") navigate("/admin");
      else if (currentRole === "candidate") navigate("/candidate/assessments");
      else navigate("/mentor");
    }
  };

  const activeNav = nav && nav.length > 0 ? nav : navFor(currentRole, activeModule);

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      {/* Left Sidebar - Fixed height to viewport, docked left, independent scroll */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex z-30 select-none sticky top-0">
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-text">EduProctor</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Intelligence</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted">Menu</div>
          <NavLinks nav={activeNav} />
        </nav>

        {/* Sidebar Footer / User Info - ALWAYS pinned at the bottom of the sidebar */}
        <div className="shrink-0 border-t border-border bg-surface p-3">
          {sidebarFooter ? (
            sidebarFooter
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-text">{user?.name ?? "Demo User"}</div>
                <div className="truncate text-[11px] text-muted">{user?.email ?? "user@example.com"}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="rounded p-1 text-muted transition-colors hover:bg-surface-muted hover:text-text"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="shrink-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur-xs">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className="truncate text-lg font-semibold tracking-tight text-text">{title}</h1>

            {/* Flow Mode Switcher: Interview vs Internship */}
            <div className="hidden sm:flex items-center rounded-xl bg-surface-muted p-1 border border-border">
              <button
                type="button"
                onClick={() => handleModuleChange("interview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                  activeModule === "interview"
                    ? "bg-surface text-text shadow-2xs"
                    : "text-muted hover:text-text",
                )}
              >
                <Target className="size-3.5 text-primary-600" />
                <span>Interview Screening</span>
              </button>
              <button
                type="button"
                onClick={() => handleModuleChange("internship")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                  activeModule === "internship"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-muted hover:text-text",
                )}
              >
                <Rocket className="size-3.5" />
                <span>Internship (v3)</span>
              </button>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            {/* Global Search Bar */}
            <div className="relative hidden w-64 md:block">
              <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
              />
            </div>

            {/* Notification Bell */}
            <Link
              to={`/${user?.role || "mentor"}/notifications`}
              className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-text cursor-pointer"
              aria-label="Notification Center"
              title="Notification Center"
            >
              <Bell className="size-4.5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger-500 ring-2 ring-surface animate-pulse" />
            </Link>

            {/* Avatar Pill */}
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "EP"}
            </div>

            {topRight}
          </div>
        </header>

        {/* Mobile Nav */}
        <nav
          aria-label="Main navigation (mobile)"
          className="shrink-0 flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 md:hidden"
        >
          <NavLinks nav={activeNav} compact />
        </nav>

        {/* Main Page Content - Clean vertical-only scroll container */}
        <main id="main" className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1360px] min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
