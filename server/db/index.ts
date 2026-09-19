import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { CivicIssue, IssueStatus, MunicipalOfficer } from "../../src/types";

// ---------------------------------------------------------------------------
// Database Initialization & Connection
// ---------------------------------------------------------------------------

const dbPath = path.join(process.cwd(), "civiclens.db");
export const db = new Database(dbPath);

// Enable Write-Ahead Logging for improved concurrency
db.pragma("journal_mode = WAL");

// ---------------------------------------------------------------------------
// Schema Setup
// ---------------------------------------------------------------------------

const schemaPath = path.join(process.cwd(), "server", "db", "schema.sql");
let schemaSql = "";

if (fs.existsSync(schemaPath)) {
  schemaSql = fs.readFileSync(schemaPath, "utf-8");
} else {
  schemaSql = `
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      ward TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      imageUrl TEXT,
      issueType TEXT NOT NULL,
      severity INTEGER NOT NULL,
      affectedRadius TEXT NOT NULL,
      department TEXT NOT NULL,
      confidence REAL NOT NULL,
      reasoning TEXT NOT NULL,
      reportCount INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      isDemo INTEGER NOT NULL DEFAULT 0,
      isValid INTEGER NOT NULL DEFAULT 1,
      quickDetails TEXT,
      status TEXT NOT NULL DEFAULT 'reported',
      assignedOfficerId TEXT,
      officerNotes TEXT,
      resolvedAt TEXT,
      verifiedAt TEXT,
      reopenedCount INTEGER NOT NULL DEFAULT 0
    );
  `;
}

db.exec(schemaSql);

// Ensure citizens table and reportedByCitizenId column exist
db.exec(`
  CREATE TABLE IF NOT EXISTS citizens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    civicPoints INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  )
`);

try {
  db.exec(`ALTER TABLE issues ADD COLUMN reportedByCitizenId TEXT`);
} catch {
  // Column might already exist
}

// ---------------------------------------------------------------------------
// Seed Initial Demo Issues (if table is empty)
// ---------------------------------------------------------------------------

const countRow = db.prepare("SELECT COUNT(*) as count FROM issues").get() as { count: number };

