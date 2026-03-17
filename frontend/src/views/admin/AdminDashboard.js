import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import '../../assets/css/adminDashboard.css';

const AdminDashboard = () => {
    // 1. 초기 상태에 recent_users 배열 추가
    const [summary, setSummary] = useState({
        user_count: 0,
        vacation_count: 0,
        category_count: 0,
        recent_users: [] // 백엔드에서 넘겨줄 최근 가입자 배열
    });
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        // 'T'가 있으면 T로 자르고, 없으면 공백으로 자름
        return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    };
    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                // adminService의 getDashboard API 호출
                const res = await adminService.getDashboard();
                console.log("Dashboard Data:", res.data);
                setSummary(res.data);
            } catch (err) {
                console.error("관리자 대시보드 데이터 로드 실패", err);
            }
        };
        loadDashboardData();
    }, []);
    // 3. 유틸리티: 이름의 첫 글자를 아바타로 사용
    const getVacationStatus = (start, end) => {
    const today = '2026-03-16'; // 시스템 현재 날짜 기준
    const s = start.split('T')[0];
    const e = end.split('T')[0];
    if (e < today) {
        return { label: '사용 완료', className: 'status-past' };
    } else if (s <= today && e >= today) {
        return { label: '휴가 중', className: 'status-now' };
    } else {
        return { label: '휴가 예정', className: 'status-future' };
    }
};
    const getInitials = (name) => (name ? name.charAt(0) : '?');
    return (
        <div className="hr-dashboard-container">
            {/* 상단 헤더 섹션 */}
            <div className="admin-header">
                <h2>📊 <span>인사 관리</span> 현황판</h2>
                <p>시스템 전체 현황과 임직원 활동을 실시간으로 확인합니다.</p>
            </div>

            {/* 주요 지표 (KPI) 카드 섹션 */}
            <div className="hr-stats-grid">
                <div className="hr-stat-card">
                    <span className="label">전체 임직원</span>
                    <span className="value">{summary.user_count || 0}명</span>
                </div>
                <div className="hr-stat-card">
                    <span className="label">금일 휴가 일정</span>
                    <span className="value">{summary.vacation_count || 0}건</span>
                </div>
                <div className="hr-stat-card">
                    <span className="label">등록된 카테고리</span>
                    <span className="value">{summary.category_count || 0}건</span>
                </div>
                
                <div className="hr-stat-card">
                    <span className="label">미정</span>
                    <span className="value" style={{ color: '#FF6A3D' }}>0건</span>
                </div>
            </div>

            {/* 메인 콘텐츠: 최근 가입자 및 시스템 상태 위젯 */}
            <div className="hr-content-row">
                
                {/* 위젯 1: 최근 가입 임직원 리스트 (실제 백엔드 연동) */}
                <div className="hr-widget">
                    <h3>🌴 이번달 휴가자 명단</h3>
                    <div className="hr-list">
                        {summary.today_vacations && summary.today_vacations.length > 0 ? (
                            summary.today_vacations.map((vacation) => {
                                // 현재 행의 상태 정보 가져오기
                                const status = getVacationStatus(vacation.start_date, vacation.end_date);
                                
                                return (
                                    <div className="hr-list-item" key={vacation.id}>
                                        <div className="user-info">
                                            <div 
                                                className="user-avatar" 
                                                style={{ 
                                                    background: status.className === 'status-now' ? '#fff3e0' : '#f4f6f5', 
                                                    color: status.className === 'status-now' ? '#ef6c00' : '#666' 
                                                }}
                                            >
                                                {getInitials(vacation.user_name)}
                                            </div>
                                            <div>
                                                <strong>{vacation.user_name}</strong>
                                                <br />
                                                <small>
                                                    {vacation.category || '연차'} · {formatDate(vacation.start_date)} ~ {formatDate(vacation.end_date)}
                                                </small>
                                            </div>
                                        </div>
                                        {/* 상태에 따라 클래스명과 문구가 동적으로 변경됨 */}
                                        <span className={`status-tag ${status.className}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="no-data-msg">
                                <p style={{ color: '#bbb', padding: '20px 0', textAlign: 'center' }}>
                                    이번 달 휴가 일정이 없습니다.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 위젯 2: 시스템 상태 및 공지 (추후 확장 가능) */}
                <div className="hr-widget">
                    <h3>🔔 시스템 주요 알림</h3>
                    <div className="hr-list">
                        {/* 기능 미구현 상태를 명시적으로 표현 */}
                        <div className="hr-list-item">
                            <span style={{ color: '#999' }}>실시간 알림 서비스 준비 중 (데이터 연동 필요)</span>
                            <small>Pending</small>
                        </div>
                        <div className="hr-list-item">
                            <span style={{ color: '#999' }}>시스템 로그 수집 기능 개발 예정</span>
                            <small>Upcoming</small>
                        </div>
                        <div className="hr-list-item">
                            <span style={{ fontWeight: '600' }}>⚠️ 백엔드 API 서버 연결 대기 중</span>
                            <small style={{ color: '#FF6A3D' }}>확인 필요</small>
                        </div>
                    </div>
                    {/* 나중에 데이터가 없을 때 보여줄 안내 문구를 아래에 살짝 추가해도 좋습니다. */}
                    <p style={{ fontSize: '12px', color: '#bbb', marginTop: '15px', textAlign: 'center' }}>
                        * 현재 알림 기능은 UI 프로토타입 상태입니다.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;