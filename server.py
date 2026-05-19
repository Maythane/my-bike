#!/usr/bin/env python3
"""
server.py — My-bike Moto Tracker
รัน: python /Volumes/Maythane/My-bike/server.py
เปิด: http://localhost:8764
"""
import os, socket, sys, webbrowser
from pathlib import Path

BASE_DIR    = Path(__file__).parent.resolve()
BACKEND_DIR = BASE_DIR / 'backend'
UVICORN     = BACKEND_DIR / '.venv' / 'bin' / 'uvicorn'
DB_PATH     = BASE_DIR / 'data' / 'moto.db'
PORT        = 8764


def _local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return '127.0.0.1'


def main():
    ip   = _local_ip()
    path = f':{PORT}'
    print('─' * 60)
    print(f'  Moto Tracker  →  http://localhost{path}')
    print(f'  Network       →  http://{ip}{path}')
    print('─' * 60)
    print('  Ctrl+C to stop\n')

    if not os.environ.get('NO_BROWSER'):
        webbrowser.open(f'http://localhost{path}')

    env = os.environ.copy()

    if 'AUTH_SECRET_KEY' not in env:
        print('ERROR: AUTH_SECRET_KEY env var is required')
        print('  Generate one: export AUTH_SECRET_KEY="$(openssl rand -hex 32)"')
        sys.exit(1)

    env['DB_PATH'] = str(DB_PATH)

    # execve replaces this process with uvicorn directly
    # ทำให้ control_gui kill PID ได้ clean โดยไม่มี orphan process
    os.chdir(str(BACKEND_DIR))
    os.execve(str(UVICORN), [
        'uvicorn', 'app.main:app',
        '--host', '0.0.0.0',
        '--port', str(PORT),
    ], env)


if __name__ == '__main__':
    main()
