<div align="center">

# 🏛️ CivicLens 

### AI-Powered Transparent Civic Governance Platform

Transforming civic complaint management through **Google Gemini AI**, intelligent prioritization, citizen verification, and real-time governance analytics.

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production%20Prototype-success?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Built%20With-Google%20Gemini-4285F4?style=for-the-badge&logo=google" alt="Gemini">
  <img src="https://img.shields.io/badge/Stack-React%2019%20·%20Express%20·%20SQLite-0F172A?style=for-the-badge" alt="Stack">
  <img src="https://img.shields.io/badge/PWA-Installable-purple?style=for-the-badge" alt="PWA">
</p>

**🚀 Built for Hack Devengers 2.0**

🌐 **Live Demo:** https://civiclens.ai.studio/

📦 **Repository:** https://github.com/anushka12060/CivicLens


</div>

---

# 📖 Overview

CivicLens is an AI-powered civic issue reporting platform that modernizes how citizens and municipal authorities collaborate to resolve public infrastructure problems.

Instead of relying on manual complaint categorization and opaque workflows, CivicLens leverages **Google Gemini AI** to analyze uploaded images, classify issues, estimate severity, detect duplicate complaints, and assist authorities in prioritizing resolutions.

Unlike traditional complaint portals, CivicLens introduces a **closed-loop governance model**, where citizens verify completed work before complaints are officially resolved, ensuring accountability and transparency throughout the lifecycle.

### Core Workflow

```
Citizen Reports Issue
        ↓
Google Gemini AI Analysis
        ↓
Smart Priority Assignment
        ↓
Officer Resolution
        ↓
Citizen Verification
```

---

# ✨ Key Features

## 📷 AI Image-Based Complaint Reporting

Report civic issues by uploading a photo along with GPS location.

The platform automatically:

- Detects issue category
- Estimates severity (1–10)
- Suggests responsible department
- Returns confidence score and reasoning

---

## 🤖 Google Gemini AI Integration

Powered by **Google Gemini**.

The AI pipeline performs:

- Vision Analysis
- Issue Classification
- Severity Assessment
- Resolution Recommendation

If Gemini is unavailable, CivicLens automatically falls back to keyword-based heuristics so the platform continues functioning.

---

## 📍 Smart Duplicate Detection

Nearby duplicate complaints are automatically identified using spatial matching.

Instead of creating duplicate tickets:

- Existing complaints gain visibility
- Report count increases
- Ward Health Index updates
- Authorities receive one consolidated complaint

---

## 🎯 Intelligent Priority Queue

Complaints are ranked using a transparent scoring formula.

```text
Priority Score = (Severity × Report Count)
/ max(Days Open, 1)
```

Higher severity and multiple reports increase priority while older unresolved complaints continue moving upward.

---

## 👮 Officer Operations Console

Municipal officers can:

- View assigned complaints
- Filter by department
- Update complaint status
- Upload proof of completion
- Track complaint lifecycle

---

## ✅ Citizen Verification

Complaints are **not automatically closed**.

Citizens verify completed work before closure.

If work is unsatisfactory:

- Complaint is reopened
- Officer is notified
- Resolution process continues

Citizens also earn civic participation points after successful verification.

---

## 📊 Ward Health Index

Each ward receives a live civic health score.

```text
Ward Health =
100 − (Issue Count × 6)
− Round(Average Severity × 4)
```

Duplicate reports apply additional penalties, allowing administrators to identify deteriorating regions immediately.

---

## 📈 Transparency Dashboard

Real-time public analytics include:

- Ward Performance
- Department Performance
- Complaint Trends
- Resolution Rate
- Active Issues
- Citizen Participation

---
# 🎯 Why CivicLens?

| Traditional Complaint Portals | CivicLens |
|-------------------------------|-----------|
| Manual complaint entry | AI-powered image reporting |
| Manual categorization | Automatic issue detection |
| First Come, First Serve | AI-based priority assignment |
| Complaint closed by department | Citizen verifies completion |
| Limited transparency | Live governance dashboards |
| Duplicate complaints create clutter | Smart duplicate detection |

---

# 🏗️ System Architecture

```text
                    Citizen / Officer
                    (React 19 + PWA)
                           │
                           ▼
                  Express.js REST API
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
 Google Gemini AI                    SQLite Database
 ├── Vision Analysis                 ├── Issues
 ├── Classification                  ├── Officers
 ├── Severity Detection              ├── Citizens
 ├── Resolution Suggestions          ├── Ward Health
 └── Duplicate Assistance      
                           │
                           ▼
                 Business Logic Layer
          ├── Duplicate Detection
          ├── Priority Engine
          ├── Officer Assignment
          ├── Complaint Lifecycle
          └── Ward Health Calculation
                           │
                           ▼
        Officer Dashboard → Citizen Verification
                           │
                           ▼
                 Transparency Dashboard
```

