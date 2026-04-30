# DailyTracker — Product Requirements Document

## Overview

DailyTracker is a personal health and habit tracking app. Users define their own metrics (weight, pain level, sleep, exercise, etc.) and log values on a flexible schedule — either through a guided daily check-in or ad hoc as events occur. Both the web app and the mobile app (iOS + Android) are first-class clients: each supports full data entry, editing, and review. The web app additionally provides richer graphing and trend analysis; mobile is optimized for quick capture on the go.

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
- **Type** — one of: `number`, `scale` (1–10), `boolean`, `duration`, `categorical`, `text`. Booleans are always treated as tags in data entry (see *Tags* below); a metric that genuinely needs a single fixed yes/no prompt is just a one-tag tag-set.
- **Unit** — optional label, e.g. "lbs", "hours", "km"
- **Color** — for graph display
- **Allow multiple entries per day** — per-metric boolean; e.g. weight = false, workouts = true
- **Order** — display order in check-in flow
- **Archived** — soft-delete; history is always preserved, metric is hidden from active UI

### Tags (boolean metrics)
Every boolean metric is treated as a **tag**. The motivating case is sparse facts — "Sauna", "Headache", "Travel", "Migraine" — where the user only logs the days the thing happened and there's a long tail of them, but the same UX works fine for non-sparse booleans too (a yes/no like "Exercised today" is just a one-tag set the user either picks or skips). Many-valued `categorical` metrics are not tags; they retain a dedicated single-select control.

- **Storage.** Each tag is its own `metric_definition` (type `boolean`) and an entry exists for a given day only when the tag applied. This preserves per-tag history, graphing, and correlation. No `is_tag` column is needed — type `boolean` *is* the tag flag.
- **Data entry UX.** Both web and mobile collapse all of a user's boolean metrics into a single multi-select picker (one chip per tag, plus a quick "add new tag" affordance). The user picks the tags that apply for the day and submits — they are not asked one-by-one.
- **API / CSV.** Tag entries are exposed both as individual metrics (one column per tag, for graphing and correlation) and as a per-day tag list (for compact data entry, transfer, and the daily check-in payload).

### Duration input format
Duration metrics accept human-friendly input rather than forcing the user into decimal numbers. The parser treats colon shorthand as right-aligned starting at seconds: two parts is `M:S`, three parts is `H:M:S`. Unit-bearing input (`Xh Ym Zs`) is always unambiguous.

Examples:
- `5h 12m` / `5h 12 mins` / `5 hours 12 minutes` → 5 hours 12 minutes
- `5:12:00` → 5 hours 12 minutes
- `5:12` → **5 minutes 12 seconds** (not 5h 12m — use the three-part form or `Xh Ym` for hours)
- `5m 30s` or `5:30` → 5 minutes 30 seconds (= 5.5 minutes)
- `45m`, `0:45` → sub-minute / sub-hour durations
- `90s` or `0:00:90` → 90 seconds; bare numbers like `5.2` are also accepted as the metric's natural unit

Internally durations are stored as a single numeric value in `numeric_value`. The canonical stored unit is **seconds** (so sub-minute precision is always preserved); the metric's `unit` ("hours", "minutes", "seconds") drives default display formatting (`5h 12m`, `5m 30s`, etc.).

### Default values for data entry
Each metric can carry a **default value** that pre-fills the daily check-in to reduce friction for routine tracking — e.g. "30 minutes on the treadmill" pre-filled for a daily-runner's `Treadmill` metric, or `Vitamin D` tag pre-checked for someone who takes one every morning. Defaults apply to the daily check-in only; ad-hoc logging starts blank.

- **Numeric / scale / duration:** a numeric default that pre-fills the input. The user can edit or clear it before submitting.
- **Categorical / text:** a default selection or text fragment.
- **Boolean (tag):** "default on" — the tag chip is pre-selected in the tag picker. The user can deselect it for days the thing didn't happen. This keeps the tag-set UX consistent: routine tags appear pre-selected, sparse tags do not.

A pre-filled default is just a starting value — the entry is only created when the user submits the check-in. Skipping the check-in for a day does *not* auto-log defaults.

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
A guided screen that shows all active metrics not yet logged today (respecting the "allow multiple per day" setting). Users work through them in order and submit in one action. The flow is available on both web and mobile; mobile is optimized for one-thumb entry, web for keyboard entry and bulk edits across multiple days.

All boolean metrics collapse into a single tag-picker step within this flow rather than appearing as one row each.

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
- [ ] Daily check-in flow (web + mobile)
- [ ] Web data entry parity (create / edit / delete entries from the web app)
- [ ] Tag UX over boolean metrics (multi-select picker; per-tag storage preserved; no schema flag)
- [ ] Human-friendly duration input (`5h 12m`, `5:12` = 5m 12s, `5:12:0` = 5h 12m; stored as seconds)
- [ ] Per-metric default values for daily check-in (numeric default, "default-on" tags)
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
