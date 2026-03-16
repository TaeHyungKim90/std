import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/css/admin.css';
import { adminService } from '../../services/adminService';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({ user_count: 0, vacation_count: 0, category_count: 0 });

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const res = await adminService.getDashboard();
                console.log(res.data);
                setSummary(res.data);
            } catch (err) {
                console.error("관리자 데이터 로드 실패", err);
            }
        };
        loadDashboardData();
    }, []);

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>⚙️ <span>관리자</span> 대시보드</h2>
                <p>시스템 전체 현황을 파악하고 사용자를 관리합니다.</p>
            </div>

            {/* 상단 통계 카드 (Glassmorphism 적용) */}
            <div className="admin-stats-row">
                <div className="stat-card">
                    <span className="label">전체 사용자</span>
                    <span className="value">{summary.user_count || 0}명</span>
                </div>
                <div className="stat-card">
                    <span className="label">등록된 카테고리</span>
                    <span className="value">{summary.category_count || 0}건</span>
                </div>
                <div className="stat-card">
                    <span className="label">등록된 휴가 일정</span>
                    <span className="value">{summary.vacation_count || 0}건</span>
                </div>
            </div>

            {/* 관리 섹션 (최신 트렌드: 클릭형 전체 카드 인터랙션) */}
            <div className="admin-management-grid">
                <div className="mgmt-action-card" onClick={() => navigate('/admin/users')}>
                    <div className="card-icon">👤</div>
                    <div className="card-content">
                        <h3>사용자 관리</h3>
                        <p>사용자 목록 조회 및 권한 편집</p>
                    </div>
                </div>

                <div className="mgmt-action-card" onClick={() => navigate('/admin/categories')}>
                    <div className="card-icon">🏷️</div>
                    <div className="card-content">
                        <h3>카테고리 관리</h3>
                        <p>분류 목록 조회 및 이모지 편집</p>
                    </div>
                </div>

                <div className="mgmt-action-card" onClick={() => navigate('/admin/todos')}>
                    <div className="card-icon">📅</div>
                    <div className="card-content">
                        <h3>일정 모니터링</h3>
                        <p>시스템 전체 일정 로그 확인</p>
                    </div>
                </div>

                <div className="mgmt-action-card" onClick={() => navigate('/admin/attendance')}>
                    <div className="card-icon">⏰</div>
                    <div className="card-content">
                        <h3>출퇴근 관리</h3>
                        <p>전체 사용자의 출퇴근 기록 조회</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;