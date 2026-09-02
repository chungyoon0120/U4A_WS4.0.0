@echo off
rem yoon-notion launcher (Windows cmd / PowerShell)
rem
rem Finds a usable Python 3.9+ and runs notion_cli.py with it. Search order:
rem   1. %YOON_NOTION_PYTHON%   explicit override
rem   2. <skill>untime\      a bundled self-contained runtime, if present
rem   3. <skill>\.venv         a virtualenv next to this script, if present
rem   4. py -3 / python / python3
rem   5. uv run - last resort, fetches a Python if needed
rem
rem   yoon-notion.cmd --setup-venv     create the .venv used by step 2
rem   yoon-notion.cmd --which-python   show which interpreter was picked
rem
rem A venv still needs Python installed - it isolates packages, it does not
rem ship a runtime. This CLI has no dependencies, so the venv is optional.
rem
rem NOTE: this file must keep CRLF line endings. cmd.exe seeks by byte offset
rem and a LF-only batch file breaks with garbled "not recognized" errors.

setlocal
set "DIR=%~dp0"
set "CLI=%DIR%notion_cli.py"
set "CHECK=import sys;v=sys.version_info[:2];sys.exit(0 if max(v,(3,9))==v else 1)"
set "PY="
set "PYFLAG="

if defined YOON_NOTION_PYTHON (
    call :try "%YOON_NOTION_PYTHON%"
    if defined PY goto run
    echo yoon-notion: YOON_NOTION_PYTHON is set but is not a usable Python 3.9+ 1>&2
    exit /b 2
)

rem A bundled runtime. Unlike a venv this one is self-contained and works
rem on a machine with no Python installed: drop the python.org "embeddable
rem package" (python-3.x-embed-amd64.zip) into <skill>untime\.
call :try "%DIR%runtime\python.exe"
if defined PY goto run

call :try "%DIR%.venv\Scripts\python.exe"
if defined PY goto run

rem `py` first on Windows: a bare `python` is often the Microsoft Store stub,
rem which opens the Store instead of running anything.
call :try "py" "-3"
if defined PY goto run
call :try "python"
if defined PY goto run
call :try "python3"
if defined PY goto run

rem Last resort: uv can fetch a standalone Python on demand. Needs uv and
rem (on first run) network access, so it comes after every local option.
where uv >nul 2>&1
if not errorlevel 1 goto useuv
goto nopython

:useuv
echo yoon-notion: no local Python found, falling back to uv 1>&2
uv run --no-project --python ">=3.9" "%CLI%" %*
exit /b %errorlevel%

:try
rem %~1 = interpreter, %~2 = optional leading flag (e.g. -3)
if defined PY exit /b 0
"%~1" %~2 -c "%CHECK%" >nul 2>&1
if errorlevel 1 exit /b 0
set "PY=%~1"
set "PYFLAG=%~2"
exit /b 0

:run
if "%~1"=="--which-python" (
    echo %PY% %PYFLAG%
    "%PY%" %PYFLAG% --version
    exit /b 0
)
if "%~1"=="--setup-venv" (
    echo creating venv with: %PY% %PYFLAG%
    "%PY%" %PYFLAG% -m venv "%DIR%.venv"
    echo created %DIR%.venv
    echo This launcher will now use it automatically.
    exit /b 0
)
"%PY%" %PYFLAG% "%CLI%" %*
exit /b %errorlevel%

:nopython
echo yoon-notion: no Python 3.9+ found on this system. 1>&2
echo. 1>&2
echo Looked at: %%YOON_NOTION_PYTHON%%, ^<skill^>untime, ^<skill^>\.venv, 1>&2
echo            py -3, python, python3, uv 1>&2
echo. 1>&2
echo Fix it with any one of these: 1>&2
echo   1^) Install Python   https://www.python.org/downloads/ 1>&2
echo      On Windows, tick "Add python.exe to PATH" during setup. 1>&2
echo   2^) Point at it      set YOON_NOTION_PYTHON=C:\path\to\python.exe 1>&2
echo. 1>&2
echo This CLI uses only the standard library, so no pip install is needed. 1>&2
exit /b 2
