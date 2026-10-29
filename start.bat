@echo off
title Claude Local UI
where node >nul 2>&1 || (echo Node.js 22 or newer is required: https://nodejs.org & pause & exit /b 1)
where claude >nul 2>&1 || (echo Claude Code CLI is required: https://claude.com/claude-code & pause & exit /b 1)
node "%~dp0server.js"
if errorlevel 1 pause
