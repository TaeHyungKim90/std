import React, { useState, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { useNavigate } from 'react-router-dom';
import { authApi } from 'api/authApi';
import { useLoading } from 'context/LoadingContext';
import SocialButtons from './SocialButtons';

const SignupForm = () => {
	const navigate = useNavigate();
	const { showLoading, hideLoading } = useLoading();

	const [formData, setFormData] = useState({
		user_login_id: '',
		user_password: '',
		password_confirm: '',
		user_name: '',
		user_nickname: '',
		user_phone_number: ''
	});

	const [error, setError] = useState('');
	// 아이디 중복 확인 상태 (null: 확인 전, 'available': 가능, 'duplicate': 중복)
	const [idStatus, setIdStatus] = useState(null);

	// ✅ 한글 입력 차단 (아이디, 비밀번호 전용)
	const handleNoKoreanChange = (e) => {
		const { name, value } = e.target;
		const filteredValue = value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
		setFormData(prev => ({ ...prev, [name]: filteredValue }));

		if (name === 'user_login_id') setIdStatus(null);
	};

	// ✅ 일반 입력 핸들러 (전화번호 특수 처리 포함)
	const handleChange = (e) => {
		const { name, value } = e.target;
		if (name === 'user_phone_number') {
			const onlyNums = value.replace(/[^\d]/g, '').slice(0, 11);
			setFormData(prev => ({ ...prev, [name]: onlyNums }));
			return;
		}
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	// ✅ 아이디 중복 확인
	const handleCheckId = useCallback(async () => {
		if (!formData.user_login_id) return Notify.toastWarn('아이디를 먼저 입력해 주세요.');

		showLoading("아이디 중복 여부를 확인 중입니다... ⏳");
		Notify.toastPromise(authApi.checkId(formData.user_login_id), {
			loading: '아이디 중복을 확인하는 중입니다...',
			success: '아이디 중복 확인이 완료되었습니다.',
			error: '중복 확인 중 오류가 발생했습니다.'
		}).then((res) => {
			setIdStatus(res.data.available ? 'available' : 'duplicate');
		}).catch((err) => {
			console.error("중복 확인 실패:", err);
		}).finally(() => {
			hideLoading();
		});
	}, [formData.user_login_id, showLoading, hideLoading]);

	// ✅ 회원가입 실행
	const handleSignup = useCallback(async (e) => {
		e.preventDefault();
		setError('');

		if (idStatus !== 'available') return setError('아이디 중복 확인을 진행해 주세요.');
		if (formData.user_password !== formData.password_confirm) return setError('비밀번호가 일치하지 않습니다.');

		showLoading("회원가입 정보를 등록 중입니다... ⏳");
		const signupTask = async () => {
			const { password_confirm, ...submitData } = formData;
			return authApi.signup(submitData);
		};
		Notify.toastPromise(signupTask(), {
			loading: '회원가입 처리 중입니다...',
			success: '회원가입이 완료되었습니다. 로그인해 주세요.',
			error: (err) => {
				const errMsg =
					formatApiDetail(err.response?.data?.detail) ||
					'회원가입 중 오류가 발생했습니다.';
				setError(errMsg);
				return errMsg;
			}
		}).then(() => {
			navigate('/login');
		}).catch((err) => {
			console.error("회원가입 실패:", err);
		}).finally(() => {
			hideLoading();
		});
	}, [formData, idStatus, navigate, showLoading, hideLoading]);

	const isPasswordMatching = formData.user_password && formData.password_confirm && formData.user_password === formData.password_confirm;

	return (
		<div className="login-container">
			<form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column' }}>
				<h2 className="login-title">SIGN UP</h2>

				{error && <p className="error-message">{error}</p>}

				<div className="input-group">
					<input
						type="text"
						name="user_login_id"
						placeholder="아이디 (영문/숫자)"
						value={formData.user_login_id}
						onChange={handleNoKoreanChange}
						className="login-input"
						required
					/>
					<button type="button" onClick={handleCheckId} className="btn-check-id">중복 확인</button>
				</div>

				{idStatus === 'available' && <div className="status-message" style={{ color: '#3DAF7A' }}>✅ 사용 가능한 아이디입니다.</div>}
				{idStatus === 'duplicate' && <div className="status-message" style={{ color: '#FF6A3D' }}>❌ 이미 사용 중인 아이디입니다.</div>}

				<input type="password" name="user_password" placeholder="비밀번호" value={formData.user_password} onChange={handleNoKoreanChange} className="login-input" required />
				<input type="password" name="password_confirm" placeholder="비밀번호 확인" value={formData.password_confirm} onChange={handleNoKoreanChange} className="login-input" required style={{ marginBottom: isPasswordMatching ? '5px' : '15px' }} />

				{isPasswordMatching && <div className="status-message" style={{ color: '#3DAF7A' }}>✅ 비밀번호가 일치합니다.</div>}

				<input type="text" name="user_name" placeholder="이름 (실명)" value={formData.user_name} onChange={handleChange} className="login-input" required />
				<input type="text" name="user_nickname" placeholder="닉네임" value={formData.user_nickname} onChange={handleChange} className="login-input" required />
				<input type="text" name="user_phone_number" placeholder="전화번호 (숫자만)" value={formData.user_phone_number} onChange={handleChange} maxLength="11" inputMode="numeric" className="login-input" required />

				<button type="submit" className="login-button">가입하기</button>

				<SocialButtons />

				<div className="signup-prompt">
					이미 계정이 있으신가요?
					<button type="button" onClick={() => navigate('/login')} className="signup-link-btn">로그인하기</button>
				</div>
			</form>
		</div>
	);
};

export default SignupForm;