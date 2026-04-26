# DailyTracker — Product Requirements Document

## Overview

DailyTracker is a personal health and habit tracking app. Users define their own metrics (weight, pain level, sleep, exercise, etc.) and log values on a flexible schedule — either through a guided daily check-in or ad hoc as events occur. A web interface provides graphing and trend analysis; a mobile app (iOS + Android) handles quick data entry.

**Core differentiators vs. existing apps (Bearable, Daylio, Exist.io):**
- Web + mobile together (most competitors are mobile-only)
- Numeric and qualitative metrics in one app
- Multi-metric correlation graphs
- Connector framework for external data sources (future)
- LLM-powered data Q&A (future)

---

## Users & Authentication

- Multi-user: each user has their own account and data
- Auth: email/password to start; OAuth (Sign in with Apple, Google) deferred
- JWT-based sessions

---

## Metrics

### Metric definitions
Each user defines their own metrics. A metric has:
- **Name** — e.g. "Weight", "Pain Level", "Morning Run"
- **Type** — one of: `number`, `scale` (1–10), `boolean`, `duration`, `categorical`, `text`
- **Unit** — optional label, e.g. "lbs", "hours", "km"
- **Color** — for graph display
- **Allow multiple entries per day** — per-metric boolean; e.g. weight = false, workouts = true
- **Order** — display order in check-in flow
- **Archived** — soft-delete; history is always preserved, metric is hidden from active UI

### Starter templates
New users are seeded with a default set of metrics to reduce blank-slate friction:
- Weight (number, lbs)
- Sleep (number, hours)
- Mood (scale 1–10)
- Pain Level (scale 1–10)
- Exercise (boolean)

Users can edit, delete, or add to these immediately.

### Connectors (future)
Metrics will eventually support an external data source (Apple Health, Fitbit, etc.) via a connector framework. The data model includes `connector_id` and `source` fields from day one to avoid a retrofit.

---

## Logging

### Ad-hoc logging
Users can log any metric at any time. Entries store a full timestamp (date + time-of-day). Users can backdate entries to any previous day.

### Daily check-in flow
A guided screen that shows all active metrics not yet logged today (respecting the "allow multiple per day" setting). Users work through them in order and submit in one action. This is the primary mobile UX.

### Entry data
Each entry stores:
- Reference to metric definition
- `numeric_value` and/or `text_value` (depending on metric type)
- Full timestamp
- Source: `manual` | `connector`
- Optional `connector_ref` (external ID, for deduplication)

---

## Graphs & Analytics

### Per-metric time-series
Line or bar chart for any metric over a selected date range, with 7-day and 30-day rolling averages.

### Multi-metric correlation view
Overlay two or more metrics on the same timeline to visually explore relationships (e.g. sleep hours vs. pain level). In scope for v1.

### Streak tracking
For boolean metrics, show current and longest streak.

### Date range filtering
All graph views support flexible date range selection.

---

## LLM Chat (future)

A `POST /api/v1/chat` endpoint will let users ask ad hoc questions about their data:
> "Why might my pain be higher this week?"
> "How does my sleep correlate with my mood?"

**Constraints:**
- Read-only: the LLM cannot create or modify entries
- Server-side only: API keys never sent to clients
- Model choice is deferred until core features are built
- The LLM provider will be hidden behind an interface so the model can be swapped via config

---

## Notifications (future)

Push notifications to remind users to complete their daily check-in at a user-configured time. In scope for a later release.

---

## Data Portability

- CSV export of all entries (free feature — important trust signal)
- Doctor-shareable timeline report (future)

---

## Feature Scope

### v1
- [ ] User accounts (email/password, JWT, multi-user)
- [ ] Metric definitions: create, edit, archive, reorder
- [ ] Starter metric templates for new users
- [ ] Ad-hoc entry logging with full timestamp + backdating
- [ ] Daily check-in flow
- [ ] Per-metric time-series graphs
- [ ] Multi-metric correlation view
- [ ] CSV export

### Later
- [ ] Push notifications / daily reminders
- [ ] Connector framework (Apple Health, Fitbit, etc.)
- [ ] LLM chat for data Q&A
- [ ] OAuth (Sign in with Apple / Google)
- [ ] Doctor-shareable PDF report
- [ ] Streak tracking for boolean metrics
- [ ] Rolling average overlays on graphs
