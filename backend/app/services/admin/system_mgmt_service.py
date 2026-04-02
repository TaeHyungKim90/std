from sqlalchemy.orm import Session
from fastapi import HTTPException

from models.system_models import Department, Position
from schemas.system_schemas import (
	DepartmentCreate,
	DepartmentUpdate,
	PositionCreate,
	PositionUpdate,
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

