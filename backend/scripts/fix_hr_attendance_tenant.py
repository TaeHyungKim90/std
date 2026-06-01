"""Re-apply tenant scoping to hr/attendance.py (preserves Korean from git)."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "app" / "api" / "hr" / "attendance.py"
text = path.read_text(encoding="utf-8")

text = text.replace(
	"from db.session import get_db\nfrom services.auth_service import get_current_user",
	"from api.deps import tenant_id_from_user\nfrom db.session import get_db\nfrom services.auth_service import get_current_user_for_tenant",
)
text = text.replace("Depends(get_current_user)", "Depends(get_current_user_for_tenant)")

text = text.replace(
	"\tuser_id = _require_user_id(current_user)\n\treturn service.get_today_or_open_attendance(db, user_id, today_seoul())",
	"\ttid = tenant_id_from_user(current_user)\n\tuser_id = _require_user_id(current_user)\n\treturn service.get_today_or_open_attendance(db, tid, user_id, today_seoul())",
)

text = text.replace(
	"\tuser_id = _require_user_id(current_user)\n\treturn service.get_today_attendance(db, user_id, work_date)",
	"\ttid = tenant_id_from_user(current_user)\n\tuser_id = _require_user_id(current_user)\n\treturn service.get_today_attendance(db, tid, user_id, work_date)",
)

text = text.replace(
	"\tuser_id = _require_user_id(current_user)\n\titems = service.list_attendance_sessions_for_work_date(db, user_id, work_date)",
	"\ttid = tenant_id_from_user(current_user)\n\tuser_id = _require_user_id(current_user)\n\titems = service.list_attendance_sessions_for_work_date(db, tid, user_id, work_date)",
)

text = text.replace(
	"\tuser_id = _require_user_id(current_user)\n\treturn attendance_calendar_service.get_user_monthly_stamps(db, user_id, year, month)",
	"\tuser_id = _require_user_id(current_user)\n\ttid = tenant_id_from_user(current_user)\n\treturn attendance_calendar_service.get_user_monthly_stamps(db, tid, user_id, year, month)",
)

text = text.replace(
	"\tuser_id = _require_user_id(current_user)\n\td = work_date or today_seoul()\n\tctx = service.get_clock_context(db, user_id, d)",
	"\ttid = tenant_id_from_user(current_user)\n\tuser_id = _require_user_id(current_user)\n\td = work_date or today_seoul()\n\tctx = service.get_clock_context(db, tid, user_id, d)",
)

text = text.replace(
	"\tuser_id = _require_user_id(current_user)\n\tname = service.set_user_preferred_work_location(db, user_id, body.location_name)",
	"\ttid = tenant_id_from_user(current_user)\n\tuser_id = _require_user_id(current_user)\n\tname = service.set_user_preferred_work_location(db, tid, user_id, body.location_name)",
)

text = text.replace(
	"\t_require_user_id(current_user)\n\treturn service.get_active_work_locations(db)",
	"\t_require_user_id(current_user)\n\treturn service.get_active_work_locations(db, tenant_id_from_user(current_user))",
)

old_clock_in = """\tuser_id = _require_user_id(current_user)
\tnow = now_seoul_naive()

\treturn service.create_clock_in(
\t\tdb,
\t\tuser_id,"""

new_clock_in = """\ttid = tenant_id_from_user(current_user)
\tuser_id = _require_user_id(current_user)
\tnow = now_seoul_naive()
\treturn service.create_clock_in(
\t\tdb,
\t\ttid,
\t\tuser_id,"""

text = text.replace(old_clock_in, new_clock_in)

old_clock_out = """\tuser_id = _require_user_id(current_user)
\tnow = now_seoul_naive()
\t
\trecord = service.get_open_shift(db, user_id)"""

new_clock_out = """\ttid = tenant_id_from_user(current_user)
\tuser_id = _require_user_id(current_user)
\tnow = now_seoul_naive()

\trecord = service.get_open_shift(db, tid, user_id)"""

text = text.replace(old_clock_out, new_clock_out)

text = text.replace(
	"\treturn service.update_clock_out(\n\t\tdb,\n\t\trecord,",
	"\treturn service.update_clock_out(\n\t\tdb,\n\t\ttid,\n\t\trecord,",
)

path.write_text(text, encoding="utf-8")
print("updated hr/attendance.py", len(text), "bytes")
