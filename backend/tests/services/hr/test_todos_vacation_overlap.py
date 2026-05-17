"""연차·반차 중복 검사 단위 테스트 (본인만, 타인 일정 무시)."""

from datetime import date, datetime, time
from typing import cast

import pytest
from fastapi import HTTPException

from models.auth_models import User
from models.hr_models import Todo
from schemas.hr.todos_schemas import TodoCreate
from services.hr import todos_service
from support.memory_db import memory_db_session


@pytest.fixture()
def db_session():
	with memory_db_session() as s:
		yield s


_user_id_seq = 0


def _user(db, login_id: str) -> User:
	global _user_id_seq
	_user_id_seq += 1
	u = User(
		id=_user_id_seq,
		user_login_id=login_id,
		user_password="x",
		user_name=login_id,
		join_date=date(2020, 1, 1),
	)
	db.add(u)
	db.commit()
	return u


def _vacation_todo(db, user_id: str, d: date, category: str = "vacation_full") -> Todo:
	st = datetime.combine(d, time.min)
	en = datetime.combine(d, time.max)
	t = Todo(
		user_id=user_id,
		title="vac",
		start_date=st,
		end_date=en,
		category=category,
	)
	db.add(t)
	db.commit()
	db.refresh(t)
	return t


def test_overlap_blocks_same_user_same_day(db_session):
	_user(db_session, "user_a")
	d = date(2025, 7, 10)
	_vacation_todo(db_session, "user_a", d)

	with pytest.raises(HTTPException) as exc:
		todos_service.create_todo(
			db_session,
			TodoCreate(
				title="dup",
				start_date=datetime.combine(d, time.min),
				end_date=datetime.combine(d, time.max),
				category="vacation_am",
			),
			"user_a",
		)
	assert exc.value.status_code == 400
	assert "연차" in str(exc.value.detail)


def test_overlap_allows_other_user_same_day(db_session):
	_user(db_session, "user_a")
	_user(db_session, "user_b")
	d = date(2025, 7, 11)
	_vacation_todo(db_session, "user_a", d)

	created = todos_service.create_todo(
		db_session,
		TodoCreate(
			title="b leave",
			start_date=datetime.combine(d, time.min),
			end_date=datetime.combine(d, time.max),
			category="vacation_full",
		),
		"user_b",
	)
	assert created.user_id == "user_b"


def test_overlap_update_excludes_self(db_session):
	_user(db_session, "user_a")
	d = date(2025, 7, 12)
	t = _vacation_todo(db_session, "user_a", d, category="vacation_am")

	from schemas.hr.todos_schemas import TodoUpdate

	updated = todos_service.update_todo(
		db_session,
		cast(int, t.id),
		TodoUpdate(title="am updated"),
		"user_a",
	)
	assert updated is not None
	assert updated.title == "am updated"
