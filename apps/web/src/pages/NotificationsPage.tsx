import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Exam } from "@/lib/types";

export interface AppNotification {
  id: string;
  category: "action" | "assessment" | "proctoring" | "system";
  title: string;
  description: string;
  timestamp: string;
  relativeTime: string;
  read: boolean;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  actionUrl?: string;
  badgeLabel?: string;
}

export function NotificationsPage() {
  usePageTitle("Notification Center · EduProctor");
  const [activeTab, setActiveTab] = useState<"all" | "action" | "assessment" | "proctoring" | "system">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  // Fetch real assessments from backend to synthesize live, accurate alerts
  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api<Exam[]>("/exams"),
    retry: 1,
  });

  // Default seeded notifications
  const initialNotifications: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];
    const now = Date.now();

    // 1. Dynamic alerts based on actual database assessments
    (exams ?? []).forEach((e) => {
      const isDraft = e.status === "draft" || (e as unknown as { card_status?: string })?.card_status === "draft";
      if (isDraft && e.window_start) {
        try {
          const startTime = new Date(e.window_start).getTime();
          if (!isNaN(startTime)) {
            if (startTime <= now) {
              list.push({
                id: `urgent-draft-passed-${e.id}`,
                category: "action",
                title: `Action Required: Draft Assessment Window Has Passed`,
                description: `The scheduled examination start time for "${e.title}" (${new Date(e.window_start).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}) has already passed. Please reschedule or publish now so candidates can take their test.`,
                timestamp: new Date().toISOString(),
                relativeTime: "Attention Needed",
                read: false,
                priority: "high",
                actionLabel: "Reschedule & Publish",
                actionUrl: `/mentor/exams/${e.id}?publish=true`,
                badgeLabel: "Draft Expired",
              });
            } else if (startTime - now <= 30 * 60 * 1000) {
              list.push({
                id: `urgent-draft-nearing-${e.id}`,
                category: "action",
                title: `Attention: Scheduled Test Starting Soon`,
                description: `"${e.title}" is scheduled to begin in less than 30 minutes, but it is currently still in Draft status. Publish now to dispatch single-use test links to enrolled candidates.`,
                timestamp: new Date().toISOString(),
                relativeTime: "Starting Soon",
                read: false,
                priority: "high",
                actionLabel: "Publish Now",
                actionUrl: `/mentor/exams/${e.id}?publish=true`,
                badgeLabel: "Urgent",
              });
            }
          }
        } catch {}
      }

      if (e.status === "scheduled" || (e as unknown as { card_status?: string })?.card_status === "scheduled") {
        list.push({
          id: `notif-sched-${e.id}`,
          category: "assessment",
          title: `Assessment Scheduled: ${e.title}`,
          description: `Single-use test links have been generated and dispatched to enrolled candidates for ${e.title}. Examination window opens ${e.window_start ? new Date(e.window_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "soon"}.`,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          relativeTime: "1 hour ago",
          read: true,
          priority: "medium",
          actionLabel: "View Workspace",
          actionUrl: `/mentor/exams/${e.id}`,
          badgeLabel: "Scheduled",
        });
      }
    });

    // 2. Standard notifications for system, proctoring & candidate events
    list.push(
      {
        id: "notif-proctor-1",
        category: "proctoring",
        title: "Proctoring Telemetry: Low Glance Variance Detected",
        description: "Candidate Arun Patel logged 3 brief head glance notifications during session FSD-301. Non-punitive flag capped at 3; mentor review available.",
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        relativeTime: "2 hours ago",
        read: false,
        priority: "medium",
        actionLabel: "Review Telemetry",
        actionUrl: "/mentor/exams",
        badgeLabel: "Look-away Capped",
      },
      {
        id: "notif-candidate-sub-1",
        category: "assessment",
        title: "Candidate Submission Evaluated",
        description: "Candidate Priya Nair completed 'Full Stack Architecture' with 85% score. Strong mastery identified in REST APIs and React Server Components.",
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        relativeTime: "4 hours ago",
        read: true,
        priority: "low",
        actionLabel: "View Results",
        actionUrl: "/mentor/results",
        badgeLabel: "85% Score",
      },
      {
        id: "notif-system-1",
        category: "system",
        title: "Database Synchronized with TiDB Cloud",
        description: "All assessment sessions, questions bank, and candidate roster successfully synchronized to high-availability cluster.",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        relativeTime: "1 day ago",
        read: true,
        priority: "low",
        badgeLabel: "Cloud Sync",
      }
    );

    return list;
  }, [exams]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Keep state updated when initial list compiles
  useMemo(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const actionCount = notifications.filter((n) => n.category === "action").length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleReadStatus = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab !== "all" && n.category !== activeTab) return false;
      if (readFilter === "unread" && n.read) return false;
      if (readFilter === "read" && !n.read) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matches =
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          (n.badgeLabel && n.badgeLabel.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [notifications, activeTab, readFilter, searchFilter]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Bell className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
                <span>Notification Center</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-danger-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted">
                Stay updated on assessment timelines, scheduled drafts, candidate submissions, and integrity reviews.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <Check className="size-3.5 text-success-600" />
              <span>Mark all as read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all" as const, label: "All", count: notifications.length },
            { key: "action" as const, label: "Action Required", count: actionCount, alert: actionCount > 0 },
            { key: "assessment" as const, label: "Assessments", count: notifications.filter((n) => n.category === "assessment").length },
            { key: "proctoring" as const, label: "Integrity & Proctoring", count: notifications.filter((n) => n.category === "proctoring").length },
            { key: "system" as const, label: "System", count: notifications.filter((n) => n.category === "system").length },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-primary-600 text-white shadow-xs"
                  : tab.alert
                    ? "bg-danger-50 text-danger-700 hover:bg-danger-100"
                    : "text-muted hover:bg-surface-muted hover:text-text"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === tab.key
                  ? "bg-white/20 text-white font-bold"
                  : tab.alert
                    ? "bg-danger-200 text-danger-900 font-bold"
                    : "bg-surface-muted text-muted font-normal"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Read filter */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:outline-hidden"
            />
          </div>

          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value as "all" | "unread" | "read")}
            className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs text-text focus:border-primary-500 focus:outline-hidden"
          >
            <option value="all">All statuses</option>
            <option value="unread">Unread only</option>
            <option value="read">Read only</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted shadow-2xs space-y-2">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-muted">
              <CheckCircle2 className="size-6 text-success-600" />
            </div>
            <h3 className="font-bold text-text text-sm">All caught up!</h3>
            <p className="max-w-xs text-muted leading-relaxed">
              No notifications match your current filter. Any scheduling changes, proctoring alerts, or candidate updates will show up here.
            </p>
          </Card>
        ) : (
          filteredNotifications.map((notif) => {
            const isAction = notif.category === "action";

            return (
              <div
                key={notif.id}
                className={`group relative flex flex-col justify-between gap-4 rounded-xl border p-4.5 transition-all shadow-2xs sm:flex-row sm:items-center ${
                  !notif.read
                    ? isAction
                      ? "border-danger-300 bg-danger-50/60 dark:bg-danger-950/20"
                      : "border-primary-200 bg-primary-50/30 dark:bg-primary-950/10"
                    : "border-border bg-surface hover:border-primary-200"
                }`}
              >
                {/* Left indicator & icon */}
                <div className="flex items-start gap-3.5">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl mt-0.5 ${
                    isAction
                      ? "bg-danger-100 text-danger-700"
                      : notif.category === "proctoring"
                        ? "bg-amber-100 text-amber-700"
                        : notif.category === "assessment"
                          ? "bg-primary-100 text-primary-700"
                          : "bg-surface-muted text-muted"
                  }`}>
                    {isAction ? (
                      <AlertTriangle className="size-4.5" />
                    ) : notif.category === "proctoring" ? (
                      <ShieldAlert className="size-4.5" />
                    ) : notif.category === "assessment" ? (
                      <Calendar className="size-4.5" />
                    ) : (
                      <Sparkles className="size-4.5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-bold text-text leading-tight">{notif.title}</h4>
                      {notif.badgeLabel && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isAction
                            ? "bg-danger-200 text-danger-900"
                            : "bg-surface-muted text-muted"
                        }`}>
                          {notif.badgeLabel}
                        </span>
                      )}
                      {!notif.read && (
                        <span className="size-2 rounded-full bg-primary-600" title="Unread notification" />
                      )}
                    </div>
                    <p className="text-xs text-muted leading-relaxed max-w-2xl">{notif.description}</p>
                    <div className="flex items-center gap-3 pt-0.5 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-muted" />
                        <span>{notif.relativeTime}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {notif.actionUrl && (
                    <Button asChild size="sm" className={`gap-1.5 text-xs font-semibold shadow-xs ${
                      isAction ? "bg-danger-600 hover:bg-danger-700 text-white" : "bg-primary-600 hover:bg-primary-700 text-white"
                    }`}>
                      <Link to={notif.actionUrl}>
                        <span>{notif.actionLabel || "View"}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleReadStatus(notif.id)}
                    className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-text transition-colors cursor-pointer"
                    title={notif.read ? "Mark as unread" : "Mark as read"}
                  >
                    <Check className={`size-4 ${notif.read ? "text-muted" : "text-primary-600"}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeNotification(notif.id)}
                    className="rounded-lg p-1.5 text-muted hover:bg-danger-50 hover:text-danger-700 transition-colors cursor-pointer"
                    title="Dismiss notification"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
