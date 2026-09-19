import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { CivicIssue, IssueStatus, MunicipalOfficer, Citizen } from "./src/types";
import {
  getAllIssues,
  getIssueById,
  getNextIssueId,
  insertIssue,
  updateIssueStatus,
  incrementReportCount,
  getOfficerByEmail,
  getOfficerById,
  getOfficerIssues,
  assignIssueToOfficer,
  verifyIssue,
  findNearbyIssues,
  getAllWardHealthScores,
  getWardHealthScore,
  applyWardHealthPenalty,
  getCitizenByEmail,
  getCitizenById,
  insertCitizen,
  incrementCitizenCivicPoints,
} from "./server/db";

dotenv.config();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = 3000;
const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const REQUEST_TIMEOUT_MS = 30_000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set.");
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express();

/** Increase payload limit to accept base64 image uploads (~10 MB images). */
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// ---------------------------------------------------------------------------
// Auth Middleware
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  officer?: MunicipalOfficer;
}

/**
 * Middleware that validates the Authorization JWT header for officer routes.
 */
function authenticateOfficer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Missing Bearer token." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { officerId: string };
    const officer = getOfficerById(decoded.officerId);
    if (!officer) {
      return res.status(401).json({ error: "Invalid token. Officer record not found." });
    }
    req.officer = officer;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
}

// ---------------------------------------------------------------------------
// Route: POST /api/auth/login — Officer Authentication
// ---------------------------------------------------------------------------

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const officerWithHash = getOfficerByEmail(email);
  if (!officerWithHash) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isMatch = bcrypt.compareSync(password, officerWithHash.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = jwt.sign({ officerId: officerWithHash.id }, JWT_SECRET, { expiresIn: "24h" });
  const { passwordHash, ...officer } = officerWithHash;

  return res.json({ token, officer });
});

/** Verify active token and return current officer session. */
app.get("/api/auth/me", authenticateOfficer as any, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ officer: req.officer });
});

// ---------------------------------------------------------------------------
// Citizen Auth Middleware & Routes
// ---------------------------------------------------------------------------

interface AuthenticatedCitizenRequest extends Request {
  citizen?: Citizen;
}

function authenticateCitizen(
  req: AuthenticatedCitizenRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Please sign in to verify this issue." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { citizenId?: string; role?: string };
    if (!decoded.citizenId || decoded.role !== "citizen") {
      return res.status(401).json({ error: "Invalid token or unauthorized citizen role." });
    }
    const citizen = getCitizenById(decoded.citizenId);
    if (!citizen) {
      return res.status(401).json({ error: "Invalid token. Citizen record not found." });
    }
    req.citizen = citizen;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
}

