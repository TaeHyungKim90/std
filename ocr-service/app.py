import asyncio
import hmac
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from models import verify_models
from worker import BusyError, Worker

MAX_BYTES = 10 * 1024 * 1024
worker = Worker(timeout=60)


@asynccontextmanager
async def lifespan(app):
    if len(os.environ.get('OCR_SERVICE_TOKEN', '')) < 32:
        raise RuntimeError('OCR_SERVICE_TOKEN must contain at least 32 characters')
    verify_models()
    app.state.busy = False
    yield
    worker.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get('/health')
def health():
    return {'status': 'ready', 'provider': 'paddleocr'}


@app.post('/recognize')
async def recognize(request: Request):
    token = os.environ.get('OCR_SERVICE_TOKEN', '')
    if not token or not hmac.compare_digest(request.headers.get('authorization', '').encode(), f'Bearer {token}'.encode()):
        raise HTTPException(401, 'Unauthorized')
    mime = request.headers.get('content-type', '').split(';')[0].strip()
    if mime not in ('image/jpeg', 'image/png'):
        raise HTTPException(415, 'Only JPEG and PNG are accepted')
    if request.app.state.busy:
        raise HTTPException(429, 'OCR busy; try again later')
    request.app.state.busy = True
    try:
        data = bytearray()
        async with asyncio.timeout(15):
            async for chunk in request.stream():
                if len(data) + len(chunk) > MAX_BYTES:
                    raise HTTPException(413, 'Receipt exceeds 10MB')
                data.extend(chunk)
        if not data:
            raise HTTPException(422, 'Empty image')
        output = await run_in_threadpool(worker.infer, bytes(data), mime)
        if 'error' in output:
            code = 422 if output['error'] == 'invalid_image_or_no_fields' else 503
            raise HTTPException(code, 'OCR unavailable or receipt could not be read')
        return output['result']
    except TimeoutError:
        raise HTTPException(504, 'OCR deadline exceeded')
    except (BusyError, RuntimeError):
        raise HTTPException(503, 'OCR worker unavailable')
    finally:
        request.app.state.busy = False
