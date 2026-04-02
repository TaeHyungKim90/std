import { adminApi } from 'api/adminApi';
import { useLoading } from 'context/LoadingContext';
import React, { useEffect, useState } from 'react';
import { formatDate } from 'utils/commonUtils';
import * as Notify from 'utils/toastUtils';

const AdminDashboard = () => {
	const { showLoading, hideLoading } = useLoading();
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
			setLoading(true);
			showLoading("대시보드 데이터를 불러오는 중입니다... ⏳");
			try {
				const res = await adminApi.getDashboard();
				setSummary({
					user_count: res.data.user_count,
					vacation_count: res.data.vacation_count,
					category_count: res.data.category_count,
					today_vacations: res.data.today_vacations || []
				});
				setEmployeeBalances(res.data.employee_balances || []);
			} catch (err) {
				Notify.toastApiFailure(err, "대시보드 데이터 로드에 실패했습니다.");
			} finally {
				hideLoading();
				setLoading(false);
			}
		};
		loadDashboardData();
	}, [showLoading, hideLoading]);

	// 상태에 따라 CSS 클래스를 반환하도록 수정
	const getVacationStatus = (start, end) => {
		const today = new Date().toLocaleDateString('sv-SE');
		const s = start.split('T')[0];
		const e = end.split('T')[0];
		
		if (e < today) return { label: '종료됨', className: 'status-tag status-past', bg: '#f1f3f5', color: '#999' };
		if (s <= today && e >= today) return { label: '휴가 중', className: 'status-tag status-now', bg: '#fff0eb', color: '#FF6A3D' };
		return { label: '예정됨', className: 'status-tag status-future', bg: 'rgba(63, 175, 122, 0.12)', color: '#3FAF7A' };
	};

	const getInitials = (name) => (name ? name.charAt(0) : '👤');

	if (loading) {
		return <div className="admin-dashboard__loading">대시보드 데이터를 불러오는 중입니다...</div>;
	}

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>📊 <span>인사 관리</span> 종합 현황판</h2>
				<p>시스템 전체 현황과 임직원 근태를 한눈에 파악하고 빠르게 관리하세요.</p>
			</div>

			{/* 1. KPI 지표 (실제 API 데이터) */}
			<div className="hr-stats-grid">
				<div className="mgmt-section mgmt-section--kpi">
					<h3>총 임직원</h3>
					<div className="admin-dashboard__kpi-value">
						{summary.user_count || 0}<span className="admin-dashboard__kpi-suffix">명</span>
					</div>
				</div>
				<div className="mgmt-section mgmt-section--kpi">
					<h3>진행중인 휴가</h3>
					<div className="admin-dashboard__kpi-value admin-dashboard__kpi-value--accent">
						{summary.vacation_count || 0}<span className="admin-dashboard__kpi-suffix">건</span>
					</div>
				</div>
				<div className="mgmt-section mgmt-section--kpi">
					<h3>운영 카테고리</h3>
					<div className="admin-dashboard__kpi-value">
						{summary.category_count || 0}<span className="admin-dashboard__kpi-suffix">개</span>
					</div>
				</div>
				<div className="mgmt-section mgmt-section--kpi">
					<h3>시스템 상태</h3>
					<div className="admin-dashboard__system-status">
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
							summary.today_vacations.map((vac, index) => {
								const status = getVacationStatus(vac.start_date, vac.end_date);
								return (
									<div key={vac.id} className="hr-list-item stagger-item" style={{ animationDelay: `${index * 0.04}s` }}>
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
							<div className="hr-list__empty">
								이번 달 예정된 휴가 일정이 없습니다.
							</div>
						)}
					</div>
				</div>

				{/* 패널 B: 전 직원 연차 현황 (Mock Data, 스크롤 적용) */}
				<div className="hr-widget">
					<div className="hr-widget-header">
						<h3>📊 전 직원 연차 현황</h3>
						<span className="hr-widget-header__meta">총 {employeeBalances.length}명</span>
					</div>
					
					<div className="hr-list scrollable-list">
						{employeeBalances.map((emp, index) => {
							const useRatio = emp.total_days > 0 ? (emp.used_days / emp.total_days) * 100 : 0;
							const isWarning = useRatio > 80; // 80% 이상 사용 시 주황색 경고
							
							return (
								<div key={emp.id} className="hr-list-item hr-list-item--balance stagger-item" style={{ animationDelay: `${index * 0.04}s` }}>
									<div className="progress-text">
										<span>{emp.user_name}</span>
										<span className="progress-subtext">
											잔여 <strong className={isWarning ? 'admin-dashboard__balance-strong--warn' : 'admin-dashboard__balance-strong--ok'}>{emp.remaining_days}</strong> / {emp.total_days}일
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