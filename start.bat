@echo off
TITLE Lithium - Autonomous Operations Platform
echo ===================================================================
echo  LITHIUM -- AUTONOMOUS OPERATIONS PLATFORM LAUNCH SYSTEM
echo ===================================================================
echo.
echo [1/3] Initializing SQLite 3 WAL Database...
python -c "import sys; sys.path.insert(0, 'backend'); import db; db.init_db(); print(' -> SQLite 3 WAL Database initialized at backend/lithium.db')"

echo.
echo [2/3] Launching FastAPI Backend Engine on http://localhost:8000...
start "Lithium - FastAPI Backend (Port 8000)" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

echo.
echo [3/3] Launching Frontend Server on http://localhost:3000...
start "Lithium - Frontend Server (Port 3000)" cmd /k "cd frontend && python server.py"

echo.
echo ===================================================================
echo  System Active and Connected:
echo   - Backend API:    http://localhost:8000
echo   - API Swagger UI: http://localhost:8000/docs
echo   - Dashboard UI:   http://localhost:3000
echo ===================================================================
echo.
pause
