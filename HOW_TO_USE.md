# ResQ Emergency Dispatch Platform — Complete User Guide

Welcome to **ResQ**! This guide walks you through every feature of the platform, how each role works, and how to test the entire emergency response lifecycle in seconds.

---

## 🚀 Quick Start: The 1-Click Live Simulation

The easiest and fastest way to experience ResQ is the **1-Click Live Simulation**:

1. Look at the top navigation bar (Demo Switcher).
2. Click the bright green button: **▶ 1-Click Live Simulation**.
3. **Watch the live lifecycle unfold**:
   - A realistic emergency incident (e.g., *Cardiac Emergency at OMR Tech Park*) is automatically generated.
   - The AI dispatch engine selects the nearest Advanced Life Support (ALS) ICU ambulance (`TN-09-EM-1001`).
   - The driver accepts the call.
   - You are immediately transitioned to the **Citizen Live Tracking HUD**, where you can watch the ambulance drive live across the Chennai map with real-time turn-by-turn simulation and 8-stage progress updates!

---

## 👥 Navigating the 5 Platform Roles

Use the top **Demo Switcher Bar** to toggle between roles at any time without logging in and out:

| Role | Route | Key Functions |
|---|---|---|
| **Citizen / Patient** | `/citizen` or `/` | Book emergency ambulance, live GPS tracking, 8-stage progress HUD, hospital triage |
| **Dispatcher** | `/dispatcher` | Emergency Command Center, live radar map, manual unit assignment, hospital rerouting |
| **Driver** | `/driver` | Mobile-first HUD, shift toggle (On/Off Duty), accept dispatches, advance trip stages |
| **Hospital ER** | `/hospital` | Inbound trauma alerts, real-time ICU/ER bed capacity management, doctor handover |
| **Admin** | `/admin` | System health matrix, fleet readiness stats, telemetry logs, response time analytics |

---

## 🚑 Step-by-Step Walkthrough by Role

### 1. Citizen Interface (`/citizen`)
**Goal**: Request emergency assistance and track arrival.
- **Requesting an Ambulance**:
  1. Click **Request Emergency Ambulance**.
  2. Select emergency type (Cardiac, Trauma/Accident, Respiratory, etc.) and severity (Critical, Serious, Moderate).
  3. Enter pickup location and contact number, then click **Dispatch Ambulance Now**.
- **Tracking Your Ambulance**:
  - Watch the **8-Stage Progress Tracker** move from *Triage Pending* → *Ambulance Assigned* → *En Route to You* → *On Scene* → *Hospital Transit* → *Handover Complete*.
  - Track the ambulance marker moving in real-time along the route on the interactive dark map.
  - View assigned paramedic details, ambulance registration, and onboard equipment (Ventilator, Defibrillator, ECG).

---

### 2. Dispatcher Command Center (`/dispatcher`)
**Goal**: Monitor city-wide emergencies and control ambulance units.
- **Triage Queue**: View incoming pending emergency calls on the left panel.
- **Live Beacon Tactical View**:
  - Ambulances are color-coded (Green = Available, Amber = Dispatched / On Mission).
  - Patient SOS beacons pulse red.
  - Hospitals are marked with blue medical crosses.
- **Mission Dispatch Controls**:
  - Click on any active incident or pending call to inspect it.
  - Select an available ambulance from the dropdown and click **Assign** to manually route the nearest unit.
  - Override the destination hospital if the primary hospital ER is full.

---

### 3. Ambulance Driver HUD (`/driver`)
**Goal**: Receive dispatch missions and report mission progression.
- **Duty Toggle**: Switch between **On Duty** (available for calls) and **Off Duty** (maintenance/break).
- **Mission Card**: When a call is assigned, an emergency banner appears with patient details, chief complaint, and pickup GPS.
- **Trip Progression Buttons**: Click the active action button to advance the mission:
  1. **Accept Call** → Confirms driver is responding.
  2. **Arrived at Scene** → Notifies citizen the unit is outside.
  3. **Patient Loaded & En Route** → Starts transit to the hospital.
  4. **Arrived at Hospital ER** → Commences trauma handover.
  5. **Complete Handover** → Frees ambulance back to `AVAILABLE` status.

---

### 4. Hospital ER Dashboard (`/hospital`)
**Goal**: Prepare trauma bays before the ambulance arrives.
- **Inbound Patient Stream**: View ambulances inbound to your emergency room with estimated arrival times (ETA).
- **Bed & Resource Management**:
  - Live toggles for **ICU Beds**, **Emergency Trauma Bays**, and **General Beds**.
  - Update availability to automatically notify the AI dispatch engine if your ER reaches full diversion.

---

### 5. Admin & Analytics (`/admin`)
**Goal**: High-level platform monitoring and audit logs.
- **Key Metrics**: City-wide fleet readiness, active mission counts, average response time, and live WebSocket connection indicators.
- **Fleet Roster**: Inspect all registered ambulances, fuel levels, vehicle types, and driver assignments.
