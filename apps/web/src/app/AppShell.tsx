import {
  Bell,
  Check,
  ChevronDown,
  GraduationCap,
  LogOut,
  type LucideIcon,
  Rocket,
  Search,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { authStore, type Role, roleHome, roleLabel, useAuth } from "@/features/auth/store";
import {
  type AppModuleMode,
  getActiveAppModule,
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
  roleLabel: roleLabelProp,
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
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  const [activeModule, setActiveModuleState] = useState<AppModuleMode>(() => {
    if (location.pathname.includes("/internship")) return "internship";
    return getActiveAppModule();
  });

  useEffect(() => {
    if (location.pathname.includes("/internship")) {
      setActiveModuleState("internship");
      setActiveAppModule("internship");
    } else {
      const stored = getActiveAppModule();
      if (stored === "interview") {
        setActiveModuleState("interview");
      }
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
      else if (currentRole === "candidate") navigate("/candidate");
      else navigate("/mentor");
    }
  };

  const activeNav = nav && nav.length > 0 ? nav : navFor(currentRole, activeModule);

  const getRoleLabel = (role: Role) => {
    if (activeModule === "internship") {
      if (role === "mentor") return "Manager";
      if (role === "candidate") return "Mentee";
      return "Programme Admin";
    }
    return roleLabel[role];
  };

  const handleRoleSwitch = (role: Role) => {
    setRoleMenuOpen(false);
    const mockUsers: Record<Role, { id: string; email: string; name: string }> = {
      mentor: { id: "u-mentor", email: "mentor1@example.com", name: "Priya Sharma" },
      candidate: { id: "u-candidate", email: "candidate01@example.com", name: "Arjun Mehta" },
      admin: { id: "u-admin", email: "admin@example.com", name: "System Admin" },
    };
    const targetUser = mockUsers[role];
    authStore.set({
      access_token: `mock-${role}-token`,
      refresh_token: `mock-${role}-refresh`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role,
        is_active: true,
      },
    });
    if (activeModule === "internship") {
      if (role === "admin") navigate("/admin/internship");
      else if (role === "candidate") navigate("/candidate/internship");
      else navigate("/mentor/internship");
    } else {
      navigate(roleHome[role]);
    }
  };

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

          <div className="my-3 border-t border-border" />

          {/* Quick Showcase & Styleguide links */}
          <div className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted">Prototypes</div>
          <NavLink
            to="/design-showcase"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                isActive ? "bg-ai-50 text-ai-700 font-semibold" : "text-muted hover:bg-surface-muted hover:text-text",
              )
            }
          >
            <Sparkles className="size-4 text-ai-500" />
            <span>UI Design Showcase</span>
          </NavLink>
          <NavLink
            to="/styleguide"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors",
                isActive ? "bg-primary-50 text-primary-700 font-semibold" : "text-muted hover:bg-surface-muted hover:text-text",
              )
            }
          >
            <span className="size-2 rounded-full bg-primary-500" />
            <span>Soft Mist Styleguide</span>
          </NavLink>
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
            {/* Global Search Bar (like in designs) */}
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
            <button
              type="button"
              className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-text"
              aria-label="Notifications"
            >
              <Bell className="size-4.5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger-500" />
            </button>

            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-muted"
                aria-expanded={roleMenuOpen}
                aria-haspopup="true"
              >
                <UserCheck className="size-3.5 text-primary-600" />
                <span>{roleLabelProp ? (activeModule === "internship" ? roleLabelProp.replace("Mentor", "Manager").replace("Candidate", "Mentee") : roleLabelProp) : getRoleLabel(currentRole)}</span>
                <ChevronDown className="size-3 text-muted" />
              </button>

              {roleMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-surface py-1 shadow-md z-30"
                  role="menu"
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Switch Active Role
                  </div>
                  {(["mentor", "candidate", "admin"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleSwitch(r)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors",
                        currentRole === r
                          ? "bg-primary-50 font-medium text-primary-700"
                          : "text-text hover:bg-surface-muted",
                      )}
                      role="menuitem"
                    >
                      <span>{getRoleLabel(r)} Portal</span>
                      {currentRole === r && <Check className="size-3.5 text-primary-600" />}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <Link
                    to="/design-showcase"
                    onClick={() => setRoleMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ai-700 hover:bg-ai-50"
                  >
                    <Sparkles className="size-3.5 text-ai-500" />
                    <span>View 12 UI Boards</span>
                  </Link>
                </div>
              )}
            </div>

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

