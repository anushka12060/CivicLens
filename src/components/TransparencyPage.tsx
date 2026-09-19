/**
 * TransparencyPage.tsx
 *
 * Public Transparency & Accountability Dashboard for CivicLens.
 * Displays aggregate city-wide accountability metrics, department resolution breakdowns,
 * and ward accountability leaderboards without requiring authentication.
 */

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Activity,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface TransparencySummary {
  totalIssues: number;
  last30DaysCount: number;
  resolvedCount: number;
  openCount: number;
  resolutionRate: number;
  averageResolutionDays: number;
  departmentBreakdown: Array<{
    department: string;
    total: number;
    resolved: number;
    open: number;
    resolutionRate: number;
  }>;
  wardBreakdown: Array<{
    wardName: string;
    total: number;
    resolved: number;
    open: number;
    resolutionRate: number;
    healthScore: number;
  }>;
}

export default function TransparencyPage() {
  const [data, setData] = useState<TransparencySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transparency/summary");
      if (!res.ok) throw new Error("Failed to load transparency metrics.");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  function getRating(score: number) {
    if (score >= 85) return { label: "Excellent", text: "text-green-600", bg: "bg-green-50", bar: "bg-green-500" };
    if (score >= 70) return { label: "Good", text: "text-blue-600", bg: "bg-blue-50", bar: "bg-blue-500" };
    if (score >= 50) return { label: "Fair", text: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-500" };
    return { label: "Critical", text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500" };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8" id="transparency_page">
      {/* Header & Framing Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-md">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-blue-800/60 border border-blue-700/50 text-blue-200 px-3 py-1 rounded-full text-xs font-medium tracking-wide">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Public Accountability Portal • Open Access</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            City-Wide Civic Transparency Dashboard
          </h1>
          <p className="text-blue-100/90 text-sm md:text-base leading-relaxed">
            Every report, every resolution, fully visible — because governance should be traceable, not just promised.
          </p>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">Compiling public accountability records...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchSummary}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && data && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Card 1: Total Issues */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Reports</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.totalIssues}</div>
                <div className="text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-blue-600">+{data.last30DaysCount}</span> filed in past 30 days
                </div>
              </div>
            </div>

            {/* Card 2: Resolution Rate */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Resolution Rate</span>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.resolutionRate}%</div>
                <div className="text-xs text-slate-500 mt-1">
                  {data.resolvedCount} resolved out of {data.totalIssues} total
                </div>
              </div>
            </div>

            {/* Card 3: Avg Time to Resolution */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg. Resolution Speed</span>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.averageResolutionDays} days</div>
                <div className="text-xs text-slate-500 mt-1">
                  Average time from report to closure
                </div>
              </div>
            </div>

            {/* Card 4: Open Backlog */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Backlog</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.openCount}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Pending investigation or dispatch
                </div>
              </div>
            </div>
          </div>

          {/* Department Breakdown Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Departmental Accountability
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Workload distribution and closure efficiency across municipal departments.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.departmentBreakdown.map((dept) => (
                <div key={dept.department} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">{dept.department}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                      {dept.resolutionRate}% resolved
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${dept.resolutionRate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <span>Resolved: <strong className="text-slate-900">{dept.resolved}</strong></span>
                    <span>Open Backlog: <strong className="text-slate-900">{dept.open}</strong></span>
                    <span>Total: <strong className="text-slate-900">{dept.total}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ward Accountability Leaderboard */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Ward Accountability Leaderboard
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resolution effectiveness and civic responsiveness ranked by administrative ward.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold text-xs uppercase tracking-wider bg-slate-50/75">
                    <th className="py-3 px-4">Ward Name</th>
                    <th className="py-3 px-4 text-center">Health Rating</th>
                    <th className="py-3 px-4 text-center">Resolution Rate</th>
                    <th className="py-3 px-4 text-center">Resolved / Total</th>
                    <th className="py-3 px-4 text-right">Open Backlog</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.wardBreakdown.map((ward) => {
                    const rating = getRating(ward.healthScore);
                    return (
                      <tr key={ward.wardName} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{ward.wardName}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${rating.bg} ${rating.text}`}>
                            {rating.label} ({ward.healthScore})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full ${rating.bar}`} style={{ width: `${ward.resolutionRate}%` }} />
                            </div>
                            <span className="font-medium text-slate-700 text-xs">{ward.resolutionRate}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                          {ward.resolved} / {ward.total}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-bold ${ward.open > 3 ? "text-amber-600" : "text-slate-600"}`}>
                            {ward.open}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
