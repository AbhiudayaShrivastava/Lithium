@echo off
TITLE Lithium - Launch System
echo =========================================================
echo  Launching Lithium Operations Desk...
echo =========================================================

:: 1. Launch FastAPI Backend in a dedicated window
start "Lithium - Backend Engine" cmd /k "cd backend && call venv\Scripts\activate && python -m uvicorn main:app --reload --port 8000"

:: 2. Launch Vite React Frontend in a dedicated window
start "Lithium - Frontend Dashboard" cmd /k "cd frontend && npm run dev"

echo.
echo Lithium System Active:
echo  - Backend API:  http://localhost:8000
echo  - Dashboard UI: http://localhost:5173
echo.
pause