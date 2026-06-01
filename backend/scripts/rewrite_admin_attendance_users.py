"""Rewrite admin/attendance.py and admin/users.py with correct UTF-8 Korean."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "app" / "api" / "admin"


def u(s: str) -> str:
	return s.encode("ascii").decode("unicode_escape")


USERS = u(r'''from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin import user_service
from schemas.auth_schemas import UserResponse, UserCreate, UserUpdate

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
def read_all_users(
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc804\uccb4 \uc0ac\uc6a9\uc790 \ubaa9\ub85d (\ud14c\ub2e8\ud06c \ubc94\uc704)."""
\treturn user_service.get_all_users(db, tenant_id_from_user(current_admin))


@router.post("/", response_model=UserResponse)
def create_user(
\tpayload: UserCreate,
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc0c8 \uc0ac\uc6a9\uc790 \ub4f1\ub85d."""
\treturn user_service.create_user_by_admin(
\t\tdb, payload, tenant_id_from_user(current_admin)
\t)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user_info(
\tuser_id: int,
\tpayload: UserUpdate,
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc0ac\uc6a9\uc790 \uc815\ubcf4 \uc218\uc815."""
\treturn user_service.update_user_by_admin(
\t\tdb, user_id, payload, tenant_id_from_user(current_admin)
\t)


@router.delete("/{user_id}")
def delete_user(
\tuser_id: int,
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc0ac\uc6a9\uc790 \uc0ad\uc81c."""
\treturn user_service.delete_user_by_admin(
\t\tdb, user_id, tenant_id_from_user(current_admin)
\t)


@router.post("/vacations/sync")
def sync_vacation(
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc5f0\ucc28 \uc804\uccb4 \ub3d9\uae30\ud654 (\ud14c\ub2e8\ud06c \ubc94\uc704)."""
\treturn user_service.sync_all_users_vacation(db, tenant_id_from_user(current_admin))
''')

ATTENDANCE = u(r'''from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin import attendance_reward_service
from services.admin import attendance_service as service
from schemas.admin.attendance_schemas import (
\tAdminAttendanceCreate,
\tAdminAttendanceMonthlyRewardsResponse,
\tAdminAttendanceRangeResponse,
\tAdminAttendanceRecordOut,
\tAdminAttendanceRecomputeResponse,
\tAdminAttendanceUpdate,
)

router = APIRouter()


@router.post("/records", response_model=AdminAttendanceRecordOut)
def post_attendance_record(
\tbody: AdminAttendanceCreate,
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uadfc\ud0dc 1\uac74 \uc0dd\uc131(\ud574\ub2f9 user\u00b7work_date\uc5d0 \ud589\uc774 \uc5c6\uc744 \ub54c\ub9cc). \uac00\uc0c1 \uacb0\uadfc \ud589\uc744 \uc2e4\uc81c \uae30\ub85d\uc73c\ub85c \ubc14\uafbc \ub54c \uc0ac\uc6a9."""
\tpayload = body.model_dump(exclude_unset=True)
\tuser_login_id = str(payload.pop("user_login_id", "")).strip()
\twork_date = payload.pop("work_date")
\trecord = service.create_attendance_record(db, user_login_id, work_date, payload)
\treturn AdminAttendanceRecordOut.model_validate(record)


@router.patch("/records/{record_id}", response_model=AdminAttendanceRecordOut)
def patch_attendance_record(
\trecord_id: int,
\tbody: AdminAttendanceUpdate,
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uadfc\ud0dc \uae30\ub85d \uc218\uc815 (\uad00\ub9ac\uc790 \uad8c\ud55c)."""
\tupdates = body.model_dump(exclude_unset=True)
\trecord = service.update_attendance_record(db, record_id, updates)
\treturn AdminAttendanceRecordOut.model_validate(record)


@router.get("/user/{user_login_id}/range", response_model=AdminAttendanceRangeResponse)
def get_user_attendance_range(
\tuser_login_id: str,
\tstart_date: str = Query(..., description="YYYY-MM-DD"),
\tend_date: str = Query(..., description="YYYY-MM-DD"),
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \ud2b9\uc815 \uc9c1\uc6d0 \uadfc\ud0dc \uae30\uac04 \uc870\ud68c."""
\ttid = tenant_id_from_user(current_admin)
\treturn service.get_user_attendance_range(db, tid, user_login_id, start_date, end_date)


@router.get("/all")
def get_all_attendance(
\tuser_name: Optional[str] = None,
\twork_date: Optional[str] = None,
\tskip: int = Query(0, ge=0),
\tlimit: int = Query(20, ge=1, le=100),
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc804\uccb4 \uc9c1\uc6d0 \uc77c\uc77c \uadfc\ud0dc \uc870\ud68c."""
\ttid = tenant_id_from_user(current_admin)
\treturn service.get_all_attendance(db, tid, user_name, work_date, skip=skip, limit=limit)


@router.get("/monthly-rewards", response_model=AdminAttendanceMonthlyRewardsResponse)
def get_monthly_attendance_rewards(
\tyear: int = Query(..., ge=2000, le=2100),
\tmonth: int = Query(..., ge=1, le=12),
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uc6d4\ubcc4 \uadfc\ud0dc \ub9ac\uc6cc\ub4dc \uc9d1\uacc4 \uc870\ud68c."""
\ttid = tenant_id_from_user(current_admin)
\treturn attendance_reward_service.get_monthly_attendance_rewards(db, tid, year, month)


@router.post("/recompute-work-minutes", response_model=AdminAttendanceRecomputeResponse)
def post_recompute_work_minutes(
\tstart_date: str = Query(..., description="YYYY-MM-DD"),
\tend_date: str = Query(..., description="YYYY-MM-DD"),
\tdry_run: bool = Query(
\t\tTrue,
\t\tdescription="true\uba74 \ubcc0\uacbd \ubbf8\ub9ac\ubcf4\uae30\ub9cc. false\uba74 DB\uc5d0 work_minutes \ubc18\uc601",
\t),
\tuser_login_id: Optional[str] = Query(
\t\tNone,
\t\tdescription="\uc9c0\uc815 \uc2dc \ud574\ub2f9 \uc9c1\uc6d0\ub9cc \uc7ac\uacc4\uc0b0 (\uc120\ud0dd)",
\t),
\tdb: Session = Depends(get_db),
\tcurrent_admin: dict = Depends(get_current_admin_for_tenant),
):
\t"""[\uad00\ub9ac\uc790] \uae30\uac04 \ub0b4 \uadfc\ud0dc work_minutes \uc77c\uad04 \uc7ac\uacc4\uc0b0 (\uad00\ub9ac\uc790 \uc804\uc6a9).

\t\uae30\ubcf8 dry_run=true \ub85c `changes`\ub9cc \ubc18\ud658\ud558\uace0, dry_run=false \uc77c \ub54c DB \ubc18\uc601.
\t"""
\traw = service.recompute_work_minutes_bulk(
\t\tdb,
\t\tstart_date,
\t\tend_date,
\t\tuser_login_id=user_login_id,
\t\tdry_run=dry_run,
\t)
\treturn AdminAttendanceRecomputeResponse.model_validate(raw)
''')


def main() -> None:
	(ROOT / "users.py").write_text(USERS, encoding="utf-8")
	(ROOT / "attendance.py").write_text(ATTENDANCE, encoding="utf-8")
	print("wrote users.py and attendance.py")
	# verify no question-mark corruption in Korean strings
	for name in ("users.py", "attendance.py"):
		text = (ROOT / name).read_text(encoding="utf-8")
		if '"""[' in text and "???" in text:
			raise SystemExit(f"still corrupted: {name}")
	print("ok")


if __name__ == "__main__":
	main()
