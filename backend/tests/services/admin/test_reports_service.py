import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

# 테스트 실행 위치에 상관없이 app 모듈 임포트 가능하게 보정
APP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..", "app"))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from services.admin import reports_service  # noqa: E402
from api.admin import reports as admin_reports_api  # noqa: E402


@dataclass
class FakeAttendance:
    user_id: str
    work_date: date
    status: str | None = None


@dataclass
class FakeDailyReport:
    user_id: str
    report_date: date


class _QueryBase:
    def filter(self, *_args: Any, **_kwargs: Any):
        return self

    def order_by(self, *_args: Any, **_kwargs: Any):
        return self

    def distinct(self):
        return self


class _UserQuery(_QueryBase):
    def __init__(self, session: "FakeSession"):
        self._s = session

    def all(self):
        # 실제 서비스 코드의 DB 필터 조건을 "의도대로" 파이썬으로 재현
        wd = self._s.context_work_date
        out = []
        for u in self._s.users:
            if u.join_date is None:
                continue
            if wd is not None and u.join_date > wd:
                continue
            if wd is not None and u.resignation_date is not None and u.resignation_date < wd:
                continue
            out.append(u)
        out.sort(key=lambda x: str(getattr(x, "user_name", "")))
        return out


class _AttendanceQuery(_QueryBase):
    def __init__(self, session: "FakeSession"):
        self._s = session

    def all(self):
        wd = self._s.context_work_date
        if wd is None:
            return list(self._s.attendances)
        return [a for a in self._s.attendances if a.work_date == wd]


class _DailyReportQuery(_QueryBase):
    def __init__(self, session: "FakeSession"):
        self._s = session

    def all(self):
        wd = self._s.context_work_date
        if wd is None:
            return list(self._s.daily_reports)
        return [r for r in self._s.daily_reports if r.report_date == wd]


class _TodoUserIdQuery(_QueryBase):
    """reports_service.list_daily_status()에서 필요한 형태(tuple[user_id])만 반환."""

    def __init__(self, session: "FakeSession"):
        self._s = session

    def all(self):
        wd = self._s.context_work_date
        if wd is None:
            return [(uid,) for uid in sorted(self._s.vacation_todo_users)]
        # 특정 날짜에 겹치는 휴가 Todo 유저만 반환
        hit = set()
        for uid, start_dt, end_dt in self._s.vacation_todos:
            start_day = start_dt.date()
            end_day = (end_dt or start_dt).date()
            if start_day <= wd <= end_day:
                hit.add(uid)
        return [(uid,) for uid in sorted(hit)]


class _HolidayIdQuery(_QueryBase):
    """reports_service._is_public_holiday()의 first() 호출만 커버."""

    def __init__(self, session: "FakeSession"):
        self._s = session

    def first(self):
        wd = self._s.context_work_date
        if wd is None:
            return None
        return (1,) if wd in self._s.holiday_dates else None


class FakeSession:
    """SQLAlchemy Session을 대체하는 매우 얕은 Mock."""

    def __init__(
        self,
        *,
        users: list[Any] | None = None,
        attendances: list[FakeAttendance] | None = None,
        daily_reports: list[FakeDailyReport] | None = None,
        vacation_todos: list[tuple[str, datetime, datetime | None]] | None = None,
        holiday_dates: set[date] | None = None,
    ):
        self.users = users or []
        self.attendances = attendances or []
        self.daily_reports = daily_reports or []
        self.vacation_todos = vacation_todos or []
        self.vacation_todo_users = {t[0] for t in self.vacation_todos}
        self.holiday_dates = holiday_dates or set()
        self.context_work_date: date | None = None

    def set_context_work_date(self, d: date):
        self.context_work_date = d

    def query(self, entity: Any, *entities: Any):
        # list_daily_status가 사용하는 쿼리들만 커버
        ent_str = str(entity)
        key = getattr(entity, "key", None) or getattr(entity, "name", None) or ""
        model_name = getattr(entity, "__name__", "")

        # db.query(Todo.user_id) 형태를 단순화
        if "Todo.user_id" in ent_str or "user_id" in str(key):
            return _TodoUserIdQuery(self)

        # db.query(Holiday.id) 형태를 단순화
        if "Holiday.id" in ent_str or str(key) == "id":
            return _HolidayIdQuery(self)

        if model_name == "User":
            return _UserQuery(self)
        if model_name == "Attendance":
            return _AttendanceQuery(self)
        if model_name == "DailyReport":
            return _DailyReportQuery(self)

        raise AssertionError(f"Unsupported query entity in FakeSession: {entity}")


def test_exclude_resigned_user():
    # Given: 기준일 이전 퇴사자 + 재직자 세팅
    work_date = date(2026, 4, 1)
    resigned = SimpleNamespace(
        user_login_id="resigned1",
        user_name="퇴사자",
        join_date=date(2025, 1, 1),
        resignation_date=date(2026, 3, 31),
    )
    active = SimpleNamespace(
        user_login_id="active1",
        user_name="재직자",
        join_date=date(2025, 1, 1),
        resignation_date=None,
    )
    db = FakeSession(users=[resigned, active])
    db.set_context_work_date(work_date)

    # When: 보고서 일일 현황 조회 실행
    rows = reports_service.list_daily_status(db, work_date)

    # Then: 퇴사자가 결과에서 제외됨을 검증
    ids = {r["user_login_id"] for r in rows}
    assert "resigned1" not in ids
    assert "active1" in ids


@pytest.mark.parametrize(
    "case",
    ["HOLIDAY", "VACATION"],
)
def test_report_status_vacation_or_holiday(monkeypatch, case: str):
    # Given: 공휴일/휴가 데이터 세팅
    work_date = date(2026, 4, 1)
    u = SimpleNamespace(
        user_login_id="u1",
        user_name="직원1",
        join_date=date(2025, 1, 1),
        resignation_date=None,
    )
    attendances = []
    if case == "VACATION":
        # 공휴일이 아닌 날에 휴가(근태 상태)로 판별되게
        work_date = date(2026, 4, 2)
        attendances = [FakeAttendance(user_id="u1", work_date=work_date, status="연차")]

    db = FakeSession(users=[u], attendances=attendances)
    db.set_context_work_date(work_date)

    holiday_dates = {date(2026, 4, 1)}
    monkeypatch.setattr(
        reports_service,
        "_is_public_holiday",
        lambda _db, d: d in holiday_dates,
    )

    # When: 상태 판별 로직 실행
    rows = reports_service.list_daily_status(db, work_date)

    # Then: MISSING이 아니라 VACATION 또는 HOLIDAY로 반환되는지 검증
    assert len(rows) == 1
    assert rows[0]["daily_status"] in ("VACATION", "HOLIDAY")
    assert rows[0]["daily_status"] == case


def test_invalid_date_range():
    # Given: 허용 범위를 벗어난 과거(3년 초과) 날짜
    too_old = date.today() - timedelta(days=365 * 3 + 1)
    db = FakeSession(users=[])

    # When/Then: API 레이어에서 HTTPException(400)을 발생시키는지 검증
    with pytest.raises(HTTPException) as e:
        admin_reports_api.report_daily_status(work_date=too_old, db=db, _={})

    assert e.value.status_code == 400