---

# ⚙️ Technology Stack

## 🎨 Frontend

| Technology | Purpose |
|------------|---------|
| React 19 | User Interface |
| Vite 6 | Build Tool |
| TypeScript | Type Safety |
| Tailwind CSS 4 | Styling |
| Progressive Web App | Installable Experience |

---

## ⚡ Backend

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express.js | REST API |
| JWT | Authentication |
| bcryptjs | Password Hashing |

---

## 🤖 Artificial Intelligence

- Google Gemini API
- Google AI Studio
- Vision Analysis
- Issue Classification
- Severity Estimation
- Resolution Suggestions

---

## 🗄️ Database

- SQLite
- better-sqlite3
- WAL Mode
- Automatic Database Seeding

---

## 🗺️ Maps & Location

- Leaflet
- OpenStreetMap
- Browser Geolocation API

---

## ☁️ Deployment

- Google Cloud Run
- Google AI Studio
- Progressive Web App

---

# 📂 Project Structure

```text
CivicLens/
├── server/
│   └── db/
│       ├── index.ts
│       └── schema.sql
├── src/
│   ├── components/
│   ├── assets/
│   ├── App.tsx
│   ├── Landing.tsx
│   ├── types.ts
│   ├── data.ts
│   ├── index.css
│   └── main.tsx
├── public/
├── server.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/anushka12060/CivicLens.git

cd CivicLens
```

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment

Create a file named

```
.env
```

Add

```env
GEMINI_API_KEY=YOUR_API_KEY

JWT_SECRET=YOUR_SECRET

```

---

## Run Development Server

```bash
npm run dev
```

Application will start at

```
http://localhost:3000
```

---

## Production Build

```bash
npm run build

npm start
```

On first launch, the application automatically creates and seeds the SQLite database with demo officers, complaints, citizens, and ward health records.

---
# 🔄 Complaint Workflow

```text
Citizen Reports Issue
        │
        ▼
Upload Image + GPS Location
        │
        ▼
Google Gemini AI Analysis
        │
        ├── Vision Analysis
        ├── Issue Classification
        ├── Severity Detection
        └── Resolution Recommendation
        │
        ▼
Duplicate Detection
        │
        ▼
Priority Score Calculation
        │
        ▼
Complaint Assigned to Officer
        │
        ▼
Officer Updates Status
        │
        ▼
Proof of Completion Uploaded
        │
        ▼
Citizen Verification
        │
        ├── Verified ✅
        │        │
        │        ▼
        │   Complaint Closed
        │
        └── Reopened ❌
                 │
                 ▼
          Officer Notified Again
        │
        ▼
Ward Health Index Updated
```

---

## 📌 Complaint Lifecycle

```text
Reported
    ↓
Acknowledged
    ↓
In Progress
    ↓
Resolved
    ↓
Citizen Verification
    ↓
Verified / Reopened
```

---

# 🗄️ Database Schema

The application uses **SQLite** in **WAL (Write-Ahead Logging)** mode for improved performance and concurrent reads.

### Core Tables

### 📝 Issues
Stores civic complaints and AI enrichment fields:

- `id`, `title`, `description`, `ward`
- `lat`, `lng`, `imageUrl`
- `issueType`, `severity` (1–10), `affectedRadius`, `department`
- `confidence`, `reasoning`
- `reportCount`, `createdAt`
- `isDemo`, `isValid`, `quickDetails`
- `status` (`reported` | `acknowledged` | `in_progress` | `resolved` | `verified` | `reopened`)
- `assignedOfficerId`, `officerNotes`, `resolvedAt`, `verifiedAt`
- `reopenedCount`, `reportedByCitizenId`

> Priority score is **computed** at runtime: `(severity × reportCount) / max(daysOpen, 1)` — not stored as a column.

---

### 👤 Citizens
Stores registered citizens:

- `id`, `name`, `email` (unique)
- `passwordHash`
- `civicPoints`
- `createdAt`

---

### 👮 Officers
Stores municipal officers:

- `id`, `name`, `department`
- `email` (unique)
- `passwordHash`

---

### 📊 Ward Health
Stores persistent ward scores:

