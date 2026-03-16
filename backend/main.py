import uvicorn
import os
import subprocess
import threading
import platform
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# 수정된 경로 반영 (backend 폴더 구조에 맞춤)
from database import init_db
from app.routers import auth, admin, hr # 분리한 라우터들 가져오기

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() # 👈 실행!
    yield
app = FastAPI(title="HR Management System", lifespan=lifespan)

# 2. CORS 설정 (React 연동 필수)
# 반드시 allow_credentials=True여야 check-auth 세션 쿠키가 공유됩니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://10.44.100.52:3000","http://127.0.0.1:3000"],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 라우터 등록 (Node.js의 엔드포인트 정의와 동일)
app.include_router(auth, prefix="/api/auth", tags=["Auth"])
app.include_router(hr, prefix="/api/hr", tags=["HR"])
app.include_router(admin, prefix="/api/admin", tags=["Admin"])
# 4. 정적 파일 및 프론트엔드 서빙 로직
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "..", "static")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def read_root():
    index_path = os.path.join(STATIC_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Server is running. Frontend static files not found."}

# 5. 리액트 자동 실행 함수 (개발 편의용)
def run_react():
    frontend_dir = os.path.join(BASE_DIR, "..", "frontend")
    if os.path.exists(frontend_dir):
        print(f"--- Starting React Dev Server in {frontend_dir} ---")
        env = os.environ.copy()
        env["HOST"] = "0.0.0.0"
        # 윈도우 환경 대응
        shell_val = True if platform.system() == "Windows" else False
        process = subprocess.Popen("npm start", shell=shell_val, cwd=frontend_dir,env=env)
        return process

if __name__ == "__main__":
    # 리액트 서버를 별도 스레드에서 실행
    react_thread = threading.Thread(target=run_react, daemon=True)
    react_thread.start()

    # FastAPI 실행 (reload=True는 개발 시 필수)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)