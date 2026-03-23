from sqlalchemy.orm import Session
from services.admin import stats_service # 💡 서비스 경로 확인

def get_dashboard_statistics(db: Session):
    # 서비스 레이어의 통계 조회 함수 호출
    return stats_service.get_admin_stats(db)