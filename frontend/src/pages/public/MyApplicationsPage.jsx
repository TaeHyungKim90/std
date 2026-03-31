import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { useNavigate } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi';
import { PATHS } from 'constants/paths';
import { formatDate } from 'utils/commonUtils';

const STATUS_MAP = {
	'applied': { text: '📄 서류 접수', color: '#4A90E2', bg: '#EFF6FF' },
	'document_passed': { text: '✅ 서류 합격', color: '#F39C12', bg: '#FEF9C3' },
	'interviewing': { text: '🗣️ 면접 진행', color: '#9B59B6', bg: '#F3E8FF' },
	'final_passed': { text: '🎉 최종 합격', color: '#3DAF7A', bg: '#DCFCE7' },
	'rejected': { text: '❌ 불합격', color: '#FF6A3D', bg: '#FEE2E2' }
};

const MyApplicationsPage = () => {
	const { showLoading, hideLoading } = useLoading();
	const navigate = useNavigate();
	const [applications, setApplications] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loggedInUser, setLoggedInUser] = useState(null);

	useEffect(() => {
		let isMounted = true;

		const resolveApplicantSession = async () => {
			// 1) sessionStorage 우선 사용(UX)
			const userStr = sessionStorage.getItem('applicant_user');
			if (userStr) {
				try {
					const user = JSON.parse(userStr);
					if (isMounted) setLoggedInUser(user);
				} catch {
					sessionStorage.removeItem('applicant_user');
				}
			}

			// 2) 쿠키 기반 세션 확인/복구(보안/정합성)
			try {
				const meRes = await recruitmentApi.getApplicantMe();
				if (meRes?.data?.isLoggedIn) {
					sessionStorage.setItem('applicant_user', JSON.stringify(meRes.data));
					if (isMounted) setLoggedInUser(meRes.data);
					return true;
				}
			} catch {
				// ignore
			}

			// 3) 쿠키 세션이 없으면 로컬도 정리 후 로그인 이동
			sessionStorage.removeItem('applicant_user');
			if (isMounted) {
				Notify.toastWarn("로그인이 필요한 서비스입니다.");
				navigate(PATHS.CAREERS_LOGIN, { replace: true });
			}
			return false;
		};

		const fetchMyApps = async () => {
			const ok = await resolveApplicantSession();
			if (!ok) return;

			showLoading("지원 내역을 불러오는 중입니다... ⏳");
			try {
				const res = await recruitmentApi.getMyApplications();
				setApplications(res.data || res);
			} catch (error) {
				console.error("지원 내역 로드 실패", error);
				Notify.toastError("지원 내역을 불러오지 못했습니다.");
			} finally {
				hideLoading();
				setIsLoading(false);
			}
		};

		fetchMyApps();
		return () => {
			isMounted = false;
		};
	}, [navigate, showLoading, hideLoading]);

	const handleCancelApplication = async (applicationId) => {
		if (!window.confirm("정말 지원을 취소하시겠습니까?\n취소된 내역은 복구할 수 없습니다.")) return;

		Notify.toastPromise(recruitmentApi.cancelApplication(applicationId), {
			loading: '지원을 취소하는 중입니다...',
			success: '지원이 성공적으로 취소되었습니다.',
			error: '지원 취소 중 오류가 발생했습니다.'
		}).then(() => {
			setApplications(prev => prev.filter(app => app.id !== applicationId));
		}).catch((error) => {
			console.error("지원 취소 실패:", error);
		});
	};

	if (isLoading) return <div className="my-applications__loading">데이터를 불러오는 중입니다...</div>;

	return (
		<div className="careers-content-wrapper careers-content-wrapper--narrow">
			<div className="glass-box">
				<h2 className="my-applications__title">내 지원 내역</h2>
				<p className="my-applications__lead">
					{loggedInUser?.name}님이 가치플레이와 함께한 여정입니다.
				</p>

				{applications.length === 0 ? (
					<div className="my-applications__empty">
						<div className="my-applications__empty-icon">📝</div>
						<h3 className="my-applications__empty-title">아직 지원한 내역이 없습니다.</h3>
						<p className="my-applications__empty-desc">지금 바로 가치플레이의 새로운 포지션에 도전해 보세요!</p>
						<button type="button" onClick={() => navigate(PATHS.CAREERS)} className="my-applications__cta">
							채용 공고 보러가기
						</button>
					</div>
				) : (
					<div className="my-applications__list">
						{applications.map((app, index) => {
							const statusInfo = STATUS_MAP[app.status] || { text: '알 수 없음', color: '#666', bg: '#f3f4f6' };
							
							return (
								<div key={app.id} className="my-app-card stagger-item" style={{ animationDelay: `${index * 0.04}s` }}>
									<div>
										<h3 className="my-applications__card-title">{app.job_title}</h3>
										<p className="my-applications__card-date">
											지원 일자: {formatDate(app.applied_at)}
										</p>
									</div>
									<div className="my-applications__card-aside">
										<div
											className="my-applications__status-chip"
											style={{
												color: statusInfo.color,
												backgroundColor: statusInfo.bg,
												border: `1px solid ${statusInfo.color}33`,
											}}
										>
											{statusInfo.text}
										</div>
										
										{app.status === 'applied' && (
											<div className="my-applications__cancel-wrap">
												<button 
													type="button"
													onClick={() => handleCancelApplication(app.id)}
													className="my-applications__cancel-btn"
												>
													지원 취소
												</button>
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};

export default MyApplicationsPage;
