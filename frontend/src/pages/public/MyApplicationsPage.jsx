import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { useNavigate } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi';
import { formatDate } from 'utils/commonUtils';

const STATUS_MAP = {
	'applied': { text: '📄 서류 접수', color: '#4A90E2', bg: '#EFF6FF' },
	'document_passed': { text: '✅ 서류 합격', color: '#F39C12', bg: '#FEF9C3' },
	'interviewing': { text: '🗣️ 면접 진행', color: '#9B59B6', bg: '#F3E8FF' },
	'final_passed': { text: '🎉 최종 합격', color: '#3DAF7A', bg: '#DCFCE7' },
	'rejected': { text: '❌ 불합격', color: '#FF6A3D', bg: '#FEE2E2' }
};

const MyApplicationsPage = () => {
	const navigate = useNavigate();
	const [applications, setApplications] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loggedInUser, setLoggedInUser] = useState(null);

	useEffect(() => {
		const userStr = sessionStorage.getItem('applicant_user');
		if (!userStr) {
			Notify.toastWarn("로그인이 필요한 서비스입니다.");
			navigate('/careers/login', { replace: true });
			return;
		}

		const user = JSON.parse(userStr);
		setLoggedInUser(user);

		const fetchMyApps = async () => {
			try {
				const res = await recruitmentApi.getMyApplications(user.id);
				setApplications(res.data || res);
			} catch (error) {
				console.error("지원 내역 로드 실패", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchMyApps();
	}, [navigate]);

	const handleCancelApplication = async (applicationId) => {
		if (!window.confirm("정말 지원을 취소하시겠습니까?\n취소된 내역은 복구할 수 없습니다.")) return;

		try {
			await recruitmentApi.cancelApplication(loggedInUser.id, applicationId);
			Notify.toastSuccess("지원이 성공적으로 취소되었습니다.");
			setApplications(prev => prev.filter(app => app.id !== applicationId));
		} catch (error) {
			Notify.toastError(error.response?.data?.detail || "지원 취소 중 오류가 발생했습니다.");
		}
	};

	if (isLoading) return <div style={{ padding: '50px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</div>;

	return (
		<div className="careers-content-wrapper" style={{ maxWidth: '850px' }}>
			<div className="glass-box" style={{ padding: '40px' }}>
				<h2 style={{ fontSize: '2.2rem', margin: '0 0 10px 0', color: '#111', fontWeight: '800' }}>내 지원 내역</h2>
				<p style={{ color: '#444', marginBottom: '40px', fontSize: '1.05rem', fontWeight: '500' }}>
					{loggedInUser?.name}님이 Gachi와 함께한 여정입니다.
				</p>

				{applications.length === 0 ? (
					<div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px dashed rgba(0,0,0,0.1)' }}>
						<div style={{ fontSize: '3rem', marginBottom: '15px' }}>📝</div>
						<h3 style={{ color: '#333', marginBottom: '10px' }}>아직 지원한 내역이 없습니다.</h3>
						<p style={{ color: '#666', marginBottom: '25px' }}>지금 바로 Gachi의 새로운 포지션에 도전해 보세요!</p>
						<button onClick={() => navigate('/careers')} style={{ padding: '12px 24px', background: '#3FAF7A', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
							채용 공고 보러가기
						</button>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
						{applications.map(app => {
							const statusInfo = STATUS_MAP[app.status] || { text: '알 수 없음', color: '#666', bg: '#f3f4f6' };
							
							return (
								<div key={app.id} className="my-app-card">
									<div>
										<h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: '#111', fontWeight: '700' }}>{app.job_title}</h3>
										<p style={{ margin: 0, fontSize: '0.95rem', color: '#555', fontWeight: '500' }}>
											지원 일자: {formatDate(app.applied_at)}
										</p>
									</div>
									<div style={{ textAlign: 'right' }}>
										<div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontWeight: '800', fontSize: '0.95rem', color: statusInfo.color, backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.color}33` }}>
											{statusInfo.text}
										</div>
										
										{app.status === 'applied' && (
											<div style={{ marginTop: '12px' }}>
												<button 
													onClick={() => handleCancelApplication(app.id)}
													style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.8)', border: '1px solid #ff4d4f', color: '#ff4d4f', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
													onMouseOver={(e) => { e.currentTarget.style.background = '#ff4d4f'; e.currentTarget.style.color = '#fff'; }}
													onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.color = '#ff4d4f'; }}
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