import { recruitmentApi } from 'api/recruitmentApi';
import PrivacyPolicyConsent from 'components/common/PrivacyPolicyConsent';
import { useAppPaths } from 'context/TenantContext';
import React, { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { formatApiDetail } from 'utils/formatApiError';
import * as Notify from 'utils/toastUtils';

const ApplicantSignupPage = () => {
	const paths = useAppPaths();
	const navigate = useNavigate();
	const [form, setForm] = useState({ email_id: '', password: '', name: '', phone: '' });
	const [agreed, setAgreed] = useState(false); 
	const [policyAccepted, setPolicyAccepted] = useState(false);

	const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = async (e) => {
		e.preventDefault();
	
		if (!policyAccepted) {
			Notify.toastWarn("개인정보처리방침 동의 후 회원가입을 진행해 주세요.");
			return; 
		}	
	
		// 🌟 try ~ catch 삭제하고 toastPromise 하나로 끝내기!
		Notify.toastPromise(
			recruitmentApi.signupApplicant(form), // 1. 실행할 API 함수 (await 빼고 넣습니다)
			{
				loading: '회원가입을 처리하고 있습니다...', // 🌀 로딩 메시지
				success: '회원가입이 완료되었습니다! 로그인해 주세요. 🎉', // 🟢 성공 메시지
				error: (err) =>
					`회원가입 실패: ${formatApiDetail(err) || '알 수 없는 오류가 발생했습니다.'}` // 🔴 실패 메시지
			}
		).then(() => {
			// 성공했을 때만 로그인 페이지로 이동!
			navigate(paths.CAREERS_LOGIN);		  
		}).catch((error) => {
			// API 통신 실패 시 콘솔에 로그만 조용히 남김 (에러 토스트는 이미 떴음)
			console.error("회원가입 에러:", error);
		});
	};

	if (!policyAccepted) {
		return (
			<div className="careers-content-wrapper auth-center-wrapper">
				<div className="glass-box auth-glass-box applicant-signup__glass">
					<h2>가입 약관 동의</h2>
					<p className="applicant-signup__step-note">
						지원자 회원가입 전에 개인정보처리방침을 먼저 확인해 주세요.
					</p>
					<PrivacyPolicyConsent checked={agreed} onChange={setAgreed} className="privacy-consent--careers" />
					<button
						type="button"
						className="applicant-signup__submit"
						disabled={!agreed}
						onClick={() => setPolicyAccepted(true)}
					>
						동의
					</button>
					<div className="applicant-signup__footer">
						이미 계정이 있으신가요? <Link to={paths.CAREERS_LOGIN} className="applicant-signup__login-link">로그인하기</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="careers-content-wrapper auth-center-wrapper">
			<div className="glass-box auth-glass-box applicant-signup__glass">
				<h2>지원자 회원가입</h2>
				<form onSubmit={handleSubmit} className="applicant-signup__form">
					<input type="text" name="name" placeholder="이름" required onChange={handleChange} className="applicant-signup__input" />
					<input type="email" name="email_id" placeholder="이메일" required onChange={handleChange} className="applicant-signup__input" />
					<input type="password" name="password" placeholder="비밀번호" required onChange={handleChange} className="applicant-signup__input" />
					<input type="tel" name="phone" placeholder="연락처 (010-0000-0000)" required onChange={handleChange} className="applicant-signup__input" />
					
					<button type="submit" className="applicant-signup__submit">
						가입하기
					</button>
				</form>
				<div className="applicant-signup__footer">
					이미 계정이 있으신가요? <Link to={paths.CAREERS_LOGIN} className="applicant-signup__login-link">로그인하기</Link>
				</div>
			</div>
		</div>
	);
};

export default ApplicantSignupPage;
