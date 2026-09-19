import React, { useState, useEffect } from "react";
import { CivicIssue } from "../types";
import {
  CheckCircle2,
  RotateCcw,
  X,
  Loader2,
  Building2,
  AlertTriangle,
  ShieldCheck,
  FileText,
} from "lucide-react";

interface CitizenVerificationModalProps {
  issue: CivicIssue;
  onClose: () => void;
  onVerified: () => void;
}

/**
 * CitizenVerificationModal
 *
 * Citizen-facing prompt for resolved issues: "Has this been fixed?"
 * Allows citizens to confirm resolution or reopen the issue if field work is incomplete.
 */
export default function CitizenVerificationModal({
  issue,
  onClose,
  onVerified,
}: CitizenVerificationModalProps) {
  const [loadingAction, setLoadingAction] = useState<"confirm" | "reopen" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Keyboard trap for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleVerify = async (confirmed: boolean) => {
    setLoadingAction(confirmed ? "confirm" : "reopen");
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem("civiclens_citizen_token");
      const res = await fetch(`/api/issues/${issue.id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirmed }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }

      if (!res.ok) {
        throw new Error(data.error || "An unexpected server error occurred. Please try again later.");
      }

      if (data.success === false) {
        throw new Error(data.error || "Failed to process verification.");
      }

      if (confirmed) {
        setSuccessMsg("Thank you! This issue has been officially verified as resolved.");
      } else {
        setSuccessMsg("Issue reopened and queued for department re-assignment.");
      }

      onVerified();

      // Auto-close modal after brief feedback
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected server error occurred. Please try again later.";
      setErrorMsg(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-verify-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* ── Header ── */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2
            id="citizen-verify-title"
            className="text-base font-bold text-slate-900 flex items-center gap-2"
          >
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Citizen Resolution Verification
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 md:p-6 space-y-4">
          {/* Issue context box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Issue #{issue.id}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                <Building2 className="h-3 w-3 text-slate-400" />
                {issue.ward}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 leading-snug">{issue.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
              {issue.description}
            </p>

            {issue.officerNotes && (
              <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-700 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/60">
                <div className="flex items-center gap-1 font-bold text-emerald-800 text-[11px] mb-0.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  Officer Resolution Notes:
                </div>
                <p className="italic text-slate-600 text-[11px]">{issue.officerNotes}</p>
              </div>
            )}
          </div>

          {/* Prompt banner */}
          <div className="text-center py-2 space-y-1">
            <h4 className="text-base font-extrabold text-slate-900">Has this been fixed?</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Municipal officers have marked this complaint as resolved. Please confirm if the issue in your area has been fixed satisfactorily.
            </p>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleVerify(true)}
              disabled={loadingAction !== null || successMsg !== null}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingAction === "confirm" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Yes, confirm
                </>
              )}
            </button>

            <button
              onClick={() => handleVerify(false)}
              disabled={loadingAction !== null || successMsg !== null}
              className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingAction === "reopen" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reopening...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  No, reopen
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
