import uvicorn
import os
import subprocess
import threading
import platform
import atexit
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# 수정된 경로 반영 (backend 폴더 구조에 맞춤)
from db.session import init_db
from routers import auth, admin, hr,public,common # 분리한 라우터들 가져오기
from core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() # 👈 실행!
    yield
app = FastAPI(title="HR Management System", lifespan=lifespan)

# 2. CORS 설정 (React 연동 필수)
# 반드시 allow_credentials=True여야 check-auth 세션 쿠키가 공유됩니다.
cors_origins_list = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 라우터 등록 (Node.js의 엔드포인트 정의와 동일)
app.include_router(common, prefix="/api/common", tags=["Common"])
app.include_router(auth, prefix="/api/auth", tags=["Auth"])
app.include_router(hr, prefix="/api/hr", tags=["HR"])
app.include_router(admin, prefix="/api/admin", tags=["Admin"])
app.include_router(public, prefix="/api/public", tags=["Public"])

# 4. 정적 파일 및 프론트엔드 서빙 로직
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "static"))
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
async def read_root():
    index_path = os.path.join(STATIC_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Server is running. Frontend static files not found."}

# 5. 리액트 자동 실행 함수 (개발 편의용)
def run_react():
    frontend_dir = os.path.join(BASE_DIR, "../..", "frontend")
    if not os.path.exists(frontend_dir):
        return
    print(f"--- Starting React Dev Server in {frontend_dir} ---")
    env = os.environ.copy()
    env["HOST"] = "0.0.0.0"
    # 윈도우 환경 대응
    is_windows = platform.system() == "Windows"
    process = subprocess.Popen("npm start", shell=is_windows, cwd=frontend_dir, env=env)
    
    def kill_react_server():
        print("\n--- 🛑 Shutting down React server... ---")
        if is_windows:
            # 윈도우: /T 옵션을 줘서 자식 프로세스(node.exe)까지 싹 다 강제 종료 (좀비 방지)
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(process.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            # 맥/리눅스용 종료
            process.terminate()
            
    # 파이썬 종료 이벤트에 청소 함수 등록
    atexit.register(kill_react_server)

if __name__ == "__main__":
    # 리액트 서버를 별도 스레드에서 실행
    if os.environ.get("REACT_SERVER_STARTED") != "1":
        os.environ["REACT_SERVER_STARTED"] = "1"
        react_thread = threading.Thread(target=run_react, daemon=True)
        react_thread.start()

    # FastAPI 실행
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)