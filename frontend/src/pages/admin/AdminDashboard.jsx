import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import '../../assets/css/admin.css';
import '../../assets/css/adminDashboard.css'; // ✅ 새로 분리된 CSS 임포트

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);

    // 실제 데이터 상태
    const [summary, setSummary] = useState({
        user_count: 0,
        vacation_count: 0,
        category_count: 0,
        today_vacations: []
    });

    // 가짜 테스트 데이터 상태 (연차 현황용)
    const [employeeBalances, setEmployeeBalances] = useState([]);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                setLoading(true);
                // 1. 실제 백엔드 API 호출 (KPI 및 이달의 휴가자)
                const res = await adminApi.getDashboard();
                setSummary({
                    user_count: res.data.user_count,
                    vacation_count: res.data.vacation_count,
                    category_count: res.data.category_count,
                    today_vacations: res.data.today_vacations || []
                });

                // 3. 백엔드에서 받아온 [전 직원 연차 현황] 세팅!
                setEmployeeBalances(res.data.employee_balances || []);

            } catch (err) {
                console.error("관리자 대시보드 데이터 로드 실패", err);
            } finally {
                setLoading(false);
            }
        };
        loadDashboardData();
    }, []);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    };

    // 상태에 따라 CSS 클래스를 반환하도록 수정
    const getVacationStatus = (start, end) => {
        const today = new Date().toISOString().split('T')[0];
        const s = start.split('T')[0];
        const e = end.split('T')[0];
        
        if (e < today) return { label: '종료됨', className: 'status-tag status-past', bg: '#f1f3f5', color: '#999' };
        if (s <= today && e >= today) return { label: '휴가 중', className: 'status-tag status-now', bg: '#fff0eb', color: '#FF6A3D' };
        return { label: '예정됨', className: 'status-tag status-future', bg: '#e8f5e9', color: '#3DAF7A' };
    };

    const getInitials = (name) => (name ? name.charAt(0) : '👤');

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '100px', color: '#888' }}>대시보드 데이터를 불러오는 중입니다...</div>;
    }

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>📊 <span>인사 관리</span> 종합 현황판</h2>
                <p>시스템 전체 현황과 임직원 근태를 한눈에 파악하고 빠르게 관리하세요.</p>
            </div>

            {/* 1. KPI 지표 (실제 API 데이터) */}
            <div className="hr-stats-grid">
                <div className="mgmt-section" style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem', marginBottom: '10px' }}>총 임직원</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {summary.user_count || 0}<span style={{ fontSize: '1.2rem', color: '#888', marginLeft: '5px' }}>명</span>
                    </div>
                </div>
                <div className="mgmt-section" style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem', marginBottom: '10px' }}>진행중인 휴가</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {summary.vacation_count || 0}<span style={{ fontSize: '1.2rem', color: '#888', marginLeft: '5px' }}>건</span>
                    </div>
                </div>
                <div className="mgmt-section" style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem', marginBottom: '10px' }}>운영 카테고리</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {summary.category_count || 0}<span style={{ fontSize: '1.2rem', color: '#888', marginLeft: '5px' }}>개</span>
                    </div>
                </div>
                <div className="mgmt-section" style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--text-dim)', fontSize: '1rem', marginBottom: '10px' }}>시스템 상태</h3>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4A90E2', marginTop: '10px' }}>
                        🟢 정상 가동중
                    </div>
                </div>
            </div>

            {/* 2. 메인 콘텐츠 (좌: 실제 휴가자 / 우: 테스트 연차 현황) */}
            <div className="hr-content-row">
                
                {/* 패널 A: 현재 휴가자 현황 (Real Data) */}
                <div className="hr-widget">
                    <div className="hr-widget-header">
                        <h3>🌴 이달의 휴가자 명단</h3>
                    </div>
                    
                    <div className="hr-list scrollable-list">
                        {summary.today_vacations && summary.today_vacations.length > 0 ? (
                            summary.today_vacations.map((vac) => {
                                const status = getVacationStatus(vac.start_date, vac.end_date);
                                return (
                                    <div key={vac.id} className="hr-list-item">
                                        <div className="user-info">
                                            <div className="user-avatar" style={{ background: status.bg, color: status.color }}>
                                                {getInitials(vac.user_name)}
                                            </div>
                                            <div className="user-details">
                                                <div className="user-name">{vac.user_name}</div>
                                                <div className="user-sub">
                                                    {vac.category || '연차'} · {formatDate(vac.start_date)} ~ {formatDate(vac.end_date)}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={status.className}>{status.label}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>
                                이번 달 예정된 휴가 일정이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* 패널 B: 전 직원 연차 현황 (Mock Data, 스크롤 적용) */}
                <div className="hr-widget">
                    <div className="hr-widget-header">
                        <h3>📊 전 직원 연차 현황</h3>
                        <span style={{ fontSize: '0.85rem', color: '#888', fontWeight: '600' }}>총 {employeeBalances.length}명</span>
                    </div>
                    
                    <div className="hr-list scrollable-list">
                        {employeeBalances.map((emp) => {
                            const useRatio = emp.total_days > 0 ? (emp.used_days / emp.total_days) * 100 : 0;
                            const isWarning = useRatio > 80; // 80% 이상 사용 시 주황색 경고
                            
                            return (
                                <div key={emp.id} className="hr-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                    <div className="progress-text">
                                        <span>{emp.user_name}</span>
                                        <span className="progress-subtext">
                                            잔여 <strong style={{ color: isWarning ? '#FF6A3D' : '#3DAF7A' }}>{emp.remaining_days}</strong> / {emp.total_days}일
                                        </span>
                                    </div>
                                    <div className="progress-container">
                                        <div className="progress-bar-bg">
                                            <div 
                                                className={`progress-bar-fill ${isWarning ? 'warning' : 'normal'}`} 
                                                style={{ width: `${useRatio}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;