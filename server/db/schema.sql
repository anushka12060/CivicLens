-- CivicLens SQLite Database Schema
-- Table: issues

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
  reopenedCount INTEGER NOT NULL DEFAULT 0,
  reportedByCitizenId TEXT
);

-- Table: officers
CREATE TABLE IF NOT EXISTS officers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL
);

-- Table: citizens
CREATE TABLE IF NOT EXISTS citizens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  civicPoints INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

-- Table: ward_health
CREATE TABLE IF NOT EXISTS ward_health (
  ward TEXT PRIMARY KEY,
  healthScore INTEGER NOT NULL,
  updatedAt TEXT NOT NULL
);


