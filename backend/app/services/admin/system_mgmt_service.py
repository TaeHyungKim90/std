from sqlalchemy.orm import Session
from fastapi import HTTPException

import re

from models.system_models import Department, Position, WorkLocation
from schemas.system_schemas import (
	DepartmentCreate,
	DepartmentUpdate,
	PositionCreate,
	PositionUpdate,
	WorkLocationCreate,
	WorkLocationUpdate,
)


def get_all_departments(db: Session):
	return db.query(Department).order_by(Department.id.desc()).all()


def create_department(db: Session, payload: DepartmentCreate):
	if db.query(Department).filter(Department.department_name == payload.department_name).first():
		raise HTTPException(status_code=400, detail="이미 존재하는 부서명입니다.")
	new_row = Department(**payload.model_dump())
	db.add(new_row)
	db.commit()
	db.refresh(new_row)
	return new_row


def update_department(db: Session, department_id: int, payload: DepartmentUpdate):
	row = db.query(Department).filter(Department.id == department_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
	update_data = payload.model_dump(exclude_unset=True)
	for k, v in update_data.items():
		setattr(row, k, v)
	db.commit()
	db.refresh(row)
	return row


def delete_department(db: Session, department_id: int):
	row = db.query(Department).filter(Department.id == department_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
	db.delete(row)
	db.commit()
	return {"message": "부서가 삭제되었습니다."}


def get_all_positions(db: Session):
	return db.query(Position).order_by(Position.id.desc()).all()


def create_position(db: Session, payload: PositionCreate):
	if db.query(Position).filter(Position.position_name == payload.position_name).first():
		raise HTTPException(status_code=400, detail="이미 존재하는 직급명입니다.")
	new_row = Position(**payload.model_dump())
	db.add(new_row)
	db.commit()
	db.refresh(new_row)
	return new_row


def update_position(db: Session, position_id: int, payload: PositionUpdate):
	row = db.query(Position).filter(Position.id == position_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="직급을 찾을 수 없습니다.")
	update_data = payload.model_dump(exclude_unset=True)
	for k, v in update_data.items():
		setattr(row, k, v)
	db.commit()
	db.refresh(row)
	return row


def delete_position(db: Session, position_id: int):
	row = db.query(Position).filter(Position.id == position_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="직급을 찾을 수 없습니다.")
	db.delete(row)
	db.commit()
	return {"message": "직급이 삭제되었습니다."}


_WORK_LOCATION_KEY_PATTERN = re.compile(r"^[a-z0-9_]{2,50}$")


def _normalize_work_location_payload(data: dict) -> dict:
	for field in ("location_key", "location_value", "description"):
		if field in data and isinstance(data[field], str):
			data[field] = data[field].strip()
	return data


def _validate_work_location_payload(data: dict):
	location_key = data.get("location_key")
	location_value = data.get("location_value")

	if location_key is not None and not _WORK_LOCATION_KEY_PATTERN.fullmatch(location_key):
		raise HTTPException(
			status_code=400,
			detail="근무장소 key는 영문 소문자, 숫자, 밑줄(_)만 사용한 2~50자여야 합니다.",
		)

	if location_value is not None and len(location_value) == 0:
		raise HTTPException(status_code=400, detail="근무장소 value는 비어 있을 수 없습니다.")


def get_all_work_locations(db: Session):
	return db.query(WorkLocation).order_by(WorkLocation.created_at.desc(), WorkLocation.id.desc()).all()


def create_work_location(db: Session, payload: WorkLocationCreate):
	data = _normalize_work_location_payload(payload.model_dump())
	_validate_work_location_payload(data)

	if db.query(WorkLocation).filter(WorkLocation.location_key == data["location_key"]).first():
		raise HTTPException(status_code=400, detail="이미 존재하는 근무장소 key입니다.")
	if db.query(WorkLocation).filter(WorkLocation.location_value == data["location_value"]).first():
		raise HTTPException(status_code=400, detail="이미 존재하는 근무장소 value입니다.")

	new_row = WorkLocation(**data)
	db.add(new_row)
	db.commit()
	db.refresh(new_row)
	return new_row


def update_work_location(db: Session, work_location_id: int, payload: WorkLocationUpdate):
	row = db.query(WorkLocation).filter(WorkLocation.id == work_location_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="근무장소를 찾을 수 없습니다.")

	update_data = _normalize_work_location_payload(payload.model_dump(exclude_unset=True))
	_validate_work_location_payload(update_data)

	next_key = update_data.get("location_key")
	next_value = update_data.get("location_value")

	if next_key is not None:
		dup_key = (
			db.query(WorkLocation)
			.filter(WorkLocation.location_key == next_key, WorkLocation.id != work_location_id)
			.first()
		)
		if dup_key:
			raise HTTPException(status_code=400, detail="이미 존재하는 근무장소 key입니다.")

	if next_value is not None:
		dup_value = (
			db.query(WorkLocation)
			.filter(WorkLocation.location_value == next_value, WorkLocation.id != work_location_id)
			.first()
		)
		if dup_value:
			raise HTTPException(status_code=400, detail="이미 존재하는 근무장소 value입니다.")

	for k, v in update_data.items():
		setattr(row, k, v)
	db.commit()
	db.refresh(row)
	return row


def delete_work_location(db: Session, work_location_id: int):
	row = db.query(WorkLocation).filter(WorkLocation.id == work_location_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="근무장소를 찾을 수 없습니다.")
	db.delete(row)
	db.commit()
	return {"message": "근무장소가 삭제되었습니다."}

