import {
  Award,
  BarChart3,
  CalendarCheck2,
  CheckSquare,
  ClipboardList,
  Code2,
  GraduationCap,
  Home,
  Layers,
  LineChart,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import type { Role } from "@/features/auth/store";
import type { AppModuleMode } from "@/lib/mockData";
import type { NavItem } from "./AppShell";

const interviewNav: Record<Role, NavItem[]> = {
  mentor: [
    { to: "/mentor", label: "Dashboard", icon: Home },
    { to: "/mentor/exams", label: "Assessments", icon: ClipboardList },
    { to: "/mentor/results", label: "Results & Analytics", icon: BarChart3 },
  ],
  candidate: [
    { to: "/candidate/assessments", label: "My Assessments", icon: ClipboardList },
    { to: "/candidate/results", label: "My Results", icon: Award },
    { to: "/candidate/profile", label: "My Profile", icon: User },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: Home },
    { to: "/admin/candidates", label: "Candidates & Batches", icon: GraduationCap },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/exams", label: "Assessments", icon: ClipboardList },
    { to: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
  ],
};

const internshipNav: Record<Role, NavItem[]> = {
  mentor: [
    { to: "/mentor/internship", label: "Intern Hub (Overview)", icon: Home },
    { to: "/mentor/internship/mentees", label: "My Mentees (Max 2)", icon: Users },
    { to: "/mentor/internship/coding", label: "Coding IDE & Reviews", icon: Code2 },
    { to: "/mentor/internship/tasks", label: "Tasks & Learning Plan", icon: CheckSquare },
    { to: "/mentor/internship/attendance", label: "Attendance & Leaves", icon: CalendarCheck2 },
    { to: "/mentor/internship/reviews", label: "Monthly Reviews (M1-M3)", icon: Award },
  ],
  candidate: [
    { to: "/candidate/internship", label: "Mentee Dashboard", icon: Home },
    { to: "/candidate/internship/attendance", label: "Daily Check-In/Out", icon: CalendarCheck2 },
    { to: "/candidate/internship/mcq", label: "Weekly MCQs", icon: ClipboardList },
    { to: "/candidate/internship/tasks", label: "My Tasks & Sprints", icon: CheckSquare },
    { to: "/candidate/internship/coding", label: "Coding Platform", icon: Code2 },
    { to: "/candidate/internship/skills", label: "My Skill Matrix (1-5)", icon: LineChart },
    { to: "/candidate/internship/reviews", label: "Monthly Reviews", icon: Award },
  ],
  admin: [
    { to: "/admin/internship", label: "Programme Dashboard", icon: Home },
    { to: "/admin/internship/cohorts", label: "Cohorts & Pairings", icon: Layers },
    { to: "/admin/internship/calibration", label: "HR Calibration & Decisions", icon: SlidersHorizontal },
    { to: "/admin/internship/coding-bank", label: "Coding Problem Bank", icon: Code2 },
    { to: "/admin/internship/attendance", label: "Attendance & Audit", icon: CalendarCheck2 },
  ],
};

export function navFor(role: Role, mode: AppModuleMode = "interview"): NavItem[] {
  if (mode === "internship") {
    return internshipNav[role] ?? [];
  }
  return interviewNav[role] ?? [];
}