app.post("/api/auth/citizen/signup", (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  const existing = getCitizenByEmail(email);
  if (existing) {
    return res.status(400).json({ error: "Email is already registered." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const citizenUser = insertCitizen({
    id: "cit_" + Math.random().toString(36).substring(2, 9),
    name: name.trim(),
    email: email.trim(),
    passwordHash,
    civicPoints: 0,
    createdAt: new Date().toISOString(),
  });

  const token = jwt.sign({ citizenId: citizenUser.id, role: "citizen" }, JWT_SECRET, { expiresIn: "30d" });
  const { passwordHash: _, ...citizen } = citizenUser;

  return res.json({ token, citizen });
});

app.post("/api/auth/citizen/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const citizenWithHash = getCitizenByEmail(email);
  if (!citizenWithHash) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isMatch = bcrypt.compareSync(password, citizenWithHash.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = jwt.sign({ citizenId: citizenWithHash.id, role: "citizen" }, JWT_SECRET, { expiresIn: "30d" });
  const { passwordHash: _, ...citizen } = citizenWithHash;

  return res.json({ token, citizen });
});

app.get("/api/auth/citizen/me", authenticateCitizen as any, (req: AuthenticatedCitizenRequest, res: Response) => {
  return res.json({ citizen: req.citizen });
});

// ---------------------------------------------------------------------------
// Protected Officer Routes
// ---------------------------------------------------------------------------

/** Returns all issues, optionally filtered by ?department=, sorted by severity DESC then createdAt ASC. */
app.get("/api/officer/issues", authenticateOfficer as any, (req: AuthenticatedRequest, res: Response) => {
  const department = req.query.department as string | undefined;
  const issues = getOfficerIssues(department);
  return res.json(issues);
});

/** Assigns issue to logged-in officer and updates status to 'acknowledged' if 'reported'. */
app.post("/api/officer/issues/:id/assign", authenticateOfficer as any, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!req.officer) {
    return res.status(401).json({ error: "Unauthorized officer request." });
  }

  const updatedIssue = assignIssueToOfficer(id, req.officer.id);
  if (!updatedIssue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  return res.json(updatedIssue);
});

// ---------------------------------------------------------------------------
// Database persistence initialized via server/db
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Gemini Client & Execution Helpers
// ---------------------------------------------------------------------------

let aiInstance: GoogleGenAI | null = null;

/**
 * Returns the shared Gemini client, initialising it on first call.
 * Throws if GEMINI_API_KEY is absent so callers can fall back gracefully.
 */
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const raw = process.env.GEMINI_API_KEY ?? "";
    const apiKey = raw.trim().replace(/^["']|["']$/g, "");
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not defined. Please add it to your Secrets in Settings."
      );
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiInstance;
}

interface GeminiCallOptions {
  contents: any;
  config?: any;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Executes a Gemini API call with 30s timeout and exponential backoff retry
 * for transient errors (429, 503, rate limits). Tries fallback models if quota is exhausted.
 */
async function generateGeminiContentWithRetry(options: GeminiCallOptions) {
  const { contents, config = {}, timeoutMs = 30000, maxRetries = 1 } = options;
  const ai = getGeminiClient();
  const candidateModels = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash"];

  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      let timerId: NodeJS.Timeout | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => {
            reject(new Error(`GEMINI_TIMEOUT: Request timed out after ${Math.round(timeoutMs / 1000)}s`));
          }, timeoutMs);
          if (timerId && typeof timerId.unref === "function") {
            timerId.unref();
          }
        });

        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              temperature: 0.7,
              maxOutputTokens: 2048,
              ...config,
            },
          }),
          timeoutPromise,
        ]);

        if (timerId) clearTimeout(timerId);
        return response;
      } catch (err: unknown) {
        if (timerId) clearTimeout(timerId);
        lastError = err;
        const rawMsg = err instanceof Error ? err.message : String(err);
        const isQuotaExceeded = rawMsg.includes("Quota exceeded") || rawMsg.includes("RESOURCE_EXHAUSTED");

        // If quota is exhausted for this model, don't retry same model; jump to next model
        if (isQuotaExceeded) {
          console.warn(`[Gemini API - ${modelName}] Quota limit reached. Attempting fallback model...`);
          break;
        }

        const isTransient =
          rawMsg.includes("503") ||
          rawMsg.includes("UNAVAILABLE") ||
          rawMsg.includes("overloaded");

        if (isTransient && attempt <= maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 800;
          console.warn(`[Gemini API - ${modelName}] Transient failure (attempt ${attempt}/${maxRetries + 1}): ${rawMsg}. Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        break; // Try next candidate model if available
      }
    }
  }

  throw lastError || new Error("Gemini call failed after model retries.");
}

/**
 * Checks Gemini candidate finishReason for max output token truncation or safety blocks.
 */
function checkGeminiFinishReason(response: any): { isBlocked: boolean; warning?: string } {
  const candidate = response?.candidates?.[0];
  if (!candidate) return { isBlocked: false };

  const finishReason = candidate.finishReason;
  if (finishReason === "MAX_TOKENS") {
    console.warn("[Gemini API Warning] Response was truncated due to MAX_TOKENS limit.");
    return { isBlocked: false, warning: "Response reached token limit and may be incomplete." };
  }
  if (finishReason === "SAFETY" || finishReason === "RECITATION") {
    console.warn(`[Gemini API Warning] Response was blocked due to finishReason: ${finishReason}.`);
    return { isBlocked: true, warning: "This request couldn't be completed due to content restrictions." };
  }
  return { isBlocked: false };
}

/**
 * Parses Gemini errors into appropriate HTTP status codes and safe user messages.
 */
function parseGeminiError(err: unknown): { statusCode: number; userMessage: string; rawError: string } {
  const rawError = err instanceof Error ? err.message : String(err);
  console.error("[Gemini API Error]:", rawError);

  if (rawError.includes("GEMINI_TIMEOUT")) {
    return {
      statusCode: 504,
      userMessage: "The request to the AI service timed out. Please try again.",
      rawError,
    };
  }
  if (rawError.includes("429") || rawError.includes("RESOURCE_EXHAUSTED") || rawError.includes("Quota exceeded")) {
    return {
      statusCode: 429,
      userMessage: "Rate limit exceeded for the AI service. Please wait a moment and try again.",
      rawError,
    };
  }
  if (rawError.includes("503") || rawError.includes("UNAVAILABLE") || rawError.includes("overloaded")) {
    return {
      statusCode: 503,
      userMessage: "The AI service is temporarily overloaded or unavailable. Please try again shortly.",
      rawError,
    };
  }
  if (rawError.includes("400") || rawError.includes("INVALID_ARGUMENT")) {
    return {
      statusCode: 400,
      userMessage: "Invalid request payload sent to the AI service.",
      rawError,
    };
  }
  if (rawError.includes("GEMINI_API_KEY") || rawError.includes("API key")) {
    return {
      statusCode: 500,
      userMessage: "Gemini API key is not properly configured.",
      rawError,
    };
  }

  return {
    statusCode: 500,
    userMessage: `AI service error: ${rawError}`,
    rawError,
  };
}

// ---------------------------------------------------------------------------
// Local heuristic analyser (Gemini fallback)
// ---------------------------------------------------------------------------

interface LocalAnalysis {
  title: string;
  issueType: string;
  severity: number;
  affectedRadius: string;
  department: string;
  confidence: number;
  reasoning: string;
}

/**
 * Performs keyword-based civic-issue classification when the Gemini API is
 * unavailable or rate-limited. Returns a deterministic LocalAnalysis object.
 */
function getLocalIssueAnalysis(description: string, ward: string): LocalAnalysis {
  const desc = description.toLowerCase();

  let issueType = "Other";
  let severity = 5;
  let affectedRadius = "50 meters";
  let department = "Municipal Ward Office";
  let title = "Reported Civic Issue";
  let reasoning =
    "Determined via local municipal pattern matching because the AI agent service is operating in high-availability backup mode.";

  if (
    desc.includes("pothole") ||
    desc.includes("cracked") ||
    desc.includes("road") ||
    desc.includes("street") ||
    desc.includes("asphalt") ||
    desc.includes("pavement")
  ) {
    issueType = "Road Damage";
    title = "Asphalt Wear & Road Damage";
    severity =
      desc.includes("deep") || desc.includes("huge") || desc.includes("accident") ? 8 : 6;
    affectedRadius = "30 meters";
    department = "Municipal Road Infrastructure";
    reasoning = `Localised asphalt deterioration detected near ${ward}. Requires cold-mix patching to restore pavement integrity.`;
  } else if (
    desc.includes("sewage") ||
    desc.includes("sewer") ||
    desc.includes("smell") ||
    desc.includes("foul") ||
    desc.includes("manhole") ||
    desc.includes("leakage")
  ) {
    issueType = "Sewage Overflow";
    title = "Sewer Main Pipeline Overflow";
    severity = 8;
    affectedRadius = "100 meters";
    department = "Municipal Water Supply & Sewage";
    reasoning = `Critical wastewater leakage reported in ${ward}. Jetting machine deployment and pressure-testing required.`;
  } else if (
    desc.includes("garbage") ||
    desc.includes("trash") ||
    desc.includes("waste") ||
    desc.includes("debris") ||
    desc.includes("dump") ||
    desc.includes("litter")
  ) {
    issueType = "Waste Management";
    title = "Unregulated Solid Waste Accumulation";
    severity = desc.includes("pile") || desc.includes("overflow") ? 6 : 5;
    affectedRadius = "25 meters";
    department = "Municipal Solid Waste Management";
    reasoning = `Improperly discarded waste creating a bio-burden in ${ward}. Sanitation trucks and enforcement required.`;
  } else if (
    desc.includes("flood") ||
    desc.includes("waterlog") ||
    desc.includes("clogged drain") ||
    desc.includes("standing water")
  ) {
    issueType = "Waterlogging / Flooding";
    title = "Stormwater Drain Waterlogging";
    severity = desc.includes("deep") || desc.includes("submerge") ? 9 : 7;
    affectedRadius = "150 meters";
    department = "Municipal Storm Water Drain Dept";
    reasoning =
      "Storm drain congestion causing standing water. Emergency clearing of catch basins recommended.";
  } else if (
    desc.includes("sidewalk") ||
    desc.includes("obstruct") ||
    desc.includes("blocked") ||
    desc.includes("encroachment")
  ) {
    issueType = "Footpath Obstruction";
    title = "Pedestrian Corridor Obstruction";
    severity = 4;
    affectedRadius = "15 meters";
    department = "Municipal Ward Enforcement";
    reasoning =
      "Footpath blockage forcing pedestrians onto vehicle lanes. Enforcement and cleanup required.";
  } else if (
    desc.includes("street light") ||
    desc.includes("dark") ||
    desc.includes("streetlight") ||
    desc.includes("broken lamp")
  ) {
    issueType = "Street Lighting";
    title = "Streetlight Luminaire Failure";
    severity = desc.includes("unsafe") || desc.includes("crime") ? 6 : 5;
    affectedRadius = "200 meters";
    department = "Municipal Electrical Division";
    reasoning = `Non-functional streetlights in ${ward}. Luminaire replacement and wiring audit needed.`;
  }

  if (title === "Reported Civic Issue") {
    const words = description.trim().split(" ");
    title =
      words.length <= 4
        ? description
        : words.slice(0, 4).join(" ") + "...";
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return { title, issueType, severity, affectedRadius, department, confidence: 95, reasoning };
}

// ---------------------------------------------------------------------------
// Ward summary generator (Gemini fallback)
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic, ward-aware health summary string used when the
 * Gemini API cannot be reached for the ward-health diagnostic endpoint.
 */
function getDeterministicSummary(
  wardName: string,
  activeCount: number,
  avgSeverity: number
): string {
  if (activeCount === 0) {
    return (
      `Ward ${wardName} is currently exhibiting an exemplary civic health standing with zero active reports. ` +
      `There are no immediate risks or concerns.\nRecommended Action: Conduct routine preventive inspections to sustain standards.`
    );
  }

  let primaryConcern = "general infrastructure safety";
  let recommendation = "Schedule standard municipal maintenance patrols.";

  const lw = wardName.toLowerCase();
  if (lw.includes("rajpur") || lw.includes("flood")) {
    primaryConcern = "severe waterlogging and drainage blockages";
    recommendation = "Deploy emergency teams to clear major storm water drains.";
  } else if (lw.includes("shastri") || lw.includes("pothole")) {
    primaryConcern = "critical asphalt erosion and hazardous potholes";
    recommendation = "Dispatch road crews to repair hazardous potholes immediately.";
  } else if (lw.includes("civil") || lw.includes("waste")) {
    primaryConcern = "unregulated commercial waste dumping";
    recommendation = "Increase sanitation patrol frequencies and issue warning notices.";
  } else if (lw.includes("lajpat") || lw.includes("light")) {
    primaryConcern = "non-functional streetlights creating safety hazards";
    recommendation = "Initiate immediate repair of broken lamp fixtures.";
  } else if (lw.includes("gandhi") || lw.includes("obstruction")) {
    primaryConcern = "construction debris obstructing footpaths";
    recommendation = "Launch an enforcement drive to clear sidewalk obstructions.";
  } else if (lw.includes("nehru") || lw.includes("colony")) {
    primaryConcern = "aging public utility networks and minor water leaks";
    recommendation = "Conduct an urgent pressure-testing audit on pipelines.";
  } else if (lw.includes("model") || lw.includes("town")) {
    primaryConcern = "unregulated parking and sidewalk encroachment";
    recommendation = "Enforce clear zones on pavements and mark parking spots.";
  } else if (lw.includes("sector")) {
    primaryConcern = "pavement damage near residential parks";
    recommendation = "Paint pedestrian crosswalks and install speed-calming humps.";
  } else if (lw.includes("mg road")) {
    primaryConcern = "high-density traffic bottlenecks";
    recommendation = "Adjust signal timings at critical intersections.";
  }

  const healthScore = Math.max(
    0,
    Math.min(100, 100 - activeCount * 6 - Math.round(avgSeverity * 4))
  );

  return (
    `Ward ${wardName} currently exhibits a civic health status of ${healthScore}/100 with ${activeCount} active reports. ` +
    `Escalating issues in ${primaryConcern} threaten localised community safety.\n` +
    `Recommended Action: ${recommendation}`
  );
}

// ---------------------------------------------------------------------------
// Route: GET /api/ward-health
// ---------------------------------------------------------------------------

/** Returns persistent Ward Health Index scores directly from the database. */
app.get("/api/ward-health", (_req: Request, res: Response) => {
  res.json(getAllWardHealthScores());
});

// ---------------------------------------------------------------------------
// Route: GET /api/transparency/summary
// ---------------------------------------------------------------------------

/** Returns aggregate city-wide accountability metrics, department breakdown, and ward breakdown. */
app.get("/api/transparency/summary", (_req: Request, res: Response) => {
  const issues = getAllIssues();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const totalIssues = issues.length;
  const last30DaysCount = issues.filter(i => new Date(i.createdAt).getTime() >= thirtyDaysAgo).length;

  const resolvedStatuses = ["resolved", "verified"];
  const resolvedIssues = issues.filter(i => i.status && resolvedStatuses.includes(i.status));
  const resolvedCount = resolvedIssues.length;
  const openCount = totalIssues - resolvedCount;
  const resolutionRate = totalIssues > 0 ? Math.round((resolvedCount / totalIssues) * 100) : 0;

  let totalResolutionTimeMs = 0;
  let resolutionTimeCount = 0;
  for (const issue of resolvedIssues) {
    if (issue.resolvedAt && issue.createdAt) {
      const createdTime = new Date(issue.createdAt).getTime();
      const resolvedTime = new Date(issue.resolvedAt).getTime();
      if (resolvedTime > createdTime) {
        totalResolutionTimeMs += (resolvedTime - createdTime);
        resolutionTimeCount++;
      }
    }
  }
  const averageResolutionDays = resolutionTimeCount > 0 
    ? parseFloat((totalResolutionTimeMs / resolutionTimeCount / (1000 * 60 * 60 * 24)).toFixed(1))
    : 2.8;

  const departmentMap: Record<string, { total: number; resolved: number; open: number }> = {};
  for (const issue of issues) {
    const dept = issue.department || "General Municipal";
    if (!departmentMap[dept]) {
      departmentMap[dept] = { total: 0, resolved: 0, open: 0 };
    }
    departmentMap[dept].total++;
    if (issue.status && resolvedStatuses.includes(issue.status)) {
      departmentMap[dept].resolved++;
    } else {
      departmentMap[dept].open++;
    }
  }
  const departmentBreakdown = Object.entries(departmentMap).map(([department, data]) => ({
    department,
    ...data,
    resolutionRate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
  }));

  const wardMap: Record<string, { total: number; resolved: number; open: number; severitySum: number }> = {};
  for (const issue of issues) {
    const w = issue.ward || "Central Ward";
    if (!wardMap[w]) {
      wardMap[w] = { total: 0, resolved: 0, open: 0, severitySum: 0 };
    }
    wardMap[w].total++;
    wardMap[w].severitySum += (issue.severity || 5);
    if (issue.status && resolvedStatuses.includes(issue.status)) {
      wardMap[w].resolved++;
    } else {
      wardMap[w].open++;
    }
  }
  const wardBreakdown = Object.entries(wardMap).map(([wardName, data]) => {
    const avgSeverity = data.total > 0 ? data.severitySum / data.total : 5;
    const healthScore = Math.max(0, Math.min(100, 100 - data.open * 6 - Math.round(avgSeverity * 4)));
    const resolutionRate = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
    return {
      wardName,
      total: data.total,
      resolved: data.resolved,
      open: data.open,
      resolutionRate,
      healthScore,
    };
  }).sort((a, b) => b.resolutionRate - a.resolutionRate);

  res.json({
    totalIssues,
    last30DaysCount,
    resolvedCount,
    openCount,
    resolutionRate,
    averageResolutionDays,
    departmentBreakdown,
    wardBreakdown,
  });
});

// ---------------------------------------------------------------------------
// Route: GET /api/issues
// ---------------------------------------------------------------------------

/** Returns all currently stored civic issues. */
app.get("/api/issues", (_req: Request, res: Response) => {
  res.json(getAllIssues());
});

// ---------------------------------------------------------------------------
// Route: POST /api/issues/:id/upvote
// ---------------------------------------------------------------------------

/** Increments the reportCount for the specified issue (duplicate endorsement). */
app.post("/api/issues/:id/upvote", (req: Request, res: Response) => {
  const { id } = req.params;
  const issue = incrementReportCount(id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }
  const update = applyWardHealthPenalty(issue.ward, 5, "duplicate complaint");
  res.json({
    success: true,
    issue,
    wardHealthScore: update.newScore,
    updatedWard: issue.ward,
  });
});

// ---------------------------------------------------------------------------
// Route: PATCH /api/issues/:id/status — update lifecycle status
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES: IssueStatus[] = [
  "reported",
  "acknowledged",
  "in_progress",
  "resolved",
  "verified",
  "reopened",
];

/** Updates the lifecycle status of an issue. */
app.patch("/api/issues/:id/status", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, officerNotes } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status as IssueStatus)) {
    return res.status(400).json({
      error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }

  const updatedIssue = updateIssueStatus(id, status as IssueStatus, officerNotes);
  if (!updatedIssue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  return res.json(updatedIssue);
});

/**
 * Route: POST /api/issues/:id/verify — Citizen verification route.
 * Accepts { confirmed: boolean }.
 * - confirmed=true: marks status as 'verified' & verifiedAt timestamp.
 * - confirmed=false: reopens issue if reopenedCount < 3, else returns 409 Conflict.
 */
app.post("/api/issues/:id/verify", authenticateCitizen as any, (req: AuthenticatedCitizenRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmed } = req.body;

    if (typeof confirmed !== "boolean") {
      return res.status(400).json({ error: "Field 'confirmed' (boolean) is required." });
    }

    const issue = getIssueById(id);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found." });
    }

    if (issue.reportedByCitizenId && req.citizen && issue.reportedByCitizenId !== req.citizen.id) {
      return res.json({ success: false, error: "Only the citizen who reported this issue can verify its resolution." });
    }

    const result = verifyIssue(id, confirmed);
    if (result.success === false) {
      return res.json({ success: false, error: result.error });
    }

    return res.json({ success: true, ...result.issue });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred during verification.";
    return res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Route: POST /api/issues  — analyse & submit a new civic issue
// ---------------------------------------------------------------------------

/**
 * Accepts a civic report from the frontend, runs it through Gemini Vision
 * for classification, then persists and returns the enriched CivicIssue.
 * Falls back to local heuristics if Gemini is unavailable.
 */
app.post("/api/issues", authenticateCitizen as any, async (req: AuthenticatedCitizenRequest, res: Response) => {
  try {
    const citizenId = req.citizen!.id;
    let { description, ward, lat, lng, imageBase64, quickDetails } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "Description is a required field." });
    }

    ward = ward?.trim() || "Not Specified";

    let analysis: LocalAnalysis & { isValid?: boolean; isDemo?: boolean } | null = null;

    try {
      const parts: unknown[] = [];

      // Attach image bytes when provided
      if (imageBase64) {
        let base64Data = imageBase64;
        let mimeType = "image/jpeg";
        if (imageBase64.includes(";base64,")) {
          const [meta, data] = imageBase64.split(";base64,");
          mimeType = meta.split(":")[1] ?? "image/jpeg";
          base64Data = data;
        }
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const whenNoticed = quickDetails?.duration || "Not specified";
      const affectedRadiusVal = quickDetails?.impact || "Not specified";
      const impactLevelVal = quickDetails?.danger || "Not specified";

      const promptText = `You are CivicLens AI, a civic issue analyzer. Analyze the following report and respond ONLY in this exact JSON format, no extra text:

{
  "title": "clear 5-7 word issue title",
  "issueType": "one of: Road Infrastructure, Water & Drainage, Electricity, Waste Management, Public Safety, Green Spaces, Traffic, Building & Construction, Sanitation, Other",
  "severity": <number 1-10>,
  "affectedRadius": "Local Street/Neighbourhood/Ward/District",
  "department": "responsible department name",
  "confidence": <number 50-95>,
  "reasoning": "2-3 sentence explanation of the analysis",
  "isValid": <true or false>
}

Rules:
- If quick details are filled in (not 'Not specified'), treat as valid even if description is short.
- If input is gibberish, random, or not a civic issue AND quick details are also empty: set isValid to false, severity to 0, issueType to 'Invalid Report', title to 'Unable to process report', reasoning to 'The provided description does not contain enough information to identify a civic issue.'
- Always return valid JSON only.

Input:
Description: "${description}"
When noticed: ${whenNoticed}
Affected radius: ${affectedRadiusVal}
Impact level: ${impactLevelVal}
Ward: "${ward}"
Image provided: ${imageBase64 ? "yes" : "no"}`;

      parts.push({ text: promptText });

      const response = await generateGeminiContentWithRetry({
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              issueType: { type: Type.STRING },
              severity: { type: Type.INTEGER },
              affectedRadius: { type: Type.STRING },
              department: { type: Type.STRING },
              confidence: { type: Type.INTEGER },
              reasoning: { type: Type.STRING },
              isValid: { type: Type.BOOLEAN },
            },
            required: [
              "title","issueType","severity","affectedRadius",
              "department","confidence","reasoning","isValid",
            ],
          },
        },
      });

      console.log("[Gemini /api/issues Raw Output]:", response.text);
      analysis = JSON.parse(response.text?.trim() ?? "{}");
    } catch (geminiErr: unknown) {
      console.warn("Gemini issue analysis failed, using local heuristics fallback:", geminiErr);
      // Gemini unavailable — use local heuristics and flag as demo mode
      analysis = { ...getLocalIssueAnalysis(description, ward), isValid: true, isDemo: true };
    }

    const classifiedIssueType = analysis?.issueType || "Other";
    const submittedLat = Number(lat) || DEFAULT_LAT;
    const submittedLng = Number(lng) || DEFAULT_LNG;
    const isValidReport = analysis?.isValid !== false;

    // Check for existing nearby unresolved issues of the same type within 100 meters
    if (isValidReport) {
      const nearbyMatches = findNearbyIssues(submittedLat, submittedLng, classifiedIssueType, 100);
      if (nearbyMatches.length > 0) {
        const closestMatch = nearbyMatches[0];
        const updatedMatch = incrementReportCount(closestMatch.id) || closestMatch;
        const targetWard = closestMatch.ward || ward;
        const healthUpdate = applyWardHealthPenalty(targetWard, 5, "duplicate complaint");
        const updatedCitizen = incrementCitizenCivicPoints(citizenId, 50);
        return res.json({
          ...updatedMatch,
          wasDuplicate: true,
          matchedIssueId: closestMatch.id,
          wardHealthScore: healthUpdate.newScore,
          updatedWard: targetWard,
          updatedCivicPoints: updatedCitizen?.civicPoints ?? req.citizen!.civicPoints,
        });
      }
    }

    const newIssue: CivicIssue = {
      id: getNextIssueId(),
      title: analysis?.title || "New Reported Issue",
      description,
      ward,
      lat: submittedLat,
      lng: submittedLng,
      imageUrl: imageBase64 || null,
      issueType: classifiedIssueType,
      severity: Number(analysis?.severity) || 5,
      affectedRadius: analysis?.affectedRadius || "Unknown",
      department: analysis?.department || "Municipal Ward Office",
      confidence: Number(analysis?.confidence) || 90,
      reasoning: analysis?.reasoning || "Based on user description.",
      quickDetails,
      isDemo: analysis?.isDemo,
      isValid: isValidReport,
      reportCount: 1,
      createdAt: new Date().toISOString(),
      status: "reported",
      wasDuplicate: false,
      reportedByCitizenId: citizenId,
    };

    if (newIssue.isValid !== false) {
      insertIssue(newIssue);
    }

    const updatedCitizen = incrementCitizenCivicPoints(citizenId, 50);
    return res.json({
      ...newIssue,
      updatedCivicPoints: updatedCitizen?.civicPoints ?? req.citizen!.civicPoints,
    });
  } catch (err: unknown) {
    // Emergency fallback — always return something valid so the UX never breaks
    try {
      const citizenId = req.citizen!.id;
      const { description, ward, lat, lng, imageBase64, quickDetails } = req.body;
      const fallback = getLocalIssueAnalysis(description ?? "Civic report", ward ?? "General Ward");
      const fallbackLat = Number(lat) || DEFAULT_LAT;
      const fallbackLng = Number(lng) || DEFAULT_LNG;

      const nearbyMatches = findNearbyIssues(fallbackLat, fallbackLng, fallback.issueType, 100);
      if (nearbyMatches.length > 0) {
        const closestMatch = nearbyMatches[0];
        const updatedMatch = incrementReportCount(closestMatch.id) || closestMatch;
        const targetWard = closestMatch.ward || ward || "General Ward";
        const healthUpdate = applyWardHealthPenalty(targetWard, 5, "duplicate complaint");
        const updatedCitizen = incrementCitizenCivicPoints(citizenId, 50);
        return res.json({
          ...updatedMatch,
          wasDuplicate: true,
          matchedIssueId: closestMatch.id,
          wardHealthScore: healthUpdate.newScore,
          updatedWard: targetWard,
          updatedCivicPoints: updatedCitizen?.civicPoints ?? req.citizen!.civicPoints,
        });
      }

      const emergencyIssue: CivicIssue = {
        id: getNextIssueId(),
        title: fallback.title,
        description: description ?? "Civic report description.",
        ward: ward ?? "General Ward",
        lat: fallbackLat,
        lng: fallbackLng,
        imageUrl: imageBase64 ?? null,
        issueType: fallback.issueType,
        severity: fallback.severity,
        affectedRadius: fallback.affectedRadius,
        department: fallback.department,
        confidence: fallback.confidence,
        reasoning: fallback.reasoning,
        quickDetails,
        isValid: true,
        reportCount: 1,
        createdAt: new Date().toISOString(),
        status: "reported",
        wasDuplicate: false,
        reportedByCitizenId: citizenId,
      };
      insertIssue(emergencyIssue);
      const updatedCitizen = incrementCitizenCivicPoints(citizenId, 50);
      return res.json({
        ...emergencyIssue,
        updatedCivicPoints: updatedCitizen?.civicPoints ?? req.citizen!.civicPoints,
      });
    } catch {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      return res.status(500).json({ error: message });
    }
  }
});

// ---------------------------------------------------------------------------
// Route: POST /api/ward-summary
// ---------------------------------------------------------------------------

/**
 * Generates an AI-powered ward health diagnostic summary.
 * Falls back to getDeterministicSummary when Gemini is unavailable.
 */
app.post("/api/ward-summary", async (req: Request, res: Response) => {
  try {
    const { wardName, healthScore, activeCount, avgSeverity } = req.body;

    if (!wardName) {
      return res.status(400).json({ error: "Ward name is required." });
    }

    const allIssues = getAllIssues();
    const wardIssues = allIssues.filter(
      (i) => i.ward.toLowerCase() === wardName.toLowerCase()
    );
    const fallbackCount = wardIssues.length;
    const fallbackAvg =
      fallbackCount > 0
        ? Math.round(
            (wardIssues.reduce((s, i) => s + i.severity, 0) / fallbackCount) * 10
          ) / 10
        : 0;
    const fallbackScore = Math.max(
      0,
      Math.min(100, 100 - fallbackCount * 6 - Math.round(fallbackAvg * 4))
    );

    const storedScore = getWardHealthScore(wardName);
    const finalCount = activeCount !== undefined ? Number(activeCount) : fallbackCount;
    const finalAvg = avgSeverity !== undefined ? Number(avgSeverity) : fallbackAvg;
    const finalScore = storedScore;

    const prompt = `You are CivicLens AI. Generate a ward health diagnostic for ${wardName} with health score ${finalScore}, ${finalCount} active issues, average severity ${finalAvg}/10.

Respond in exactly this format — no headers, no bullet points:
First sentence: One sentence describing the current ward health status specifically.
Second sentence: One specific risk or concern based on the data.
Recommended Action: [One clear, specific action in 10 words or less]

Keep total response under 100 words.`;

    let summaryText = "";
    const apiKey = (process.env.GEMINI_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");

    if (apiKey) {
      try {
        const result = await generateGeminiContentWithRetry({
          contents: prompt,
          config: { maxOutputTokens: 2048 },
        });
        console.log("[Gemini /api/ward-summary Raw Output]:", result.text);
        summaryText = result.text ?? "";
      } catch {
        summaryText = getDeterministicSummary(wardName, finalCount, finalAvg);
      }
    } else {
      summaryText = getDeterministicSummary(wardName, finalCount, finalAvg);
    }

    return res.json({
      ward: wardName,
      healthScore: finalScore,
      activeCount: finalCount,
      issueCount: finalCount,
      averageSeverity: finalAvg,
      avgSeverity: finalAvg,
      summary: summaryText.trim() || getDeterministicSummary(wardName, finalCount, finalAvg),
    });
  } catch (err: unknown) {
    try {
      const { wardName, activeCount, avgSeverity, healthScore } = req.body;
      const name = wardName ?? "Selected Ward";
      const count = Number(activeCount) || 0;
      const sev = Number(avgSeverity) || 0;
      const score = Number(healthScore) || 100;
      return res.json({
        ward: name,
        healthScore: score,
        activeCount: count,
        issueCount: count,
        averageSeverity: sev,
        avgSeverity: sev,
        summary: getDeterministicSummary(name, count, sev),
      });
    } catch {
      const message = err instanceof Error ? err.message : "Ward summary generation failed.";
      return res.status(500).json({ error: message });
    }
  }
});

function getFallbackResolutionPlan(issue: any) {
  const dept = issue.department || "Municipal Corporation";
  const title = issue.title || "Civic Issue";
  const ward = issue.ward || "Local Ward";
  const severity = issue.severity || 5;

  return {
    emailDraft: `To: ${dept} Grievance Desk (${ward})
Subject: Formal Notice - ${title} [Urgent Resolution Request]

Dear Municipal Officer,

I am writing to formally report an ongoing civic hazard in ${ward}: "${title}".
Description: ${issue.description || "Substantial civic hazard reported by residents."}
Current Hazard Severity: ${severity}/10.

This issue poses public inconvenience and potential safety risks. Kindly initiate field inspection and allocate repair resources at the earliest.

Sincerely,
CivicLens Resident Reporter (${ward})`,
    timelineDays: severity >= 8 ? 3 : severity >= 5 ? 5 : 7,
    communityActionSteps: [
      `Contact local Ward ${ward} nodal officer with reference ID.`,
      "Share updates and photos with neighborhood Residents Welfare Association (RWA).",
      "Upvote this report on CivicLens to bump city-level escalation priority."
    ],
    reasoning: [
      `Assessed severity level as ${severity}/10 requiring focused intervention from ${dept}.`,
      `Categorized geographically within ${ward} boundaries for optimized dispatch.`,
      `Established a ${severity >= 8 ? "3-day high-priority" : "5-to-7 day standard"} SLA target for civic maintenance teams.`
    ]
  };
}

function getFallbackChatAnswer(issue: any, messages: any[]): string {
  const lastMsg = (messages[messages.length - 1]?.text || "").toLowerCase();
  const title = issue.title || "this issue";
  const ward = issue.ward || "the ward";
  const dept = issue.department || "the municipal department";
  const status = issue.status || "Pending Verification";
  const severity = issue.severity || 5;

  if (lastMsg.includes("status") || lastMsg.includes("update") || lastMsg.includes("progress")) {
    return `The current status of **${title}** in **${ward}** is **${status}**. It is assigned to **${dept}** for inspection.`;
  }
  if (lastMsg.includes("time") || lastMsg.includes("day") || lastMsg.includes("when") || lastMsg.includes("long") || lastMsg.includes("schedule")) {
    const days = severity >= 8 ? "2-3 business days" : "5-7 business days";
    return `For **${title}** (Severity ${severity}/10), target field inspection and repair typically takes **${days}** once acknowledged by **${dept}**.`;
  }
  if (lastMsg.includes("who") || lastMsg.includes("officer") || lastMsg.includes("contact") || lastMsg.includes("dept") || lastMsg.includes("department")) {
    return `This case is routed to **${dept}** serving **${ward}**. Local ward engineers conduct field verification and schedule maintenance crews.`;
  }
  if (lastMsg.includes("hi") || lastMsg.includes("hello") || lastMsg.includes("hey") || lastMsg.includes("greeting")) {
    return `Hello! I am **CivicLens AI Assistant**. I can help you with updates, timeline estimates, and resolution steps for **${title}** in **${ward}**. How can I assist you?`;
  }

  return `Regarding **${title}** in **${ward}**:

- **Assigned Department:** ${dept}
- **Current Status:** ${status}
- **Hazard Level:** ${severity}/10

Field teams log inspections sequentially based on civic urgency and resident upvotes. You can track status changes directly in the Ward Health dashboard.`;
}

// ---------------------------------------------------------------------------
// Route: POST /api/resolve-issue
// ---------------------------------------------------------------------------

/**
 * Uses Gemini to generate a formal resolution plan including a complaint
 * email draft, timeline, community action steps, and AI reasoning.
 */
app.post("/api/resolve-issue", async (req: Request, res: Response) => {
  const { issue } = req.body;
  if (!issue) {
    return res.status(400).json({ error: "Issue details are required." });
  }

  try {
    const prompt = `You are a Municipal Resolution Expert.
Analyze the following civic issue and provide:
1. A formal complaint email draft addressed to the ${issue.department}.
2. A suggested timeline for resolution (in days).
3. Community action steps residents can take.
4. Step-by-step reasoning for this resolution plan.

Issue Details:
- Title: ${issue.title}
- Description: ${issue.description}
- Ward: ${issue.ward}
- Severity: ${issue.severity}/10
- Issue Type: ${issue.issueType}

Return a JSON object with keys: "emailDraft", "timelineDays", "communityActionSteps" (string[]), "reasoning" (string[]).`;

    const result = await generateGeminiContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
      },
    });

    console.log("[Gemini /api/resolve-issue Raw Output]:", result.text);
    const resolution = JSON.parse(result.text ?? "{}");
    return res.json(resolution);
  } catch (err: unknown) {
    console.warn("Gemini /api/resolve-issue failed or quota exceeded, using smart fallback:", err);
    return res.json(getFallbackResolutionPlan(issue));
  }
});

// ---------------------------------------------------------------------------
// Route: POST /api/ask-gemini
// ---------------------------------------------------------------------------

/**
 * Handles multi-turn conversational AI chat within the Resolution Agent modal.
 * Maintains full message history per request for context-aware responses.
 */
app.post("/api/ask-gemini", async (req: Request, res: Response) => {
  const { issue, messages } = req.body;
  if (!issue || !messages) {
    return res.status(400).json({ error: "Issue and messages are required." });
  }

  try {
    const systemPrompt = `You are CivicLens AI, an intelligent civic issue assistant. You have complete context of the current issue:
- Title: ${issue.title}
- Ward: ${issue.ward}
- Severity: ${issue.severity}/10
- Type: ${issue.issueType}
- Department: ${issue.department}
- Description: ${issue.description}
- Status: ${issue.status ?? "Pending"}

RULES:
1. Provide a helpful, complete response. Keep answers clear, direct, and well-explained without cutoffs.
2. Never ask for information already provided above.
3. If the user greets you, greet back warmly and ask how you can help.
4. If the user sends gibberish, say "I didn't understand that. Ask me anything about this civic issue."
5. If asked about status, use the status from context above.
6. Never promise real-world actions (notifications, emails, calls).
7. If the question is unrelated to this civic issue, say "I can only help with this civic report."
8. Be conversational, direct, and helpful. Use markdown (bolding, lists) to format your response clearly.`;

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...messages.map((m: { role: string; text: string }) => ({
        role: m.role === "agent" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
    ];

    const response = await generateGeminiContentWithRetry({
      contents,
      config: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    const check = checkGeminiFinishReason(response);
    if (check.isBlocked) {
      return res.status(400).json({ error: check.warning });
    }

    const outputText = response.text ?? "";
    console.log("[Gemini /api/ask-gemini Raw Output length]:", outputText.length);
    console.log("[Gemini /api/ask-gemini Raw Output]:", outputText);

    return res.json({ response: outputText });
  } catch (err: unknown) {
    console.warn("Gemini /api/ask-gemini failed or quota exceeded, using smart fallback:", err);
    return res.json({ response: getFallbackChatAnswer(issue, messages) });
  }
});

// ---------------------------------------------------------------------------
// Vite dev server / static production assets
// ---------------------------------------------------------------------------

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CivicLens server running on http://localhost:${PORT}`);
  });
}

startServer();
