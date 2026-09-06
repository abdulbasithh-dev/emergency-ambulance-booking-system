import os
import sys
from pathlib import Path
import importlib.util

# Add backend directory to sys.path
root_dir = Path(__file__).resolve().parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.chdir(str(backend_dir))

def main():
    backend_run_path = backend_dir / "run.py"
    spec = importlib.util.spec_from_file_location("backend_entry", backend_run_path)
    backend_entry = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backend_entry)
    backend_entry.main()

if __name__ == "__main__":
    main()

