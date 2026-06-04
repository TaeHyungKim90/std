from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.auth_models import User
from models.hr_models import Todo, TodoCategoryType
from services.tenant_scope import categories_in_tenant, todos_in_tenant


def get_all_category_types(db: Session, tenant_id: int):
	return categories_in_tenant(db, tenant_id).all()


def add_category_type(db: Session, tenant_id: int, payload):
	existing_type = (
		categories_in_tenant(db, tenant_id)
		.filter(TodoCategoryType.category_key == payload.category_key)
		.first()
	)
	if existing_type:
		raise HTTPException(status_code=400, detail="이미 존재하는 카테고리 키입니다.")
	category_data = payload.model_dump()
	new_type = TodoCategoryType(tenant_id=tenant_id, **category_data)
	db.add(new_type)
	db.commit()
	db.refresh(new_type)
	return new_type


def update_category_type(db: Session, tenant_id: int, cat_id: int, cat_data: dict):
	category = (
		categories_in_tenant(db, tenant_id).filter(TodoCategoryType.id == cat_id).first()
	)
	if not category:
		raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
	for k, v in cat_data.items():
		setattr(category, k, v)
	db.commit()
	db.refresh(category)
	return category


def delete_category_type(db: Session, tenant_id: int, cat_id: int):
	category = (
		categories_in_tenant(db, tenant_id).filter(TodoCategoryType.id == cat_id).first()
	)
	if not category:
		raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

	count = (
		todos_in_tenant(db, tenant_id)
		.filter(Todo.category == category.category_key)
		.count()
	)
	if count > 0:
		raise HTTPException(status_code=400, detail="사용 중인 카테고리는 삭제할 수 없습니다.")

	db.delete(category)
	db.commit()
	return {"message": "카테고리가 삭제되었습니다."}