if (countRow.count === 0) {
  const seedIssues: CivicIssue[] = [
    {
      id: "1",
      title: "Severe Road Waterlogging & Blockage",
      description:
        "Heavy monsoon shower waterlogging on the main outer ring road near the flyover. Cars are stuck and traffic is at a complete standstill.",
      ward: "Rajpur",
      lat: 28.5500,
      lng: 77.3000,
      imageUrl: null,
      issueType: "Waterlogging / Flooding",
      severity: 9,
      affectedRadius: "200 meters",
      department: "Municipal Storm Water Drain Dept",
      confidence: 96,
      reasoning:
        "High water levels reaching vehicle bumpers under a primary commercial flyover completely disrupts high-density traffic, indicating an emergency flood event.",
      reportCount: 42,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
      isValid: true,
      status: "reported",
    },
    {
      id: "2",
      title: "Dangerous Deep Crater Pothole",
      description:
        "Deep pothole right after the 80 Feet Road crossing. Two motorcyclists slipped here yesterday evening.",
      ward: "Shastri Nagar",
      lat: 28.6700,
      lng: 77.1900,
      imageUrl: null,
      issueType: "Road Damage",
      severity: 8,
      affectedRadius: "15 meters",
      department: "Municipal Road Infrastructure",
      confidence: 92,
      reasoning:
        "An asphalt collapse on a central arterial road is a severe hazard, especially for two-wheelers, with recorded minor accidents compounding urgency.",
      reportCount: 28,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
      isValid: true,
      status: "reported",
    },
    {
      id: "3",
      title: "Unattended Commercial Waste Dump",
      description:
        "Huge pile of mixed organic waste, plastics, and wooden boxes left directly on the footpath near the main commercial street, smelling bad.",
      ward: "Civil Lines",
      lat: 28.6800,
      lng: 77.2200,
      imageUrl: null,
      issueType: "Waste Management",
      severity: 6,
      affectedRadius: "40 meters",
      department: "Municipal Solid Waste Management",
      confidence: 89,
      reasoning:
        "Accumulation of commercial garbage blocks a high-traffic pedestrian walkway, causing unsanitary conditions and odor pollution.",
      reportCount: 19,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
      isValid: true,
      status: "reported",
    },
    {
      id: "4",
      title: "Broken Streetlights Stretch",
      description:
        "A stretch of three streetlights is completely broken, leaving the footpath and half of the road pitch black at night.",
      ward: "Lajpat Nagar",
      lat: 28.5700,
      lng: 77.2400,
      imageUrl: null,
      issueType: "Street Lighting",
      severity: 5,
      affectedRadius: "120 meters",
      department: "Municipal Electrical Division",
      confidence: 91,
      reasoning:
        "Multiple non-functional streetlights on a highly frequented commercial corridor reduce nighttime visibility and raise neighbourhood security concerns.",
      reportCount: 11,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
      isValid: true,
      status: "reported",
    },
    {
      id: "5",
      title: "Construction Debris Sidewalk Obstruction",
      description:
        "Large pile of concrete blocks, cement sacks, and debris dumped on the sidewalk. Pedestrians have to walk on the busy main road.",
      ward: "Gandhi Nagar",
      lat: 28.6500,
      lng: 77.2800,
      imageUrl: null,
      issueType: "Footpath Obstruction",
      severity: 7,
      affectedRadius: "25 meters",
      department: "Municipal Ward Enforcement",
      confidence: 94,
      reasoning:
        "Unlawful disposal of construction debris entirely blocking a public walkway forces active foot traffic into a fast-moving vehicle lane.",
      reportCount: 15,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
      isValid: true,
      status: "reported",
    },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO issues (
      id, title, description, ward, lat, lng, imageUrl, issueType,
      severity, affectedRadius, department, confidence, reasoning,
      reportCount, createdAt, isDemo, isValid, quickDetails,
      status, assignedOfficerId, officerNotes, resolvedAt, verifiedAt, reopenedCount
    ) VALUES (
      @id, @title, @description, @ward, @lat, @lng, @imageUrl, @issueType,
      @severity, @affectedRadius, @department, @confidence, @reasoning,
      @reportCount, @createdAt, @isDemo, @isValid, @quickDetails,
      @status, @assignedOfficerId, @officerNotes, @resolvedAt, @verifiedAt, @reopenedCount
    )
  `);

  const seedTransaction = db.transaction((issuesToSeed: CivicIssue[]) => {
    for (const issue of issuesToSeed) {
      insertStmt.run({
        id: issue.id,
        title: issue.title,
        description: issue.description,
        ward: issue.ward,
        lat: issue.lat,
        lng: issue.lng,
        imageUrl: issue.imageUrl ?? null,
        issueType: issue.issueType,
        severity: issue.severity,
        affectedRadius: issue.affectedRadius,
        department: issue.department,
        confidence: issue.confidence,
        reasoning: issue.reasoning,
        reportCount: issue.reportCount,
        createdAt: issue.createdAt,
        isDemo: issue.isDemo ? 1 : 0,
        isValid: issue.isValid !== false ? 1 : 0,
        quickDetails: issue.quickDetails ? JSON.stringify(issue.quickDetails) : null,
        status: issue.status || "reported",
        assignedOfficerId: issue.assignedOfficerId ?? null,
        officerNotes: issue.officerNotes ?? null,
        resolvedAt: issue.resolvedAt ?? null,
        verifiedAt: issue.verifiedAt ?? null,
        reopenedCount: issue.reopenedCount ?? 0,
      });
    }
  });

  seedTransaction(seedIssues);
}

// ---------------------------------------------------------------------------
// Seed Initial Demo Officers (if table is empty)
// ---------------------------------------------------------------------------

const officerCountRow = db.prepare("SELECT COUNT(*) as count FROM officers").get() as { count: number };

if (officerCountRow.count === 0) {
  const defaultPasswordHash = bcrypt.hashSync("password123", 10);
  const seedOfficers = [
    {
      id: "off_1",
      name: "Rajesh Kumar",
      department: "Municipal Storm Water Drain Dept",
      email: "water.officer@civiclens.gov.in",
      passwordHash: defaultPasswordHash,
    },
    {
      id: "off_2",
      name: "Anita Sharma",
      department: "Municipal Road Infrastructure",
      email: "roads.officer@civiclens.gov.in",
      passwordHash: defaultPasswordHash,
    },
    {
      id: "off_3",
      name: "Sanjay Verma",
      department: "Municipal Solid Waste Management",
      email: "waste.officer@civiclens.gov.in",
      passwordHash: defaultPasswordHash,
    },
    {
      id: "off_4",
      name: "Priya Singh",
      department: "Municipal Electrical Division",
      email: "power.officer@civiclens.gov.in",
      passwordHash: defaultPasswordHash,
    },
    {
      id: "off_5",
      name: "Vikram Malhotra",
      department: "Municipal Ward Enforcement",
      email: "enforcement.officer@civiclens.gov.in",
      passwordHash: defaultPasswordHash,
    },
  ];

  const insertOfficerStmt = db.prepare(`
    INSERT INTO officers (id, name, department, email, passwordHash)
    VALUES (@id, @name, @department, @email, @passwordHash)
  `);

  const seedOfficerTx = db.transaction((officersToSeed: typeof seedOfficers) => {
    for (const off of officersToSeed) {
      insertOfficerStmt.run(off);
    }
  });

  seedOfficerTx(seedOfficers);
}

// ---------------------------------------------------------------------------
// Seed Initial Ward Health Scores (if table is empty)
// ---------------------------------------------------------------------------

export const DEFAULT_BASELINE_SCORES: Record<string, number> = {
  "Rajpur": 58,
  "Shastri Nagar": 62,
  "Gandhi Nagar": 66,
  "Civil Lines": 70,
  "Lajpat Nagar": 74,
  "Nehru Colony": 85,
  "Model Town": 88,
  "Sector 12": 90,
  "MG Road": 82,
  "Karol Bagh": 80,
};

db.exec(`
  CREATE TABLE IF NOT EXISTS ward_health (
    ward TEXT PRIMARY KEY,
    healthScore INTEGER NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

const wardHealthCountRow = db.prepare("SELECT COUNT(*) as count FROM ward_health").get() as { count: number };

if (wardHealthCountRow.count === 0) {
  const insertWardHealthStmt = db.prepare(`
    INSERT INTO ward_health (ward, healthScore, updatedAt)
    VALUES (@ward, @healthScore, @updatedAt)
    ON CONFLICT(ward) DO NOTHING
  `);

  const now = new Date().toISOString();
  const seedWardHealthTx = db.transaction(() => {
    for (const [ward, healthScore] of Object.entries(DEFAULT_BASELINE_SCORES)) {
      insertWardHealthStmt.run({ ward, healthScore, updatedAt: now });
    }
  });

  seedWardHealthTx();
}


// ---------------------------------------------------------------------------
// Row Mapper Helper
// ---------------------------------------------------------------------------

function mapRowToIssue(row: any): CivicIssue {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    ward: row.ward,
    lat: Number(row.lat),
    lng: Number(row.lng),
    imageUrl: row.imageUrl ?? null,
    issueType: row.issueType,
    severity: Number(row.severity),
    affectedRadius: row.affectedRadius,
    department: row.department,
    confidence: Number(row.confidence),
    reasoning: row.reasoning,
    reportCount: Number(row.reportCount),
    createdAt: row.createdAt,
    isDemo: Boolean(row.isDemo),
    isValid: row.isValid !== 0,
    quickDetails: row.quickDetails ? JSON.parse(row.quickDetails) : undefined,
    status: (row.status || "reported") as IssueStatus,
    assignedOfficerId: row.assignedOfficerId ?? null,
    reportedByCitizenId: row.reportedByCitizenId ?? null,
    officerNotes: row.officerNotes ?? null,
    resolvedAt: row.resolvedAt ?? null,
    verifiedAt: row.verifiedAt ?? null,
    reopenedCount: Number(row.reopenedCount ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Exported Helper Functions
// ---------------------------------------------------------------------------

/**
 * Returns all stored civic issues ordered by creation date descending.
 */
export function getAllIssues(): CivicIssue[] {
  const rows = db.prepare("SELECT * FROM issues ORDER BY createdAt DESC").all();
  return rows.map(mapRowToIssue);
}

/**
 * Fetches a single issue by its unique ID.
 */
export function getIssueById(id: string): CivicIssue | null {
  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
  return row ? mapRowToIssue(row) : null;
}

/**
 * Generates the next sequential numeric string ID for new issues.
 */
export function getNextIssueId(): string {
  const row = db.prepare("SELECT MAX(CAST(id AS INTEGER)) as maxId FROM issues").get() as { maxId: number | null };
  const maxId = row?.maxId ?? 0;
  return String(maxId + 1);
}

/**
 * Inserts a new civic issue into the SQLite database.
 */
export function insertIssue(issue: CivicIssue): CivicIssue {
  const stmt = db.prepare(`
    INSERT INTO issues (
      id, title, description, ward, lat, lng, imageUrl, issueType,
      severity, affectedRadius, department, confidence, reasoning,
      reportCount, createdAt, isDemo, isValid, quickDetails,
      status, assignedOfficerId, reportedByCitizenId, officerNotes, resolvedAt, verifiedAt, reopenedCount
    ) VALUES (
      @id, @title, @description, @ward, @lat, @lng, @imageUrl, @issueType,
      @severity, @affectedRadius, @department, @confidence, @reasoning,
      @reportCount, @createdAt, @isDemo, @isValid, @quickDetails,
      @status, @assignedOfficerId, @reportedByCitizenId, @officerNotes, @resolvedAt, @verifiedAt, @reopenedCount
    )
  `);

  stmt.run({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    ward: issue.ward,
    lat: issue.lat,
    lng: issue.lng,
    imageUrl: issue.imageUrl ?? null,
    issueType: issue.issueType,
    severity: issue.severity,
    affectedRadius: issue.affectedRadius,
    department: issue.department,
    confidence: issue.confidence,
    reasoning: issue.reasoning,
    reportCount: issue.reportCount ?? 1,
    createdAt: issue.createdAt || new Date().toISOString(),
    isDemo: issue.isDemo ? 1 : 0,
    isValid: issue.isValid !== false ? 1 : 0,
    quickDetails: issue.quickDetails ? JSON.stringify(issue.quickDetails) : null,
    status: issue.status || "reported",
    assignedOfficerId: issue.assignedOfficerId ?? null,
    reportedByCitizenId: issue.reportedByCitizenId ?? null,
    officerNotes: issue.officerNotes ?? null,
    resolvedAt: issue.resolvedAt ?? null,
    verifiedAt: issue.verifiedAt ?? null,
    reopenedCount: issue.reopenedCount ?? 0,
  });

  return getIssueById(issue.id) ?? issue;
}

/**
 * Updates the resolution lifecycle status of an issue.
 * If status is transitioned to 'resolved', sets resolvedAt timestamp.
 */
export function updateIssueStatus(
  id: string,
  status: IssueStatus,
  officerNotes?: string
): CivicIssue | null {
  const existing = getIssueById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  let resolvedAt = existing.resolvedAt ?? null;
  let verifiedAt = existing.verifiedAt ?? null;
  let reopenedCount = existing.reopenedCount ?? 0;

  if (status === "resolved") {
    resolvedAt = now;
  }
  if (status === "verified") {
    verifiedAt = now;
  }
  if (status === "reopened") {
    reopenedCount += 1;
  }

  const updatedNotes = officerNotes !== undefined ? officerNotes : existing.officerNotes ?? null;

  db.prepare(`
    UPDATE issues
    SET status = ?, officerNotes = ?, resolvedAt = ?, verifiedAt = ?, reopenedCount = ?
    WHERE id = ?
  `).run(status, updatedNotes, resolvedAt, verifiedAt, reopenedCount, id);

  return getIssueById(id);
}

/**
 * Increments the reportCount (upvote/endorsement) for an issue.
 */
export function incrementReportCount(id: string): CivicIssue | null {
  const result = db.prepare(`
    UPDATE issues
    SET reportCount = reportCount + 1
    WHERE id = ?
  `).run(id);

  if (result.changes === 0) return null;
  return getIssueById(id);
}

// ---------------------------------------------------------------------------
// Citizen Database Operations
// ---------------------------------------------------------------------------

export interface CitizenUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  civicPoints: number;
  createdAt: string;
}

export function getCitizenByEmail(email: string): CitizenUser | null {
  const row = db.prepare("SELECT * FROM citizens WHERE LOWER(email) = LOWER(?)").get(email) as any;
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    civicPoints: Number(row.civicPoints || 0),
    createdAt: row.createdAt,
  };
}

export function getCitizenById(id: string): Omit<CitizenUser, "passwordHash"> | null {
  const row = db.prepare("SELECT id, name, email, civicPoints, createdAt FROM citizens WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    civicPoints: Number(row.civicPoints || 0),
    createdAt: row.createdAt,
  };
}

export function insertCitizen(citizen: { id: string; name: string; email: string; passwordHash: string; civicPoints: number; createdAt: string }): CitizenUser {
  db.prepare(`
    INSERT INTO citizens (id, name, email, passwordHash, civicPoints, createdAt)
    VALUES (@id, @name, @email, @passwordHash, @civicPoints, @createdAt)
  `).run(citizen);
  return getCitizenByEmail(citizen.email)!;
}

export function incrementCitizenCivicPoints(citizenId: string, points: number = 50): Omit<CitizenUser, "passwordHash"> | null {
  db.prepare(`
    UPDATE citizens
    SET civicPoints = civicPoints + ?
    WHERE id = ?
  `).run(points, citizenId);
  return getCitizenById(citizenId);
}

// ---------------------------------------------------------------------------
// Officer Database Operations
// ---------------------------------------------------------------------------

/**
 * Fetches an officer record by email address (includes passwordHash for auth check).
 */
export function getOfficerByEmail(email: string): {
  id: string;
  name: string;
  department: string;
  email: string;
  passwordHash: string;
} | null {
  const row = db.prepare("SELECT * FROM officers WHERE LOWER(email) = LOWER(?)").get(email) as any;
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    department: row.department,
    email: row.email,
    passwordHash: row.passwordHash,
  };
}

/**
 * Fetches an officer record by unique ID (omits passwordHash).
 */
export function getOfficerById(id: string): MunicipalOfficer | null {
  const row = db.prepare("SELECT id, name, department, email FROM officers WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    department: row.department,
    email: row.email,
  };
}

/**
 * Returns issues sorted by severity descending then createdAt ascending (urgent oldest issues first).
 * Optionally filtered by department.
 */
export function getOfficerIssues(department?: string): CivicIssue[] {
  let rows: any[];
  if (department && department.trim() !== "") {
    rows = db
      .prepare(
        "SELECT * FROM issues WHERE LOWER(department) = LOWER(?) ORDER BY severity DESC, createdAt ASC"
      )
      .all(department.trim());
  } else {
    rows = db
      .prepare("SELECT * FROM issues ORDER BY severity DESC, createdAt ASC")
      .all();
  }
  return rows.map(mapRowToIssue);
}

/**
 * Sets assignedOfficerId to officerId and updates status to 'acknowledged' if currently 'reported'.
 */
export function assignIssueToOfficer(issueId: string, officerId: string): CivicIssue | null {
  const existing = getIssueById(issueId);
  if (!existing) return null;

  const newStatus = existing.status === "reported" ? "acknowledged" : existing.status;

  db.prepare(`
    UPDATE issues
    SET assignedOfficerId = ?, status = ?
    WHERE id = ?
  `).run(officerId, newStatus, issueId);

  return getIssueById(issueId);
}

/**
 * Citizen verification function:
 * - If confirmed = true: status -> 'verified', verifiedAt -> now.
 * - If confirmed = false:
 *     - If reopenedCount >= 3: returns error with 409 status code.
 *     - Otherwise: status -> 'reopened', reopenedCount -> +1, assignedOfficerId -> NULL.
 */
export function verifyIssue(
  id: string,
  confirmed: boolean
): { success: true; issue: CivicIssue } | { success: false; error: string; statusCode: number } {
  const existing = getIssueById(id);
  if (!existing) {
    return { success: false, error: "Issue not found.", statusCode: 404 };
  }

  const now = new Date().toISOString();

  if (confirmed) {
    db.prepare(`
      UPDATE issues
      SET status = 'verified', verifiedAt = ?
      WHERE id = ?
    `).run(now, id);

    const updated = getIssueById(id);
    return { success: true, issue: updated! };
  } else {
    const currentReopenedCount = existing.reopenedCount ?? 0;
    if (currentReopenedCount >= 3) {
      return {
        success: false,
        error: "This issue has reached the maximum reopening limit (3 times). Please contact municipal support directly.",
        statusCode: 409,
      };
    }

    const newReopenedCount = currentReopenedCount + 1;
    db.prepare(`
      UPDATE issues
      SET status = 'reopened', reopenedCount = ?, assignedOfficerId = NULL
      WHERE id = ?
    `).run(newReopenedCount, id);

    const updated = getIssueById(id);
    return { success: true, issue: updated! };
  }
}

/**
 * Haversine distance calculation in meters between two lat/lng coordinates.
 */
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Queries the database for existing issues with the same issueType within
 * radiusMeters of the provided lat/lng.
 * Uses a bounding box pre-filter in SQLite, then computes exact Haversine distance.
 * Only checks issues with status NOT IN ('resolved', 'verified').
 * Returns matches sorted by distance ascending.
 */
export function findNearbyIssues(
  lat: number,
  lng: number,
  issueType: string,
  radiusMeters: number = 100
): CivicIssue[] {
  // Pre-filter bounding box calculation (1 deg lat ≈ 111,000m)
  const latDelta = radiusMeters / 111000;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const lngDelta = radiusMeters / (111000 * cosLat);

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const rows = db
    .prepare(
      `SELECT * FROM issues
       WHERE LOWER(issueType) = LOWER(?)
         AND status NOT IN ('resolved', 'verified')
         AND lat BETWEEN ? AND ?
         AND lng BETWEEN ? AND ?`
    )
    .all(issueType.trim(), minLat, maxLat, minLng, maxLng) as any[];

  const matchesWithDist = rows
    .map((row) => {
      const issue = mapRowToIssue(row);
      const distance = haversineDistanceMeters(lat, lng, issue.lat, issue.lng);
      return { issue, distance };
    })
    .filter((item) => item.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance);

  return matchesWithDist.map((item) => item.issue);
}

// ---------------------------------------------------------------------------
// Persistent Ward Health Operations
// ---------------------------------------------------------------------------

export function getBaselineScoreForWard(wardName: string): number {
  if (!wardName) return 85;
  const trimmed = wardName.trim();
  const foundKey = Object.keys(DEFAULT_BASELINE_SCORES).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (foundKey) return DEFAULT_BASELINE_SCORES[foundKey];
  return 85;
}

export function getAllWardHealthScores(): Record<string, number> {
  const rows = db.prepare("SELECT ward, healthScore FROM ward_health").all() as { ward: string; healthScore: number }[];
  const result: Record<string, number> = {};

  for (const row of rows) {
    result[row.ward] = row.healthScore;
  }

  // Ensure all baseline wards are present in result and in DB
  for (const [ward, baselineScore] of Object.entries(DEFAULT_BASELINE_SCORES)) {
    const existingKey = Object.keys(result).find((k) => k.toLowerCase() === ward.toLowerCase());
    if (!existingKey) {
      db.prepare(`
        INSERT INTO ward_health (ward, healthScore, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(ward) DO NOTHING
      `).run(ward, baselineScore, new Date().toISOString());
      result[ward] = baselineScore;
    }
  }

  return result;
}

export function getWardHealthScore(wardName: string): number {
  if (!wardName) return 85;
  const trimmed = wardName.trim();
  const row = db.prepare("SELECT healthScore FROM ward_health WHERE LOWER(ward) = LOWER(?)").get(trimmed) as { healthScore: number } | undefined;
  if (row !== undefined) {
    return row.healthScore;
  }

  const baseline = getBaselineScoreForWard(trimmed);
  db.prepare(`
    INSERT INTO ward_health (ward, healthScore, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(ward) DO UPDATE SET healthScore = excluded.healthScore
  `).run(trimmed, baseline, new Date().toISOString());

  return baseline;
}

export function applyWardHealthPenalty(
  wardName: string,
  penaltyAmount: number = 5,
  reason: string = "duplicate complaint"
): { ward: string; previousScore: number; newScore: number } {
  const trimmed = wardName ? wardName.trim() : "General Ward";
  const previousScore = getWardHealthScore(trimmed);
  const newScore = Math.max(0, previousScore - penaltyAmount);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ward_health (ward, healthScore, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(ward) DO UPDATE SET healthScore = ?, updatedAt = ?
  `).run(trimmed, newScore, now, newScore, now);

  // Requirement #5: Log statement whenever score is updated
  console.log(`[Ward Health Update] Ward: "${trimmed}", Previous Score: ${previousScore}, New Score: ${newScore}, Reason: "${reason}"`);

  return { ward: trimmed, previousScore, newScore };
}


