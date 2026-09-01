"""Restore corrupted Korean in API layer files. Run: python scripts/fix_api_korean.py"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "app" / "api"


def u(s: str) -> str:
	return s.encode("ascii").decode("unicode_escape")


FILES = {
	"admin/users.py": u(r'''from fastapi import APIRouter, Depends
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
\t"""[\uad00\ub9ac\uc790] \uc804\uccb4 \uc0ac\uc6a9\uc790 \ubaa9\ub85d (\ud14c\ub2c8\ud06c \ubc94\uc704)."""
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
\t"""[\uad00\ub9ac\uc790] \uc5f0\ucc28 \uc804\uccb4 \ub3d9\uae30\ud654 (\ud14c\ub2c8\ud06c \ubc94\uc704)."""
\treturn user_service.sync_all_users_vacation(db, tenant_id_from_user(current_admin))
'''),
}


PATCHES: dict[str, list[tuple[str, str]]] = {
	"hr/attendance.py": [
		('detail="?? ??? ???? ????"', u(r'detail="\uc778\uc99d \uc815\ubcf4\uac00 \uc62c\ubc14\ub974\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."')),
		('description="???(??? ? ??)"', u(r'description="\uc870\ud68c\uc77c(\ubbf8\uc9c0\uc815 \uc2dc \uc624\ub298)"')),
		('detail="??? ?? ??? ????. ?? ??? ???."', u(r'detail="\ubbf8\uc885\ub8cc \ucd9c\uadc0 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4. \uba38\uc800 \ucd9c\uadc0\ud574 \uc8fc\uc138\uc694."')),
		('detail="?? ?? ??? ?????."', u(r'detail="\uc774\ubbf8 \ud1f4\uadc0 \ucc98\ub9ac\ub41c \uae30\ub85d\uc785\ub2c8\ub2e4."')),
	],
	"hr/todos.py": [
		('detail="?? ??? ??? ?? ??? ?? ? ????."', u(r'detail="\ubcf8\uc778 \uc77c\uc815\ub9cc \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."')),
		('detail="?? ??? ??? ? ????."', u(r'detail="\ubcf8\uc778 \uc77c\uc815\ub9cc \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."')),
		('"message": "???????."', u(r'"message": "\uc77c\uc815\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."')),
		('"message": "??? ???????."', u(r'"message": "\uc77c\uc815\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."')),
	],
	"admin/holidays.py": [
		('detail="?? ??? ?? ??? ???? ?????."', u(r'detail="\ud574\ub2f9 \ub0a0\uc9dc\uc5d0 \uc774\ubbf8 \uacf5\ud734\uc77c\uc774 \ub4f1\ub85d\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4."')),
		('detail="?? ??? ?? ???? ???? ????."', u(r'detail="\ud574\ub2f9 \ub0a0\uc9dc\uc5d0 \uc774\ubbf8 \uacf5\ud734\uc77c\uc774 \ub4f1\ub85d\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4."')),
		('detail="????? ??? ??? ?? ? ????."', u(r'detail="\uc0ad\uc81c\ud560 \uacf5\ud734\uc77c\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."')),
		('detail="??? ???? ?? ? ????."', u(r'detail="\uc0ad\uc81c\ud560 \uacf5\ud734\uc77c\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."')),
		('"message": f"[{holiday.holiday_name}]?(?) ????? ???????."', u(r'"message": f"[{holiday.holiday_name}] \uacf5\ud734\uc77c\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."')),
		('"message": f"[{holiday.holiday_name}] ???? ???????."', u(r'"message": f"[{holiday.holiday_name}] \uacf5\ud734\uc77c\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."')),
		('"message": f"{year}? ??? {added_count}?? ????????."', u(r'"message": f"{year}\ub144 \uacf5\ud734\uc77c {added_count}\uac74\uc744 \ub3d9\uae30\ud654\ud588\uc2b5\ub2c8\ub2e4."')),
		('detail="??? ??? ? ?? ??? ??????."', u(r'detail="\uacf5\ud734\uc77c \ub3d9\uae30\ud654 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4."')),
		('detail="??? ??? ? ??? ??????."', u(r'detail="\uacf5\ud734\uc77c \ub3d9\uae30\ud654 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4."')),
	],
	"admin/recruitment.py": [
		('"message": "??(????)?????."', u(r'"message": "\uc591\uc2dd(\ud15c\ud074\ub9bf)\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."')),
		('"message": "??(???)? ???????."', u(r'"message": "\uc591\uc2dd(\ud15c\ud074\ub9bf)\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."')),
	],
	"admin/todos.py": [
		('description="??? ?? (YYYY-MM-DD)"', u(r'description="\uc870\ud68c \uae30\uc900\uc77c (YYYY-MM-DD)"')),
		('description="?? ??? (YYYY-MM-DD)"', u(r'description="\uc870\ud68c \uae30\uc900\uc77c (YYYY-MM-DD)"')),
	],
	"admin/reports.py": [
		("# ?? ??: ??? ???? ??????????? ??????? ?? (?????? ?? ?? ??? ???)", u(r"# \uac10\uc0ac \ub85c\uadf8: \ub2e4\ub978 \uad00\ub9ac\uc790\uac00 \ub204\uad6c\uc758 \ubcf4\uace0\uc11c\ub97c \uc5f4\ub78c\ud588\ub294\uc9c0 \uae30\ub85d (\uc2e4\ud328\ud574\ub3c4 \uba54\uc778 \ub85c\uc9c1 \uc601\ud5a5 \uc5c6\uc74c)")),
		("# ?? ??: ?? ???? ??? ???? ????? ?? (???? ?? ?? ?? ??)", u(r"# \uac10\uc0ac \ub85c\uadf8: \ub2e4\ub978 \uad00\ub9ac\uc790\uac00 \ub204\uad6c\uc758 \ubcf4\uace0\uc11c\ub97c \uc5f4\ub78c\ud588\ub294\uc9c0 \uae30\ub85d (\uc2e4\ud328\ud574\ub3c4 \uba54\uc778 \ub85c\uc9c1 \uc601\ud5a5 \uc5c6\uc74c)")),
		("# ?? ??? ??? ??", u(r"# \uac10\uc0ac \ub85c\uadf8 \uc2e4\ud328 \ubb34\uc2dc")),
		("# ?? ?? ?? ??", u(r"# \uac10\uc0ac \ub85c\uadf8 \uc2e4\ud328 \ubb34\uc2dc")),
	],
	"admin/attendance.py": [
		('"""[???] ?? 1?????(??? user?work_date????? ??? ???). ????? ??? ??? ????? ??? ?????."""', u(r'"""[\uad00\ub9ac\uc790] \uadfc\ud0dc 1\uac74 \uc0dd\uc131(\ud574\ub2f9 user\u00b7work_date\uc5d0 \ud589\uc774 \uc5c6\uc744 \ub54c\ub9cc). \uac00\uc0c1 \uacb0\uadc0 \ud589\uc744 \uc2e4\uc81c \uae30\ub85d\uc73c\ub85c \ubc14\uafbc \ub54c \uc0ac\uc6a9."""')),
		('"""[???] ?? 1? ??(?? user?work_date? ?? ?? ??). ?? ?? ?? ?? ???? ?? ? ??."""', u(r'"""[\uad00\ub9ac\uc790] \uadfc\ud0dc 1\uac74 \uc0dd\uc131(\ud574\ub2f9 user\u00b7work_date\uc5d0 \ud589\uc774 \uc5c6\uc744 \ub54c\ub9cc). \uac00\uc0c1 \uacb0\uadc0 \ud589\uc744 \uc2e4\uc81c \uae30\ub85d\uc73c\ub85c \ubc14\uafbc \ub54c \uc0ac\uc6a9."""')),
		('"""[???] ??? ?? ?? ??? (???????????)."""', u(r'"""[\uad00\ub9ac\uc790] \uadfc\ud0dc \uae30\ub85d \uc218\uc815 (\uad00\ub9ac\uc790 \uad8c\ud55c)."""')),
		('"""[???] ?? ?? ?? (??? ??)."""', u(r'"""[\uad00\ub9ac\uc790] \uadfc\ud0dc \uae30\ub85d \uc218\uc815 (\uad00\ub9ac\uc790 \uad8c\ud55c)."""')),
		('"""[???] ??? ?????????? ?? ??."""', u(r'"""[\uad00\ub9ac\uc790] \ud2b9\uc815 \uc9c1\uc6d0 \uadfc\ud0dc \uae30\uac04 \uc870\ud68c."""')),
		('"""[???] ?? ?? ?? ?? ??."""', u(r'"""[\uad00\ub9ac\uc790] \ud2b9\uc815 \uc9c1\uc6d0 \uadfc\ud0dc \uae30\uac04 \uc870\ud68c."""')),
		('"""[???] ??? ?? ?? ?? ????????????"', u(r'"""[\uad00\ub9ac\uc790] \uc804\uccb4 \uc9c1\uc6d0 \uc77c\uc77c \uadfc\ud0dc \uc870\ud68c."""')),
		('"""[???] ?? ?? ?? ?? ??."""', u(r'"""[\uad00\ub9ac\uc790] \uc804\uccb4 \uc9c1\uc6d0 \uc77c\uc77c \uadfc\ud0dc \uc870\ud68c."""')),
		('"""[???] ??? ?????????1??????????? ??."""', u(r'"""[\uad00\ub9ac\uc790] \uc6d4\ubcc4 \uadfc\ud0dc \ub9ac\uc6cc\ub4dc \uc9d1\uacc4 \uc870\ud68c."""')),
		('"""[???] ?? ?? ??? ?? ??."""', u(r'"""[\uad00\ub9ac\uc790] \uc6d4\ubcc4 \uadfc\ud0dc \ub9ac\uc6cc\ub4dc \uc9d1\uacc4 \uc870\ud68c."""')),
		('description="true???????? ??????. false????? DB??work_minutes ??"', u(r'description="true\uba74 \ubcc0\uacbd \ubbf8\ub9ac\ubcf4\uae30\ub9cc. false\uba74 DB\uc5d0 work_minutes \ubc18\uc601"')),
		('description="true? ?? ?????. false? DB? work_minutes ??"', u(r'description="true\uba74 \ubcc0\uacbd \ubbf8\ub9ac\ubcf4\uae30\ub9cc. false\uba74 DB\uc5d0 work_minutes \ubc18\uc601"')),
		('description="???????? ???? ????????? ?????"', u(r'description="\uc9c0\uc815 \uc2dc \ud574\ub2f9 \uc9c1\uc6d0\ub9cc \uc7ac\uacc4\uc0b0 (\uc120\ud0dd)"')),
		('description="?? ? ?? ??? ??? (??)"', u(r'description="\uc9c0\uc815 \uc2dc \ud574\ub2f9 \uc9c1\uc6d0\ub9cc \uc7ac\uacc4\uc0b0 (\uc120\ud0dd)"')),
		('"""[???] ???????? ??? work_minutes ??? ??????? ??????????.', u(r'"""[\uad00\ub9ac\uc790] \uae30\uac04 \ub0b4 \uadfc\ud0dc work_minutes \uc77c\uad04 \uc7ac\uacc4\uc0b0 (\uad00\ub9ac\uc790 \uc804\uc6a9).')),
		('"""[???] ?? ? ?? work_minutes ?? ??? (??? ??).', u(r'"""[\uad00\ub9ac\uc790] \uae30\uac04 \ub0b4 \uadfc\ud0dc work_minutes \uc77c\uad04 \uc7ac\uacc4\uc0b0 (\uad00\ub9ac\uc790 \uc804\uc6a9).')),
		('???? dry_run=true ????? `changes`?????????????dry_run=false????? ????????', u(r'\uae30\ubcf8 dry_run=true \ub85c `changes`\ub9cc \ubc18\ud658\ud558\uace0, dry_run=false \uc77c \ub54c DB \ubc18\uc601.')),
		('?? dry_run=true ? `changes`? ????, dry_run=false ? ? DB ??.', u(r'\uae30\ubcf8 dry_run=true \ub85c `changes`\ub9cc \ubc18\ud658\ud558\uace0, dry_run=false \uc77c \ub54c DB \ubc18\uc601.')),
	],
}


def main() -> None:
	for rel, content in FILES.items():
		(ROOT / rel).write_text(content, encoding="utf-8")
		print("rewrote:", rel)

	for rel, pairs in PATCHES.items():
		path = ROOT / rel
		text = path.read_text(encoding="utf-8")
		orig = text
		for old, new in pairs:
			text = text.replace(old, new)
		if text != orig:
			path.write_text(text, encoding="utf-8")
			print("patched:", rel)
		else:
			print("no change:", rel)


if __name__ == "__main__":
	main()
