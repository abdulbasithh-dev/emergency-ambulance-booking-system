import os
import sys
from pathlib import Path

# Ensure backend directory is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure utf-8 on Windows terminal if supported
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import uvicorn

def main():
    banner = r"""
  ========================================================================
   ____            ___  
  |  _ \ ___  ___ / _ \   ResQ Emergency Dispatch & Fleet Tracking
  | |_) / _ \/ __| | | |  "Every Second Matters."
  |  _ <  __/\__ \ |_| |  100% Pure Python Full-Stack Platform
  |_| \_\___||___/\__\_\
  ========================================================================
  [+] ResQ Pure Python Server starting up...

  [*] Front Portal & SOS:        http://127.0.0.1:8000/
  [*] Citizen Emergency HUD:     http://127.0.0.1:8000/citizen
  [*] Ambulance Driver Cockpit:  http://127.0.0.1:8000/driver
  [*] Hospital ER Trauma Center: http://127.0.0.1:8000/hospital
  [*] Dispatcher Command Radar:  http://127.0.0.1:8000/dispatcher
  [*] System Administrator:      http://127.0.0.1:8000/admin
  [*] Interactive API Docs:       http://127.0.0.1:8000/docs
  ========================================================================
    """
    try:
        print(banner)
    except Exception:
        print("ResQ Server starting on http://127.0.0.1:8000")

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
