import { recruitmentApi } from 'api/recruitmentApi';
import { PATHS } from 'constants/paths';
import React, { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { formatApiDetail } from 'utils/formatApiError';
import * as Notify from 'utils/toastUtils';

const ApplicantSignupPage = () => {
	const navigate = useNavigate();
	const [form, setForm] = useState({ email_id: '', password: '', name: '', phone: '' });
	const [agreed, setAgreed] = useState(false); 

	const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = async (e) => {
		e.preventDefault();
	
		if (!agreed) {
			Notify.toastWarn("개인정보 수집 및 이용에 동의하셔야 가입이 가능합니다.");
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
			navigate(PATHS.CAREERS_LOGIN);		  
		}).catch((error) => {
			// API 통신 실패 시 콘솔에 로그만 조용히 남김 (에러 토스트는 이미 떴음)
			console.error("회원가입 에러:", error);
		});
	};

	return (
		<div className="careers-content-wrapper auth-center-wrapper">
			<div className="glass-box auth-glass-box applicant-signup__glass">
				<h2>지원자 회원가입</h2>
				<form onSubmit={handleSubmit} className="applicant-signup__form">
					<input type="text" name="name" placeholder="이름" required onChange={handleChange} className="applicant-signup__input" />
					<input type="email" name="email_id" placeholder="이메일" required onChange={handleChange} className="applicant-signup__input" />
					<input type="password" name="password" placeholder="비밀번호" required onChange={handleChange} className="applicant-signup__input" />
					<input type="tel" name="phone" placeholder="연락처 (010-0000-0000)" required onChange={handleChange} className="applicant-signup__input" />
					
					<div className="applicant-signup__terms">
						<label className="applicant-signup__terms-label">
							<input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="applicant-signup__terms-check" />
							<span>
								<strong>[필수] 개인정보 수집 및 이용 동의</strong><br/>
								입사 지원 서비스 제공을 위해 귀하의 개인정보를 수집하며, 수집된 정보는 <b>가입일로부터 2년간 보관</b> 후 지체 없이 파기됩니다.
							</span>
						</label>
					</div>

					<button type="submit" className="applicant-signup__submit">
						동의하고 가입하기
					</button>
				</form>
				<div className="applicant-signup__footer">
					이미 계정이 있으신가요? <Link to={PATHS.CAREERS_LOGIN} className="applicant-signup__login-link">로그인하기</Link>
				</div>
			</div>
		</div>
	);
};

export default ApplicantSignupPage;
