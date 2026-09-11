"""Exercise HR auth -> draft -> upload -> real internal OCR -> persisted suggestions."""
import argparse
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request

import uvicorn

from smoke import receipt_image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--font', type=Path, required=True)
    parser.add_argument('--backend-python', type=Path, required=True)
    args = parser.parse_args()
    # Preserve the venv executable symlink on Linux; resolving it loses the venv.
    backend_python = args.backend_python.absolute()
    root = Path(__file__).resolve().parent.parent
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    os.environ['OCR_SERVICE_TOKEN'] = secrets.token_urlsafe(32)
    server = uvicorn.Server(uvicorn.Config('app:app', host='127.0.0.1', port=port, log_level='warning', access_log=False))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        for _ in range(100):
            if server.started:
                break
            if not thread.is_alive():
                raise RuntimeError('OCR server could not start')
            time.sleep(.1)
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=3) as response:
            assert response.status == 200
        with tempfile.TemporaryDirectory(prefix='hr-ocr-smoke-') as directory:
            receipt = Path(directory) / 'fixture.png'
            receipt.write_bytes(receipt_image(args.font))
            env = {**os.environ, 'OCR_LIVE_URL': f'http://127.0.0.1:{port}', 'OCR_LIVE_RECEIPT': str(receipt)}
            subprocess.run([str(backend_python), '-m', 'pytest', 'tests/api/test_paddle_receipts.py::test_live_hr_upload', '-q', '--tb=short'],
                           cwd=root / 'backend', env=env, check=True, timeout=120)
    finally:
        server.should_exit = True
        thread.join(timeout=10)


if __name__ == '__main__':
    main()
