/**
 * App.tsx
 *
 * Root application shell for CivicLens.
 *
 * Responsibilities:
 *  - Controls the landing page ↔ main app transition.
 *  - Owns the global issues state and exposes mutation helpers
 *    (handleIssueReported, handleUpvoteIssue) to child pages.
 *  - Detects the user's GPS location on mount (falls back to New Delhi).
 *  - Fetches the initial issue list from the backend on mount.
 *  - Spreads the 5 pre-populated demo issues to random coords near the
 *    user's resolved location so the map looks live from the start.
 *  - Renders the persistent header, desktop sidebar, mobile nav drawer,
 *    sync-error banner, and high-severity alert banner.
 *  - Routes between four pages: Report, Map, Priority Board, Ward Health.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Landing from "./Landing";
import {
  AlertTriangle,
  Map,
  TrendingUp,
  HeartPulse,
  AlertCircle,
  Loader2,
  Home,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { CivicIssue, MunicipalOfficer, Citizen } from "./types";
import ReportIssuePage from "./components/ReportIssuePage";
import MapPage from "./components/MapPage";
import PriorityBoardPage from "./components/PriorityBoardPage";
import WardHealthPage from "./components/WardHealthPage";
import TransparencyPage from "./components/TransparencyPage";
import OfficerDashboardPage from "./components/OfficerDashboardPage";
import AlertBanner from "./components/AlertBanner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default map center when GPS is unavailable (New Delhi). */
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };

/** IDs of the pre-populated demo issues seeded by the backend. */
const DEMO_ISSUE_IDS = new Set(["1", "2", "3", "4", "5"]);

/** Maps landing page CTA keys to internal PageType values. */
const PAGE_MAP: Record<string, PageType> = {
  report: "report",
  map: "map",
  board: "priority",
  ward: "health",
  transparency: "transparency",
  officer: "officer",
};

