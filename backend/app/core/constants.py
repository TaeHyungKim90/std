"""
프로젝트 전역 상수 모음.

- 값(문자열/경로/키)을 한 곳에서 관리하여, 변경 시 상수 파일만 수정하면 전체가 반영되도록 합니다.
"""

# 연차/휴가 카테고리 키(백엔드 DB의 todo_category_type.category_key 및 Todo.category와 동일)
VACATION_CATEGORIES = {
	"FULL": "vacation_full",
	"AM": "vacation_am",
	"PM": "vacation_pm",
}

VACATION_HALF_DAY_CATEGORIES = (
	VACATION_CATEGORIES["AM"],
	VACATION_CATEGORIES["PM"],
)

