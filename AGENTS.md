# AGENTS.md for Smart Air Quality Mapper App

Welcome to the **Smart Air Quality Mapper** project (`App/`), part of the BEP Software workspace.

This application pairs a Python/Flask backend (`server.py`) with a modern, responsive HTML5/CSS3/JavaScript frontend, structured and guided by the architectural principles and skills of the **WebJs** framework (`webjsdev/webjs` by Vivek).

---

## 1. System Architecture

### Backend (`server.py`)
- **Runtime**: Python 3 / Flask
- **Database**: SQLite (`air_quality.db`)
- **Data Model** (`readings` table):
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `node_id`: TEXT (Sensor Node ID, e.g., ESP32 node identifier)
  - `lat`: REAL (Latitude coordinate)
  - `lng`: REAL (Longitude coordinate)
  - `pm25`: INTEGER (PM2.5 particulate matter in ug/m³)
  - `pm10`: INTEGER (PM10 particulate matter in ug/m³)
  - `aqi`: INTEGER (Air Quality Index calculated score)
  - `temp`: REAL (Temperature in °C)
  - `humidity`: REAL (Relative Humidity in %)
  - `timestamp`: DATETIME (Timestamp of reading)
- **Current Endpoints**:
  - `POST /api/readings`: Receives telemetry JSON payload from ESP32 nodes / field devices.
  - `GET /api/readings`: Returns the 50 most recent readings as JSON for telemetry and mapping.
- **Planned Upgrades**:
  - Frontend static file serving (`/` and static assets).
  - CORS support for cross-origin local testing.
  - Interactive endpoints (e.g., node configuration, data filtering, and user alerts/POST requests from frontend).

### Frontend (`App/` static & component structure)
- **Core Stack**: HTML5, CSS3, modern Vanilla JavaScript (ES Modules / Web Components).
- **Design Principles (guided by WebJs)**:
  - **Zero Build Step**: Native browser execution without bundler overhead.
  - **Component-Driven**: Self-contained, modular UI components (e.g., `<aqi-badge>`, `<sensor-card>`, `<telemetry-table>`, `<map-view>`).
  - **Token-Based Styling**: CSS variables (`--color-bg`, `--color-surface`, `--color-aqi-good`, etc.) with `light-dark()` or class-based theme switching.
  - **Progressive Enhancement**: Clean fallback states when loading or disconnected.
  - **Interactive Visuals**: Geographic map plotting sensor nodes with color-coded AQI pins, live telemetry cards, and auto-refresh/polling.

---

## 2. WebJs Integration & Skill Guidelines

The `webjs` framework located in the sibling folder `../webjs` provides comprehensive skills and architectural references:
- **Master Reference**: `.agents/skills/webjs/SKILL.md`
- **Reference Manuals**: `.agents/skills/webjs/references/`:
  - `components.md` — Component lifecycle, reactive properties, and custom element design.
  - `styling.md` — Design tokens, responsive layouts, and zero-reflow UI.
  - `optimistic-ui.md` — Instant user feedback patterns.
  - `data-and-actions.md` — Clean query/mutation separation.
- **Workflow Rules**: `.agents/rules/workflow.md`:
  - Commit per logical unit with clear, descriptive commit messages.
  - Concise, focused development.
  - Invariants: keep clean separation between UI presentation, data-fetching, and backend state.

---

## 3. Development Workflow for the App

1. **Backend Verification**: Ensure `server.py` is operational and database tables are initialized.
2. **Frontend Construction**:
   - `index.html`: Clean, semantic root layout.
   - `styles/`: Token-based modular styling.
   - `js/`: Modular ES modules and components for data fetching, map rendering, and dashboard metrics.
3. **API Integration**: Connect frontend fetchers to `GET /api/readings` and implement live polling or event triggers.
4. **Testing**: Validate with simulated ESP32 POST payloads and verify real-time dashboard updates.