/** Nav tab definitions — single source of truth for both desktop and mobile nav. */
const NAV_TABS = [
  { id: "report",   label: "Report Issue",   icon: AlertTriangle },
  { id: "map",      label: "Map View",        icon: Map },
  { id: "priority", label: "Priority Board",  icon: TrendingUp },
  { id: "health",   label: "Ward Health",     icon: HeartPulse },
  { id: "transparency", label: "Transparency", icon: BarChart3 },
  { id: "officer",  label: "Officer Portal",  icon: ShieldCheck },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageType = "report" | "map" | "priority" | "health" | "transparency" | "officer";


interface ScoredIssue extends CivicIssue {
  score: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * Computes a priority score for an issue.
 * Formula: (severity × reportCount) / daysOpen
 */
function computePriorityScore(issue: CivicIssue): number {
  const daysOpen = Math.max(
    1,
    Math.round(
      (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  return parseFloat(((issue.severity * issue.reportCount) / daysOpen).toFixed(1));
}

/**
 * Computes a 0–100 ward health score.
 * Formula: 100 − (issueCount × 6) − round(avgSeverity × 4), clamped to [0, 100].
 */
function computeWardHealthScore(issueCount: number, avgSeverity: number): number {
  return Math.max(0, Math.min(100, 100 - issueCount * 6 - Math.round(avgSeverity * 4)));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [activePage, setActivePage] = useState<PageType>("report");
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Officer Auth State
  const [officerToken, setOfficerToken] = useState<string | null>(() =>
    localStorage.getItem("civiclens_officer_token")
  );
  const [officer, setOfficer] = useState<MunicipalOfficer | null>(() => {
    const raw = localStorage.getItem("civiclens_officer_data");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Verify stored token on mount
  useEffect(() => {
    if (officerToken) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${officerToken}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Session expired");
          return res.json();
        })
        .then((data) => {
          if (data.officer) setOfficer(data.officer);
        })
        .catch(() => {
          // Token expired or invalid
          setOfficerToken(null);
          setOfficer(null);
          localStorage.removeItem("civiclens_officer_token");
          localStorage.removeItem("civiclens_officer_data");
        });
    }
  }, [officerToken]);

  const handleOfficerLogin = useCallback((token: string, officerData: MunicipalOfficer) => {
    setOfficerToken(token);
    setOfficer(officerData);
    localStorage.setItem("civiclens_officer_token", token);
    localStorage.setItem("civiclens_officer_data", JSON.stringify(officerData));
  }, []);

  const handleOfficerLogout = useCallback(() => {
    setOfficerToken(null);
    setOfficer(null);
    localStorage.removeItem("civiclens_officer_token");
    localStorage.removeItem("civiclens_officer_data");
  }, []);

  // Citizen Auth State
  const [citizenToken, setCitizenToken] = useState<string | null>(() =>
    localStorage.getItem("civiclens_citizen_token")
  );
  const [citizen, setCitizen] = useState<Citizen | null>(() => {
    const raw = localStorage.getItem("civiclens_citizen_data");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (citizenToken) {
      fetch("/api/auth/citizen/me", {
        headers: { Authorization: `Bearer ${citizenToken}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Citizen session expired");
          return res.json();
        })
        .then((data) => {
          if (data.citizen) setCitizen(data.citizen);
        })
        .catch(() => {
          setCitizenToken(null);
          setCitizen(null);
          localStorage.removeItem("civiclens_citizen_token");
          localStorage.removeItem("civiclens_citizen_data");
        });
    }
  }, [citizenToken]);

  const handleCitizenLogin = useCallback((token: string, citizenData: Citizen) => {
    setCitizenToken(token);
    setCitizen(citizenData);
    localStorage.setItem("civiclens_citizen_token", token);
    localStorage.setItem("civiclens_citizen_data", JSON.stringify(citizenData));
  }, []);

  const handleCitizenLogout = useCallback(() => {
    setCitizenToken(null);
    setCitizen(null);
    localStorage.removeItem("civiclens_citizen_token");
    localStorage.removeItem("civiclens_citizen_data");
  }, []);

  const handleUpdateCitizenPoints = useCallback((newPoints: number) => {
    setCitizen((prev) => (prev ? { ...prev, civicPoints: newPoints } : null));
    const raw = localStorage.getItem("civiclens_citizen_data");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.civicPoints = newPoints;
        localStorage.setItem("civiclens_citizen_data", JSON.stringify(parsed));
      } catch {}
    }
  }, []);


  // ---------------------------------------------------------------------------
  // Geolocation
  // ---------------------------------------------------------------------------

  /** Detects the user's GPS location on mount; falls back to DEFAULT_CENTER. */
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported. Defaulting to New Delhi.");
      setUserLocation(DEFAULT_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Geolocation denied/error. Defaulting to New Delhi:", error);
        setUserLocation(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Issue fetching
  // ---------------------------------------------------------------------------

  /** Fetches the full issue list from the backend and triggers the alert banner
   *  if any issue has severity ≥ 8. */
  const fetchIssues = useCallback(async () => {
    setSyncError(null);
    try {
      const response = await fetch("/api/issues");
      if (!response.ok) throw new Error("Unable to contact backend server.");
      const data: CivicIssue[] = await response.json();
      setIssues(data);
      if (data.some((i) => i.severity >= 8)) setShowBanner(true);
    } catch (err: unknown) {
      console.error("Error fetching issues:", err);
      setSyncError("Connection offline. Please wait or reload the workspace.");
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // ---------------------------------------------------------------------------
  // Issue mutation handlers
  // ---------------------------------------------------------------------------

  /** Prepends a newly reported issue to the global issues list. */
  const handleIssueReported = useCallback((newIssue: CivicIssue) => {
    setIssues((prev) => [newIssue, ...prev]);
  }, []);

  /**
   * Sends an upvote to the backend and syncs the updated issue into local state.
   * Falls back to a local +1 increment if the request fails.
   */
  const handleUpvoteIssue = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/issues/${id}/upvote`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to register vote.");
      const data = await response.json();
      if (data.success && data.issue) {
        setIssues((prev) =>
          prev.map((issue) => (issue.id === id ? data.issue : issue))
        );
      }
    } catch (err: unknown) {
      console.error("Upvote error:", err);
      // Local fallback so the UI feels responsive even on a network blip
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id ? { ...issue, reportCount: issue.reportCount + 1 } : issue
        )
      );
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goHome = useCallback(() => setShowLanding(true), []);

  const navigateTo = useCallback((page: PageType) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Sidebar derived data (memoized)
  // ---------------------------------------------------------------------------

  /** Top 5 most at-risk wards for the sidebar widget. */
  const atRiskWards = useMemo(() => {
    const wardNames = Array.from(
      new Set(
        issues
          .map((i) => i.ward)
          .filter((w) => w && w !== "Not Specified" && w !== "Outside Listed Wards")
      )
    ) as string[];

    return wardNames
      .map((wardName) => {
        const wardIssues = issues.filter(
          (i) => i.ward.toLowerCase() === wardName.toLowerCase()
        );
        const issueCount = wardIssues.length;
        const avgSeverity =
          issueCount > 0
            ? Math.round(
                (wardIssues.reduce((sum, i) => sum + i.severity, 0) / issueCount) * 10
              ) / 10
            : 0;
        return { wardName, score: computeWardHealthScore(issueCount, avgSeverity) };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  }, [issues]);

  /** Top 3 highest-priority issues for the sidebar widget. */
  const topPriorityIssues = useMemo<ScoredIssue[]>(
    () =>
      issues
        .map((issue) => ({ ...issue, score: computePriorityScore(issue) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [issues]
  );

  /** The single highest-priority issue used for the alert banner. */
  const topIssue = topPriorityIssues[0] ?? null;

  // ---------------------------------------------------------------------------
  // Render — Landing
  // ---------------------------------------------------------------------------

  if (showLanding) {
    return (
      <Landing
        onEnter={(page) => {
          const target = (page || "report") as string;
          setActivePage(PAGE_MAP[target] ?? "report");
          setShowLanding(false);
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Render — Main app
  // ---------------------------------------------------------------------------

  return (
    <div
      className="h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-hidden"
      id="app_root"
    >
      {/* ── Nav underline animation ── */}
      <style>{`
        .app-nav-link {
          position: relative;
          text-decoration: none;
          color: #64748B;
          font-weight: 600;
          font-size: 0.95rem;
          padding-bottom: 4px;
          cursor: pointer;
        }
        .app-nav-link::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 0; height: 3px;
          background: #2563EB;
          transition: width 0.3s ease;
        }
        .app-nav-link:hover::after,
        .app-nav-link.active::after { width: 100%; }
      `}</style>

      {/* ════════════════════════════════════════
          HEADER
      ════════════════════════════════════════ */}
      <header
        className="h-16 border-b border-slate-200 px-4 md:px-6 flex items-center justify-between bg-white shrink-0 z-50 shadow-xs relative"
        id="app_header"
      >
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={goHome}
          role="button"
          aria-label="Go to home"
        >
          <img src="/landing_logo.png" className="w-10 h-10" alt="CivicLens Logo" />
          <span className="text-xl font-bold tracking-tight md:hidden lg:inline">
            <span style={{ color: "#2563EB" }}>Civic</span>
            <span style={{ color: "#18C7D8" }}>Lens</span>
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-3 lg:gap-8 text-sm font-medium text-slate-500 h-full">
          <button
            onClick={goHome}
            className="h-full flex items-center gap-2 app-nav-link md:text-xs lg:text-[15px] text-slate-500 hover:text-slate-900"
            aria-label="Home"
          >
            <Home className="h-4 w-4 text-slate-400" />
            <span>Home</span>
          </button>

          {NAV_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigateTo(tab.id as PageType)}
                className={`h-full flex items-center gap-2 app-nav-link md:text-xs lg:text-[15px] ${
                  isActive ? "active text-[#2563EB]" : "text-slate-500 hover:text-slate-900"
                }`}
                id={`nav_link_${tab.id}`}
                aria-current={isActive ? "page" : undefined}
              >
                <TabIcon className={`h-4 w-4 ${isActive ? "text-[#2563EB]" : "text-slate-400"}`} />
                <span className="inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right zone */}
        <div className="flex items-center gap-3">
          {/* Citizen session badge / sign in button */}
          {citizen ? (
            <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>{citizen.name}</span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                {citizen.civicPoints} pts
              </span>
              <button
                onClick={handleCitizenLogout}
                className="text-slate-400 hover:text-red-600 ml-1 text-xs font-bold cursor-pointer"
                title="Sign out"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigateTo("report")}
              className="hidden md:inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Citizen Sign In
            </button>
          )}

          {/* Gemini AI live indicator */}
          <div
            className="hidden md:flex items-center gap-1.5 shrink-0 select-none"
            id="navbar_gemini_badge"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span
              className="hidden lg:inline"
              style={{
                fontSize: "10px",
                color: "#0D9488",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Gemini AI
            </span>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 focus:outline-none"
            id="mobile_hamburger_btn"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="text-2xl font-bold leading-none">
              {mobileMenuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MOBILE DROPDOWN NAV
      ════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div
          className="md:hidden bg-white border-b border-slate-200 flex flex-col py-2 px-4 shadow-md absolute top-16 left-0 right-0 z-50"
          id="mobile_dropdown_menu"
        >
          <button
            onClick={() => { goHome(); setMobileMenuOpen(false); }}
            className="flex items-center gap-3 py-3 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg text-left w-full"
          >
            Home
          </button>

          {NAV_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigateTo(tab.id as PageType)}
                className={`flex items-center gap-3 py-3 px-4 text-sm font-semibold rounded-lg text-left w-full ${
                  isActive ? "bg-blue-50 text-[#2563EB]" : "text-slate-600 hover:bg-slate-50"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <TabIcon className={`h-4 w-4 ${isActive ? "text-[#2563EB]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Sync error banner ── */}
      {syncError && (
        <div className="bg-amber-50 border-b border-amber-100 py-2.5 px-4 text-center text-xs font-semibold text-amber-800 flex items-center justify-center gap-2 shrink-0">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span>{syncError}</span>
        </div>
      )}

      {/* ── High-severity alert banner ── */}
      {showBanner && topIssue && (
        <AlertBanner
          onDismiss={() => setShowBanner(false)}
          onViewIssue={() => { setActivePage("priority"); setShowBanner(false); }}
          wardName={topIssue.ward ?? "Unknown Ward"}
          severity={topIssue.severity ?? 9}
        />
      )}

      {/* ════════════════════════════════════════
          MAIN LAYOUT
      ════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden bg-slate-50" id="app_main_stage">
        {loadingIssues ? (
          <div
            className="flex-1 flex flex-col items-center justify-center bg-slate-50 space-y-4"
            id="main_app_loader"
          >
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Bootstrapping Civic Dashboard...
            </p>
          </div>
        ) : (
          <>
            {/* ── Desktop sidebar ── */}
            <aside className="w-64 border-r border-slate-200 bg-white p-4 hidden lg:flex flex-col gap-6 shrink-0 overflow-y-auto">

              {/* Ward Health Index widget */}
              <section>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Ward Health Index
                </h3>
                <div className="text-[9px] text-[#94A3B8] font-bold uppercase mb-[6px]">
                  MOST AT RISK
                </div>
                <div className="space-y-2">
                  {atRiskWards.map(({ wardName, score }) => {
                    let colorClass = "bg-green-50 text-green-600";
                    if (score < 50) colorClass = "bg-red-50 text-red-600";
                    else if (score < 75) colorClass = "bg-orange-50 text-orange-600";
                    else if (score < 90) colorClass = "bg-blue-50 text-blue-600";

                    return (
                      <div
                        key={wardName}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${colorClass}`}
                        onClick={() => navigateTo("health")}
                        role="button"
                        aria-label={`View ${wardName} ward health`}
                      >
                        <span className="text-xs font-semibold text-slate-700">{wardName}</span>
                        <span className="text-xs font-bold font-mono">{score}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Live Priority Board widget */}
              <section>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Live Priority Board
                </h3>
                <div className="space-y-3">
                  {topPriorityIssues.map((issue) => {
                    let borderClass = "border-red-500";
                    if (issue.severity < 5) borderClass = "border-green-500";
                    else if (issue.severity < 8) borderClass = "border-orange-500";

                    return (
                      <div
                        key={issue.id}
                        className={`border-l-4 ${borderClass} pl-3 py-0.5 cursor-pointer hover:bg-slate-50 rounded-r-lg transition-colors`}
                        onClick={() => navigateTo("priority")}
                        role="button"
                        aria-label={`View priority issue: ${issue.title}`}
                      >
                        <p className="text-xs font-bold text-slate-800 line-clamp-1">
                          {issue.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Score: {issue.score} • {issue.ward}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>

            {/* ── Page container ── */}
            <div
              className="flex-1 overflow-y-auto min-w-0"
              id="app_scrollable_container"
            >
              <div className="animate-fade-in h-full bg-slate-50">
                {activePage === "report" && (
                  <ReportIssuePage
                    onIssueReported={handleIssueReported}
                    userLocation={userLocation}
                    citizenToken={citizenToken}
                    citizen={citizen}
                    onCitizenLogin={handleCitizenLogin}
                    onUpdateCitizenPoints={handleUpdateCitizenPoints}
                  />
                )}
                {activePage === "map" && (
                  <MapPage
                    issues={issues}
                    onUpvoteIssue={handleUpvoteIssue}
                    userLocation={userLocation}
                  />
                )}
                {activePage === "priority" && (
                  <PriorityBoardPage
                    issues={issues}
                    onUpvoteIssue={handleUpvoteIssue}
                    onRefreshIssues={fetchIssues}
                  />
                )}
                {activePage === "health" && <WardHealthPage issues={issues} />}
                {activePage === "transparency" && <TransparencyPage />}
                {activePage === "officer" && (
                  <OfficerDashboardPage
                    officer={officer}
                    token={officerToken}
                    onLogin={handleOfficerLogin}
                    onLogout={handleOfficerLogout}
                    issues={issues}
                    onRefreshIssues={fetchIssues}
                  />
                )}

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
