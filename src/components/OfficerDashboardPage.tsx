import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CivicIssue, MunicipalOfficer, IssueStatus } from "../types";
import {
  ShieldCheck,
  Building2,
  LogOut,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Lock,
  Mail,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

interface OfficerDashboardPageProps {
  /** Logged-in officer object or null if unauthenticated. */
  officer: MunicipalOfficer | null;
  /** JWT token stored in localStorage/parent state. */
  token: string | null;
  /** Callback invoked on successful officer login. */
  onLogin: (token: string, officer: MunicipalOfficer) => void;
  /** Callback invoked to log out current officer. */
  onLogout: () => void;
  /** Global civic issues passed from App state. */
  issues: CivicIssue[];
  /** Callback to trigger a global refetch of issues in App. */
  onRefreshIssues: () => void;
}

const SEVERITY_HIGH = 8;
const SEVERITY_MEDIUM = 5;

const DEMO_ACCOUNTS = [
  { name: "Rajesh Kumar", dept: "Municipal Storm Water Drain Dept", email: "water.officer@civiclens.gov.in" },
  { name: "Anita Sharma", dept: "Municipal Road Infrastructure", email: "roads.officer@civiclens.gov.in" },
  { name: "Sanjay Verma", dept: "Municipal Solid Waste Management", email: "waste.officer@civiclens.gov.in" },
  { name: "Priya Singh", dept: "Municipal Electrical Division", email: "power.officer@civiclens.gov.in" },
  { name: "Vikram Malhotra", dept: "Municipal Ward Enforcement", email: "enforcement.officer@civiclens.gov.in" },
];

/**
 * OfficerDashboardPage
 *
 * Provides a dedicated portal for municipal department officers to view, assign,
 * update lifecycle statuses, and append official resolution notes to civic complaints.
 */
export default function OfficerDashboardPage({
  officer,
  token,
  onLogin,
  onLogout,
  issues,
  onRefreshIssues,
}: OfficerDashboardPageProps) {
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard state
  const [departmentFilter, setDepartmentFilter] = useState<"my_dept" | "all">("my_dept");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Local draft notes & statuses per issue ID
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, IssueStatus>>({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Initialize draft statuses and notes when issues change
  useEffect(() => {
    const notesMap: Record<string, string> = {};
    const statusMap: Record<string, IssueStatus> = {};
    issues.forEach((issue) => {
      notesMap[issue.id] = issue.officerNotes || "";
      statusMap[issue.id] = issue.status || "reported";
    });
    setDraftNotes(notesMap);
    setDraftStatuses(statusMap);
  }, [issues]);

  // Clear feedback messages after 4s
  useEffect(() => {
    if (actionSuccessMsg) {
      const timer = setTimeout(() => setActionSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMsg]);

  // ---------------------------------------------------------------------------
  // Authentication Handlers
  // ---------------------------------------------------------------------------

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter both email and password.");
      return;
    }
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      onLogin(data.token, data.officer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication error.";
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFillDemoAccount = (email: string) => {
    setLoginEmail(email);
    setLoginPassword("password123");
    setLoginError(null);
  };

  // ---------------------------------------------------------------------------
  // Issue Operations
  // ---------------------------------------------------------------------------

  const handleAssignToMe = async (issueId: string) => {
    if (!token || !officer) return;
    setAssigningId(issueId);

    try {
      const res = await fetch(`/api/officer/issues/${issueId}/assign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to assign issue.");
      }

      setActionSuccessMsg(`Issue #${issueId} successfully assigned to ${officer.name}.`);
      onRefreshIssues();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to assign issue.";
      alert(msg);
    } finally {
      setAssigningId(null);
    }
  };

  const handleUpdateStatusAndNotes = async (issueId: string) => {
    const newStatus = draftStatuses[issueId];
    const notes = draftNotes[issueId];

    setUpdatingId(issueId);
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, officerNotes: notes }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update status.");
      }

      setActionSuccessMsg(`Updated status & resolution notes for issue #${issueId}.`);
      onRefreshIssues();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status.";
      alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived Filtering & Metrics
  // ---------------------------------------------------------------------------

  const filteredIssues = useMemo(() => {
    let list = [...issues];

    if (departmentFilter === "my_dept" && officer) {
      list = list.filter(
        (i) => i.department.toLowerCase() === officer.department.toLowerCase()
      );
    }

    // Sort by severity DESC, then createdAt ASC (urgent & oldest first)
    return list.sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [issues, departmentFilter, officer]);

  const assignedToMeCount = useMemo(() => {
    if (!officer) return 0;
    return issues.filter((i) => i.assignedOfficerId === officer.id).length;
  }, [issues, officer]);

  const activeDeptCount = useMemo(() => {
    if (!officer) return 0;
    return issues.filter(
      (i) =>
        i.department.toLowerCase() === officer.department.toLowerCase() &&
        i.status !== "resolved" &&
        i.status !== "verified"
    ).length;
  }, [issues, officer]);

  const resolvedDeptCount = useMemo(() => {
    if (!officer) return 0;
    return issues.filter(
      (i) =>
        i.department.toLowerCase() === officer.department.toLowerCase() &&
        (i.status === "resolved" || i.status === "verified")
    ).length;
  }, [issues, officer]);

  // ---------------------------------------------------------------------------
  // Style Helpers
  // ---------------------------------------------------------------------------

  const getSeverityBadge = (severity: number): string => {
    if (severity >= SEVERITY_HIGH) return "bg-red-50 text-red-700 border-red-100";
    if (severity >= SEVERITY_MEDIUM) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-green-50 text-green-700 border-green-100";
  };

  const getStatusBadge = (status?: IssueStatus): { text: string; className: string } => {
    switch (status) {
      case "acknowledged":
        return { text: "Acknowledged", className: "bg-blue-50 text-blue-700 border-blue-200" };
      case "in_progress":
        return { text: "In Progress", className: "bg-amber-50 text-amber-700 border-amber-200" };
      case "resolved":
        return { text: "Resolved", className: "bg-green-50 text-green-700 border-green-200" };
      case "verified":
        return { text: "Verified", className: "bg-teal-50 text-teal-700 border-teal-200" };
      case "reopened":
        return { text: "Reopened", className: "bg-purple-50 text-purple-700 border-purple-200" };
      case "reported":
      default:
        return { text: "New Report", className: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Unauthenticated (Login View)
  // ---------------------------------------------------------------------------

  if (!officer || !token) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 bg-[#F8FAFC]">
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-[#2563EB] rounded-2xl mb-3">
              <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Officer Portal Sign In
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Log in with your official municipal department credentials to manage dispatch queues, assign tasks, and publish status updates.
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="officer@civiclens.gov.in"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Sign In to Officer Console
                </>
              )}
            </button>
          </form>

          {/* Quick-fill demo accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-[#2563EB] mb-2 bg-blue-50/80 p-2 rounded-lg border border-blue-100">
              Demo login: Click one of the official officer accounts below to auto-fill credentials:
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
              Available Officer Accounts (Password: password123)
            </p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => handleFillDemoAccount(acc.email)}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-[11px] transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 group-hover:text-[#2563EB]">
                      {acc.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {acc.email}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded text-right">
                    {acc.dept.replace("Municipal ", "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Authenticated Officer Dashboard View
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2 border-l-4 border-teal-400 pl-3">
            <ShieldCheck className="text-[#2563EB] h-7 w-7" aria-hidden="true" />
            Municipal Officer Operations Console
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Manage issues assigned to your department, acknowledge reports, assign ownership, and record resolution progress notes.
          </p>
        </div>

        {/* Officer Profile Badge & Logout */}
        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="h-9 w-9 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-xs">
            {officer.name.charAt(0)}
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-slate-900">{officer.name}</p>
            <p className="text-[10px] text-blue-600 font-semibold truncate max-w-[200px]">
              {officer.department}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccessMsg && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Assigned To Me
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-950 font-mono">
              {assignedToMeCount}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              active tasks
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Dept Pending Queue
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-950 font-mono">
              {activeDeptCount}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              unresolved cases
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Dept Resolved Count
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-green-700 font-mono">
              {resolvedDeptCount}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              completed
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-xl">
          <button
            onClick={() => setDepartmentFilter("my_dept")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              departmentFilter === "my_dept"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Department ({officer.department.replace("Municipal ", "")})
          </button>
          <button
            onClick={() => setDepartmentFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              departmentFilter === "all"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Departments ({issues.length})
          </button>
        </div>

        <button
          onClick={onRefreshIssues}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2563EB] bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Queue
        </button>
      </div>

      {/* ── Issues List ── */}
      <div className="space-y-4">
        {filteredIssues.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No issues found in queue.</p>
            <p className="text-xs text-slate-400 mt-1">
              {departmentFilter === "my_dept"
                ? "Your department has no active reported issues."
                : "There are no civic reports matching the selected view."}
            </p>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isAssignedToMe = issue.assignedOfficerId === officer.id;
            const currentStatus = draftStatuses[issue.id] || issue.status || "reported";
            const currentNotes = draftNotes[issue.id] ?? (issue.officerNotes || "");
            const badge = getStatusBadge(issue.status);
            const isExpanded = expandedId === issue.id;

            return (
              <div
                key={issue.id}
                className={`bg-white border rounded-xl shadow-xs overflow-hidden transition-all ${
                  isAssignedToMe ? "border-teal-300 ring-1 ring-teal-100" : "border-slate-200"
                }`}
              >
                {/* Main Row Bar */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(
                          issue.severity
                        )}`}
                      >
                        Severity {issue.severity}
                      </span>

                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${badge.className}`}
                      >
                        {badge.text}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {issue.ward}
                      </span>

                      {isAssignedToMe && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase tracking-wider">
                          <UserCheck className="h-3 w-3" />
                          Assigned to You
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {issue.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {issue.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-medium">
                      <span>Department: <strong className="text-slate-700">{issue.department}</strong></span>
                      <span>Reports: <strong className="text-slate-700">{issue.reportCount}</strong></span>
                      <span>Created: <strong className="text-slate-700">{new Date(issue.createdAt).toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  {/* Actions & Expand Toggle */}
                  <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 shrink-0">
                    {!isAssignedToMe ? (
                      <button
                        onClick={() => handleAssignToMe(issue.id)}
                        disabled={assigningId === issue.id}
                        className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {assigningId === issue.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        Assign to Me
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" />
                        Owned Task
                      </span>
                    )}

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {isExpanded ? "Hide Controls" : "Update Status & Notes"}
                    </button>
                  </div>
                </div>

                {/* Expanded Management Panel */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lifecycle Status Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Lifecycle Status
                        </label>
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            setDraftStatuses((prev) => ({
                              ...prev,
                              [issue.id]: e.target.value as IssueStatus,
                            }))
                          }
                          className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                        >
                          <option value="reported">Reported (New)</option>
                          <option value="acknowledged">Acknowledged</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="verified">Verified</option>
                          <option value="reopened">Reopened</option>
                        </select>
                      </div>

                      {/* AI Reasoning Context */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          AI Diagnostic Reasoning
                        </label>
                        <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                          {issue.reasoning}
                        </p>
                      </div>
                    </div>

                    {/* Officer Notes Textarea */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Officer Progress Notes & Field Resolution Details
                      </label>
                      <textarea
                        rows={3}
                        value={currentNotes}
                        onChange={(e) =>
                          setDraftNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                        placeholder="Add municipal dispatch notes, field inspection findings, contractor ticket IDs, or resolution details..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                      />
                    </div>

                    {/* Save Action Bar */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => handleUpdateStatusAndNotes(issue.id)}
                        disabled={updatingId === issue.id}
                        className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {updatingId === issue.id ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Save Status & Notes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
