from sqlalchemy.orm import Session
from app.models.hr_models import Attendance
from app.models.auth_models import User

def get_all_attendance(db: Session, user_name: str = None, work_date: str = None):
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
    results=query.order_by(Attendance.work_date.desc(), Attendance.clock_in_time.desc()).all()
    return [row._asdict() for row in results]