from sqlalchemy.orm import Session
from models.hr_models import Attendance
from models.auth_models import User

def get_all_attendance(
	db: Session,
	user_name: str = None,
	work_date: str = None,
	skip: int = 0,
	limit: int = 20,
):
	query = db.query(
		Attendance.id,
		Attendance.work_date,
		Attendance.clock_in_time,
		Attendance.clock_out_time,
		Attendance.clock_in_location,
		Attendance.work_minutes,
		User.user_name,
		Attendance.user_id
	).join(User, Attendance.user_id == User.user_login_id)

	if user_name:
		query = query.filter(
			(User.user_name.contains(user_name)) |
			(User.user_login_id.contains(user_name))
		)

	if work_date:
		query = query.filter(Attendance.work_date == work_date)

	total = query.count()
	results = query.order_by(
		Attendance.work_date.desc(),
		Attendance.clock_in_time.desc()
	).offset(skip).limit(limit).all()
	return {"items": [row._asdict() for row in results], "total": total}