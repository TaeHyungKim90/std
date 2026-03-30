import React, { useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi'; 

const ApplicantLoginPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [loginForm, setLoginForm] = useState({ email_id: '', password: '' });

	const handleLoginSubmit = async (e) => {
		e.preventDefault();
	
		// 🌟 try ~ catch 날려버리고 깔끔하게 처리!
		Notify.toastPromise(
			recruitmentApi.loginApplicant(loginForm), // 1. 실행할 로그인 API
			{
				loading: '로그인 중입니다...', // 🌀 로딩
				success: (res) => `${res.data.name}님 환영합니다! 🎉`, 
				error: (error) =>
					formatApiDetail(error.response?.data?.detail) ||
					'이메일 또는 비밀번호가 일치하지 않습니다.'
			}
		).then((res) => {
			// 성공 시 실행할 후속 작업 (세션 저장 및 페이지 이동)
			if (res && res.data) {
				sessionStorage.setItem('applicant_user', JSON.stringify(res.data));
				const returnUrl = location.state?.returnUrl || '/careers';
				navigate(returnUrl, { replace: true, state: location.state });
			}
		}).catch((error) => {
			// 실패 시 조용히 콘솔 로그만
			console.error("로그인 에러:", error);
		});
	};

	return (
		<div className="careers-content-wrapper auth-center-wrapper"> 
			<div className="glass-box auth-glass-box">
				<h2>가치플레이 지원자 로그인</h2>
				
				<form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
					<input 
						type="email" 
						placeholder="이메일 입력" 
						required 
						value={loginForm.email_id} 
						onChange={(e) => setLoginForm({...loginForm, email_id: e.target.value})} 
						style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', fontSize: '1rem', background: 'rgba(255,255,255,0.9)' }}
					/>
					<input 
						type="password" 
						placeholder="비밀번호" 
						required 
						value={loginForm.password} 
						onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} 
						style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', fontSize: '1rem', background: 'rgba(255,255,255,0.9)' }} 
					/>
					
					<button type="submit" style={{ padding: '15px', background: '#3FAF7A', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'all 0.2s' }}>
						로그인
					</button>
				</form>
				
				<div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.95rem', color: '#444' }}>
					아직 계정이 없으신가요? &nbsp;
					<Link to="/careers/signup" style={{ color: '#3FAF7A', textDecoration: 'none', fontWeight: 'bold' }}>회원가입</Link>
				</div>
			</div>
		</div>
	);
};

export default ApplicantLoginPage;