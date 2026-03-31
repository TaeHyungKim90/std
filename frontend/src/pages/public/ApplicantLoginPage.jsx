import React, { useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi';
import { PATHS } from 'constants/paths';

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
					formatApiDetail(error) ||
					'이메일 또는 비밀번호가 일치하지 않습니다.'
			}
		).then((res) => {
			// 성공 시: 쿠키(applicantToken) 발급이 되었는지 /me로 재확인 후 세션 저장
			recruitmentApi.getApplicantMe().then((meRes) => {
				const me = meRes?.data;
				if (!me?.isLoggedIn) throw new Error('지원자 세션 확인에 실패했습니다.');
				sessionStorage.setItem('applicant_user', JSON.stringify(me));
				const returnUrl = location.state?.returnUrl || PATHS.CAREERS;
				navigate(returnUrl, { replace: true, state: location.state });
			}).catch(() => {
				// 쿠키 발급이 막혔거나(브라우저 설정) CORS/credentials 이슈 등
				sessionStorage.removeItem('applicant_user');
				Notify.toastError('로그인 세션을 생성하지 못했습니다. (쿠키 설정을 확인해 주세요)');
			});
		}).catch((error) => {
			// 실패 시 조용히 콘솔 로그만
			console.error("로그인 에러:", error);
		});
	};

	return (
		<div className="careers-content-wrapper auth-center-wrapper"> 
			<div className="glass-box auth-glass-box">
				<h2>가치플레이 지원자 로그인</h2>
				
				<form onSubmit={handleLoginSubmit} className="applicant-login__form">
					<input 
						type="email" 
						placeholder="이메일 입력" 
						required 
						value={loginForm.email_id} 
						onChange={(e) => setLoginForm({...loginForm, email_id: e.target.value})} 
						className="applicant-login__input"
					/>
					<input 
						type="password" 
						placeholder="비밀번호" 
						required 
						value={loginForm.password} 
						onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} 
						className="applicant-login__input"
					/>
					
					<button type="submit" className="applicant-login__submit">
						로그인
					</button>
				</form>
				
				<div className="applicant-login__footer">
					아직 계정이 없으신가요? &nbsp;
					<Link to={PATHS.CAREERS_SIGNUP} className="applicant-login__footer-link">회원가입</Link>
				</div>
			</div>
		</div>
	);
};

export default ApplicantLoginPage;
