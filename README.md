# ResQ — Real-Time Emergency Ambulance Tracking & Dispatch Platform

> *"Every Second Matters."*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?logo=python)](https://www.sqlalchemy.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet)](https://leafletjs.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**ResQ** is a next-generation, production-grade Emergency Medical Dispatch (EMD) and fleet management platform. Built to bridge the critical communication gap between distressed citizens, ambulance crews, hospital trauma centers, and emergency dispatchers, ResQ optimizes every second from distress call to hospital ER handover.

---

## 🚀 Key Highlights & Capabilities

- 🚨 **Role-Based Access Control (RBAC)**: 5 tailored interfaces with dynamic role switching:
  1. **Citizen / Patient Attendant**: 1-click SOS distress call, live approaching ambulance map, dynamic ETA countdown, hospital recommendation selection.
  2. **Ambulance Driver HUD**: Mobile-first cockpit, incoming dispatch siren alert, mission stage step controls, and emergency hospital diversion requests.
  3. **Hospital ER Triage**: Live ICU bed & ventilator capacity editor, inbound ambulance tracking, and ER doctor assignments.
  4. **Emergency Dispatcher**: Command center tactical map, unassigned distress queue, manual vehicle override, and diversion request review.
  5. **System Administrator**: Real-time fleet utilization, hospital network capacity, response time KPIs, and searchable system audit logs.
- ⚡ **Multi-Factor Ambulance Matching Algorithm**: Computes Haversine distance, urban traffic clearing factors, and clinical equipment suitability scores (ALS vs BLS, ventilator, defibrillator).
- 🏥 **Clinical Capacity-Matched Hospital Recommendation**: Recommends trauma centers based on distance, travel time, available ICU beds, and ER department status.
- 📡 **Bi-Directional WebSockets**: Real-time GPS coordinates, mission state updates, and siren alerts pushed without polling.
- 🎮 **Automated 1-Click GPS Simulation Engine**: Generates live GPS waypoints progressing the ambulance across all 8 mission phases in real-time.

---

## 🏛️ System Architecture

```text
               +-------------------------------------------------------------+
               |                    React + Vite Frontend                    |
               | (LiveMap, Audio Siren, Stepper HUD, 1-Click Role Switcher) |
               +-------------------------------------------------------------+
                                       |                      ^
                                REST / JSON             WebSockets
                                       v                      |
               +-------------------------------------------------------------+
               |                  FastAPI Async Core Engine                  |
               |                                                             |
               |   [/api/v1/auth]          [/api/v1/dispatch]   [/ws/driver] |
               |   [/api/v1/emergencies]   [/api/v1/simulation] [/ws/user]   |
               |   [/api/v1/ambulances]    [/api/v1/hospitals]  [/ws/hosp]   |
               +-------------------------------------------------------------+
                                       |                      |
                    +------------------+                      v
                    v                               +--------------------+
         +--------------------+                     | Connection Manager |
         | Matching & Scoring |                     | (Multi-room PubSub)|
         |  - Haversine + ETA |                     +--------------------+
         |  - Equipment Match |
         |  - Bed Allocator   |
         +--------------------+
                    |
                    v
         +--------------------+
         | SQLAlchemy 2.0 ORM |
         | (SQLite / Postgre) |
         +--------------------+
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 + Vite |
| **Styling & Aesthetics** | Pure Vanilla CSS Design System (Emergency Dark Palette, Glassmorphism, Micro-Animations) |
| **Mapping & GIS** | Leaflet + React-Leaflet with custom vector SVG DivIcons and animated route polylines |
| **Icons & Alerts** | Lucide React |
| **Backend API** | FastAPI (Python 3.12, AsyncIO, Lifespan Events) |
| **Database ORM** | SQLAlchemy 2.0 with `aiosqlite` (default) & `asyncpg` (PostgreSQL ready) |
| **Authentication** | Passlib (Bcrypt) + Python-Jose (JWT Access & Refresh Tokens) |
| **Real-Time Layer** | Native ASGI WebSockets with custom multi-room room manager |
| **Testing** | Pytest + Pytest-AsyncIO + HTTPX ASGI TestClient |
| **Containerization** | Docker + Docker Compose + Nginx Alpine |

---

### ⚡ Quickstart: 100% Pure Python Full-Stack (Recommended)

Run the entire platform natively in Python with zero Node.js/npm dependencies:

```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Run the platform
python run.py
```

- **Web Application & Dashboards**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### Option 2: Full-Stack with React Frontend (Legacy / Alternative)

If you prefer to run the separated React 18 frontend:

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2: React Frontend
cd frontend
npm install
npm run dev
```
- React Frontend: [http://localhost:5173](http://localhost:5173)

---

### Option 2: Docker Compose

To launch the complete containerized stack:
```bash
docker compose up --build
```
- Frontend UI: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🔑 Pre-Seeded Demo Credentials

Use the floating **Demo Switcher Bar** at the top of the interface for instantaneous 1-click role swapping, or log in manually with:

| Role | Email | Password | Assigned Resource |
|---|---|---|---|
| **Citizen (User)** | `citizen@resq.org` | `demo1234` | Patient Account |
| **Ambulance Driver** | `driver@resq.org` | `demo1234` | Ambulance `TN-01-EM-1001` (ALS) |
| **Hospital Staff** | `apollo@resq.org` | `demo1234` | Apollo Hospitals Greams Road (ER) |
| **Emergency Dispatcher** | `dispatcher@resq.org` | `demo1234` | Central Command Center |
| **System Admin** | `admin@resq.org` | `demo1234` | Platform Operations |

---

## 🎬 1-Click Live Simulation Walkthrough

ResQ includes an autonomous simulation engine that demonstrates the full platform capability without requiring manual input:

1. Click the **"▶ 1-Click Live Simulation"** button in the top navigation bar.
2. An emergency case (`CARDIAC_ARREST`) is automatically triggered at *T. Nagar, Chennai*.
3. The multi-factor algorithm matches and dispatches the closest Advanced Life Support ambulance (`TN-01-EM-1001`).
4. Watch the ambulance move in real-time across the Leaflet map:
   - `AMBULANCE_EN_ROUTE`: Navigates to patient pickup location with dynamic ETA updates.
   - `ARRIVED_AT_SCENE`: On-scene patient loading.
   - `IN_TRANSIT_TO_HOSPITAL`: Transits towards *Apollo Hospitals Greams Road*.
   - `ARRIVED_AT_HOSPITAL` & `HANDOVER_COMPLETE`: Completes triage and hospital handover.
5. Switch between roles at any time during the simulation to view the live synchrony across all 5 dashboards!

---

## 🧪 Running Automated Tests

Run the backend asynchronous test suite:
```bash
cd backend
python -m pytest tests -v
```
All tests validate:
- User registration, login, and demo authentication.
- Full end-to-end emergency state machine progression and RBAC verification.
- Haversine distance accuracy and urban traffic ETA calculation.
- Equipment suitability matching for cardiac, respiratory, and trauma emergencies.

---

## 📄 License
This project is licensed under the MIT License.