- `ward` (primary key)
- `healthScore`
- `updatedAt`

> Issue counts and average severity used in the live score formula are computed from the issues list, not stored on this table.
# 🔐 Demo Credentials

### Officer Login

Password for every officer

```text
password123
```

| Department | Email |
|------------|-------------------------------|
| Road Infrastructure | roads.officer@civiclens.gov.in |
| Water & Drainage | water.officer@civiclens.gov.in |
| Solid Waste | waste.officer@civiclens.gov.in |
| Electrical Division | power.officer@civiclens.gov.in |
| Ward Enforcement | enforcement.officer@civiclens.gov.in |

Citizens can register directly from the application.

---


# 🎥 Demo

## 🌐 Live Application

https://civiclens.ai.studio/

---

# 🌍 Real-World Impact

CivicLens helps municipalities by

✅ Reducing complaint processing time

✅ Eliminating duplicate complaints

✅ Increasing citizen trust

✅ Improving accountability

✅ Prioritizing critical civic issues

✅ Enabling data-driven governance

✅ Tracking department performance

✅ Monitoring ward-wise civic health

---

# 📈 Performance Highlights

- AI-powered complaint categorization
- Real-time duplicate detection
- Transparent complaint lifecycle
- Live Ward Health Index
- Department-specific officer workflow
- Installable Progressive Web App
- Responsive across desktop and mobile

---
# 🚧 Future Roadmap

CivicLens has been designed with scalability in mind. Future enhancements include:

### 🌐 Platform Expansion

- Multi-city deployment
- State-level civic governance support
- CPGRAMS integration
- Smart City Mission integration

---

### 📱 Mobile Experience

- Native Android application
- Native iOS application
- Offline complaint submission
- Camera-first reporting

---

### 🔔 Smart Notifications

- Push notifications
- SMS alerts
- WhatsApp integration
- Email updates

---

### 🤖 AI Enhancements

- Predictive civic analytics
- Automatic issue clustering
- AI-generated maintenance reports
- Infrastructure deterioration prediction

---

### ☁️ Cloud Infrastructure

- PostgreSQL migration
- Google Cloud SQL
- Cloud Storage for images
- Cloud CDN
- Auto Scaling

---

### 🌎 Accessibility

- Multi-language support
- Voice-assisted complaint filing
- Screen reader compatibility
- Accessibility improvements (WCAG)

---

# 📊 Project Highlights

| Feature | Status |
|---------|--------|
| AI Image Analysis | ✅ |
| Leaflet + OpenStreetMap | ✅ |
| Duplicate Detection | ✅ |
| Officer Dashboard | ✅ |
| Citizen Verification | ✅ |
| Ward Health Index | ✅ |
| Transparency Dashboard | ✅ |
| Progressive Web App | ✅ |
| Responsive Design | ✅ |

---

# 🤝 Contributing

Contributions are welcome!

If you'd like to improve CivicLens:

### 1️⃣ Fork the repository

```bash
git clone https://github.com/anushka12060/CivicLens.git
```

### 2️⃣ Create a new branch

```bash
git checkout -b feature/amazing-feature
```

### 3️⃣ Commit your changes

```bash
git commit -m "Add amazing feature"
```

### 4️⃣ Push your branch

```bash
git push origin feature/amazing-feature
```

### 5️⃣ Open a Pull Request

Every contribution is appreciated.

---

# 🛠 Troubleshooting

### Gemini API not responding

- Verify your `GEMINI_API_KEY`
- Check API quota
- Ensure internet connectivity

---

### Maps not loading
- Ensure internet access (OSM tiles load from the network)
- Confirm Leaflet CSS/JS are loaded from `index.html`
- Check the browser console for blocked scripts

---

### SQLite database missing

Simply restart the server.

The application automatically creates and seeds the database during first launch.

---



## Developed for
Hack Devengers 2.0



---

## Built With ❤️ Using

- React 19
- Vite
- TypeScript
- Express.js
- SQLite
- Google Gemini AI
- Google AI Studio
- Tailwind CSS

---

# 🌟 Acknowledgements

Special thanks to:

- Google AI Studio
- Google Gemini API
- React Team
- Vite Team
- OpenStreetMap Community

---

<div align="center">

# ⭐ If you found this project interesting, consider giving it a Star!

It motivates us to continue building impactful AI-powered civic technology.

<br>

### 🏛️ CivicLens

**AI-Powered Transparent Civic Governance**

*Transforming civic complaints into transparent, citizen-verified governance.*

---

</div>
