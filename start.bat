@echo off
TITLE Lithium - Autonomous Operations Platform
echo ===================================================================
echo  LITHIUM -- AUTONOMOUS OPERATIONS PLATFORM LAUNCH SYSTEM
echo ===================================================================
echo.
echo [1/4] Starting Company Target Microservices Fleet (Ports 5001, 5002, 5003)...
start "Lithium - Company Microservices Fleet (Ports 5001-5003)" cmd /k "python company_services\fleet.py"

echo.
echo [2/4] Initializing Persistence Database Layer...
python -c "import sys; sys.path.insert(0, 'backend'); import postgres_adapter as db; db.init_unified_db(); print(' -> Persistence ready: ' + db.get_db_status()['engine'])"

echo.
echo [3/4] Launching FastAPI Autonomous Backend Engine on http://localhost:8000...
start "Lithium - FastAPI Backend (Port 8000)" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

echo.
echo [4/4] Launching Frontend Operations Desk on http://localhost:3000...
start "Lithium - Frontend Server (Port 3000)" cmd /k "cd frontend && python server.py"

echo.
echo ===================================================================
echo  All 3 Production Systems Active and Interconnected:
echo   - Company Services Fleet:  http://localhost:5001, 5002, 5003
echo   - Lithium Control Backend: http://localhost:8000
echo   - API Swagger Docs:        http://localhost:8000/docs
echo   - Operations Desk UI:      http://localhost:3000
echo ===================================================================
echo.
pause
