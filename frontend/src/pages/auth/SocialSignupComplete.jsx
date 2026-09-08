import { authApi } from 'api/authApi';
import AddressSearchField from 'components/common/AddressSearchField';
import { useLoading } from 'context/LoadingContext';
import { useAppPaths } from 'context/TenantContext';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatApiDetail } from 'utils/formatApiError';
import * as Notify from 'utils/toastUtils';

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SocialSignupComplete = () => {
	const paths = useAppPaths();
	const navigate = useNavigate();
	const { showLoading, hideLoading } = useLoading();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [providerLabel, setProviderLabel] = useState('소셜');
	const [formData, setFormData] = useState({
		user_name: '',
		user_nickname: '',
		user_phone_number: '',
		birth_date: '',
		address: '',
	});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			showLoading('소셜 가입 정보를 불러오는 중입니다...');
			try {
				const res = await authApi.getSocialSignupTicket();
				if (cancelled) return;
				const data = res.data || {};
				const provider = String(data.provider || '').toLowerCase();
				setProviderLabel(provider === 'naver' ? '네이버' : provider === 'kakao' ? '카카오' : '소셜');
				setFormData({
					user_name: data.user_name || '',
					user_nickname: data.user_nickname || data.user_name || '',
					user_phone_number: (data.user_phone_number || '').replace(/\D/g, '').slice(0, 11),
					birth_date: data.birth_date || '',
					address: '',
				});
			} catch (err) {
				if (cancelled) return;
				Notify.toastApiFailure(err, '소셜 가입 세션을 확인할 수 없습니다.');
				navigate(paths.SIGNUP, { replace: true });
			} finally {
				if (!cancelled) {
					setLoading(false);
					hideLoading();
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [hideLoading, navigate, paths.SIGNUP, showLoading]);

	const handleChange = (e) => {
		const { name, value } = e.target;
		if (name === 'user_phone_number') {
			setFormData((prev) => ({ ...prev, [name]: value.replace(/[^\d]/g, '').slice(0, 11) }));
			return;
		}
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		if (!formData.user_name.trim()) return setError('이름을 입력해 주세요.');
		if (!formData.birth_date || !BIRTH_DATE_RE.test(formData.birth_date)) {
			return setError('생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.');
		}
		if (!formData.user_phone_number || formData.user_phone_number.length < 10) {
			return setError('전화번호를 숫자만 10~11자리로 입력해 주세요.');
		}
		if (!formData.address || !String(formData.address).trim()) {
			return setError('주소를 검색해 입력해 주세요.');
		}

		showLoading('소셜 회원가입을 완료하는 중입니다...');
		Notify.toastPromise(
			authApi.completeSocialSignup({
				user_name: formData.user_name.trim(),
				user_nickname: formData.user_nickname.trim() || null,
				user_phone_number: formData.user_phone_number,
				birth_date: formData.birth_date,
				address: formData.address.trim(),
			}),
			{
				loading: '가입을 완료하는 중입니다...',
				success: (res) => res?.data?.message || '회원가입이 접수되었습니다.',
				error: (err) => {
					const msg = formatApiDetail(err) || '소셜 회원가입에 실패했습니다.';
					setError(msg);
					return msg;
				},
			}
		)
			.then(() => navigate(paths.LOGIN, { replace: true }))
			.catch(() => {})
			.finally(() => hideLoading());
	};

	if (loading) {
		return (
			<div className="login-container login-container--signup">
				<div className="login-form-stack">
					<h2 className="login-title">소셜 가입 완료</h2>
					<p className="signup-step-note">가입 정보를 불러오는 중입니다...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="login-container login-container--signup">
			<form onSubmit={handleSubmit} className="login-form-stack">
				<h2 className="login-title">{providerLabel} 가입 완료</h2>
				<p className="signup-step-note">
					아이디와 비밀번호는 자동으로 설정됩니다. 이름·생년월일·전화번호·주소를 확인해 주세요.
				</p>

				{error && <p className="error-message">{error}</p>}

				<input
					type="text"
					name="user_name"
					placeholder="이름 (실명)"
					value={formData.user_name}
					onChange={handleChange}
					className="login-input"
					required
				/>
				<input
					type="date"
					name="birth_date"
					value={formData.birth_date}
					onChange={handleChange}
					className="login-input"
					required
					aria-label="생년월일"
					max={new Date().toISOString().slice(0, 10)}
				/>
				<input
					type="text"
					name="user_phone_number"
					placeholder="전화번호 (숫자만)"
					value={formData.user_phone_number}
					onChange={handleChange}
					maxLength="11"
					inputMode="numeric"
					className="login-input"
					required
				/>
				<AddressSearchField
					value={formData.address}
					onChange={(full) => setFormData((prev) => ({ ...prev, address: full }))}
					required
				/>

				<button type="submit" className="login-button">
					가입 완료
				</button>

				<div className="signup-prompt">
					<button type="button" onClick={() => navigate(paths.SIGNUP)} className="signup-link-btn">
						일반 회원가입으로
					</button>
				</div>
			</form>
		</div>
	);
};

export default SocialSignupComplete;
