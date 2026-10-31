import { Navigate, Route, Routes } from "react-router-dom";
import { RequireRole, RoleRedirect } from "@/features/auth/RequireRole";
import { AdminAuditPage } from "@/pages/admin/AdminAuditPage";
import { AdminCandidatesPage } from "@/pages/admin/AdminCandidatesPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminUserPage } from "@/pages/admin/AdminUserPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { CandidateAssessmentsPage } from "@/pages/candidate/CandidateAssessmentsPage";
import { CandidateExamPage } from "@/pages/candidate/CandidateExamPage";
import { CandidateIdentityPage } from "@/pages/candidate/CandidateIdentityPage";
import { CandidateInstructionsPage } from "@/pages/candidate/CandidateInstructionsPage";
import { CandidateProfilePage } from "@/pages/candidate/CandidateProfilePage";
import { CandidateResultsViewPage } from "@/pages/candidate/CandidateResultsViewPage";
import { JoinPage } from "@/pages/candidate/JoinPage";
import { SessionPage } from "@/pages/candidate/SessionPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { CandidateResultPage } from "@/pages/mentor/CandidateResultPage";
import { ExamDetailPage } from "@/pages/mentor/ExamDetailPage";
import { ExamResultsPage } from "@/pages/mentor/ExamResultsPage";
import { ExamsPage } from "@/pages/mentor/ExamsPage";
import { IdentityReviewPage } from "@/pages/mentor/IdentityReviewPage";
import { MarkingPage } from "@/pages/mentor/MarkingPage";
import { MentorHomePage } from "@/pages/mentor/MentorHomePage";
import { QuestionBankPage } from "@/pages/mentor/QuestionBankPage";
import { AdminAttendanceAuditPage } from "@/pages/internship/admin/AdminAttendanceAuditPage";
import { AdminCodingBankPage } from "@/pages/internship/admin/AdminCodingBankPage";
import { AdminCohortsPage } from "@/pages/internship/admin/AdminCohortsPage";
import { AdminHRCalibrationPage } from "@/pages/internship/admin/AdminHRCalibrationPage";
import { AdminInternshipDashboardPage } from "@/pages/internship/admin/AdminInternshipDashboardPage";
import { MenteeAttendancePage } from "@/pages/internship/candidate/MenteeAttendancePage";
import { MenteeCodingPlatformPage } from "@/pages/internship/candidate/MenteeCodingPlatformPage";
import { MenteeMonthlyReviewsPage } from "@/pages/internship/candidate/MenteeMonthlyReviewsPage";
import { MenteeSkillMatrixPage } from "@/pages/internship/candidate/MenteeSkillMatrixPage";
import { MenteeTasksPage } from "@/pages/internship/candidate/MenteeTasksPage";
import { MenteeWeeklyMCQPage } from "@/pages/internship/candidate/MenteeWeeklyMCQPage";
import { MenteeWorkspacePage } from "@/pages/internship/candidate/MenteeWorkspacePage";
import { ManagerAttendancePage } from "@/pages/internship/mentor/ManagerAttendancePage";
import { ManagerCodingReviewPage } from "@/pages/internship/mentor/ManagerCodingReviewPage";
import { ManagerInternshipHubPage } from "@/pages/internship/mentor/ManagerInternshipHubPage";
import { ManagerMenteesPage } from "@/pages/internship/mentor/ManagerMenteesPage";
import { ManagerMonthlyReviewsPage } from "@/pages/internship/mentor/ManagerMonthlyReviewsPage";
import { ManagerTasksPage } from "@/pages/internship/mentor/ManagerTasksPage";
import { AppShell } from "./AppShell";
import { RoleLayout } from "./layouts";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* Legacy prototype routes redirect */}
      <Route path="/design-showcase" element={<Navigate to="/" replace />} />
      <Route path="/showcase" element={<Navigate to="/" replace />} />
      <Route path="/styleguide" element={<Navigate to="/" replace />} />
      <Route path="/notifications" element={<Navigate to="/mentor/notifications" replace />} />

      {/* Admin Portal */}
      <Route path="/admin" element={<RoleLayout role="admin" />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="candidates" element={<AdminCandidatesPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:userId" element={<AdminUserPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/results" element={<ExamResultsPage />} />
        {/* proctoring lives in each assessment's Proctoring tab; old session links land on the list */}
        <Route path="sessions/:sessionId" element={<Navigate to="/admin/exams" replace />} />
        <Route path="courses" element={<Navigate to="/admin/exams" replace />} />
        <Route path="courses/:courseId" element={<Navigate to="/admin/exams" replace />} />
        <Route path="notes" element={<Navigate to="/admin/exams" replace />} />
        <Route path="agent" element={<Navigate to="/admin" replace />} />
        <Route path="agent/runs/:runId" element={<Navigate to="/admin" replace />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="notifications" element={<NotificationsPage />} />

        {/* Admin Internship Routes */}
        <Route path="internship" element={<AdminInternshipDashboardPage />} />
        <Route path="internship/cohorts" element={<AdminCohortsPage />} />
        <Route path="internship/calibration" element={<AdminHRCalibrationPage />} />
        <Route path="internship/coding-bank" element={<AdminCodingBankPage />} />
        <Route path="internship/attendance" element={<AdminAttendanceAuditPage />} />
      </Route>

      {/* Mentor Portal */}
      <Route path="/mentor" element={<RoleLayout role="mentor" />}>
        <Route index element={<MentorHomePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="questions" element={<QuestionBankPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/live" element={<ExamDetailPage />} />
        <Route path="exams/:examId/results" element={<ExamResultsPage />} />
        <Route path="exams/:examId/marking" element={<MarkingPage />} />
        <Route path="exams/:examId/summaries" element={<Navigate to="/mentor/results" replace />} />
        <Route path="candidates" element={<Navigate to="/mentor/exams" replace />} />
        <Route path="results" element={<ExamResultsPage />} />
        <Route path="summaries" element={<Navigate to="/mentor/results" replace />} />
        <Route path="proctoring" element={<Navigate to="/mentor/exams" replace />} />
        <Route path="notes" element={<Navigate to="/mentor/exams" replace />} />
        <Route path="identity" element={<IdentityReviewPage />} />
        <Route path="sessions/:sessionId" element={<Navigate to="/mentor/exams" replace />} />
        <Route path="sessions/:sessionId/result" element={<CandidateResultPage />} />
        <Route path="sessions/:sessionId/summary" element={<CandidateResultPage />} />
        <Route path="agent" element={<Navigate to="/mentor" replace />} />
        <Route path="agent/runs/:runId" element={<Navigate to="/mentor" replace />} />

        {/* Mentor / Manager Internship Routes */}
        <Route path="internship" element={<ManagerInternshipHubPage />} />
        <Route path="internship/mentees" element={<ManagerMenteesPage />} />
        <Route path="internship/coding" element={<ManagerCodingReviewPage />} />
        <Route path="internship/tasks" element={<ManagerTasksPage />} />
        <Route path="internship/attendance" element={<ManagerAttendancePage />} />
        <Route path="internship/reviews" element={<ManagerMonthlyReviewsPage />} />
      </Route>

      {/* Candidate Direct Flows */}
      <Route
        path="/join/:token"
        element={
          <RequireRole roles={["candidate"]}>
            <JoinPage />
          </RequireRole>
        }
      />
      <Route
        path="/candidate/instructions"
        element={
          <RequireRole roles={["candidate"]}>
            <AppShell nav={[]} title="Assessment Instructions">
              <CandidateInstructionsPage />
            </AppShell>
          </RequireRole>
        }
      />
      <Route
        path="/candidate/camera-setup"
        element={
          <RequireRole roles={["candidate"]}>
            <AppShell nav={[]} title="Camera Setup">
              <CandidateIdentityPage />
            </AppShell>
          </RequireRole>
        }
      />
      <Route
        path="/candidate/identity"
        element={<Navigate to="/candidate/camera-setup" replace />}
      />
      <Route
        path="/candidate/exam"
        element={
          <RequireRole roles={["candidate"]}>
            <CandidateExamPage />
          </RequireRole>
        }
      />
      <Route
        path="/candidate/sessions/:sessionId"
        element={
          <RequireRole roles={["candidate"]}>
            <SessionPage />
          </RequireRole>
        }
      />

      {/* Candidate Portal */}
      <Route path="/candidate" element={<RoleLayout role="candidate" />}>
        <Route index element={<Navigate to="/candidate/assessments" replace />} />
        <Route path="assessments" element={<CandidateAssessmentsPage />} />
        <Route path="results" element={<CandidateResultsViewPage />} />
        <Route path="practice" element={<Navigate to="/candidate/assessments" replace />} />
        <Route path="practice/:practiceId" element={<Navigate to="/candidate/assessments" replace />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<CandidateProfilePage />} />

        {/* Mentee Internship Routes */}
        <Route path="internship" element={<MenteeWorkspacePage />} />
        <Route path="internship/attendance" element={<MenteeAttendancePage />} />
        <Route path="internship/mcq" element={<MenteeWeeklyMCQPage />} />
        <Route path="internship/coding" element={<MenteeCodingPlatformPage />} />
        <Route path="internship/tasks" element={<MenteeTasksPage />} />
        <Route path="internship/skills" element={<MenteeSkillMatrixPage />} />
        <Route path="internship/reviews" element={<MenteeMonthlyReviewsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
