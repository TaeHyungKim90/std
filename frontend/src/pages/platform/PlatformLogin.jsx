import 'assets/css/loginView.css';
import 'assets/css/platform.css';

import { PLATFORM_PATHS } from 'constants/platformPaths';
import { PlatformAuthContext } from 'context/PlatformAuthContext';
import React, { useContext, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as Notify from 'utils/toastUtils';

const PlatformLogin = () => {
	const { isLoggedIn, loading, login } = useContext(PlatformAuthContext);
	const navigate = useNavigate();
	const [loginId, setLoginId] = useState('');
	const [password, setPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);

	if (!loading && isLoggedIn) {
		return <Navigate to={PLATFORM_PATHS.TENANTS} replace />;
	}

	const handleSubmit = async (e) => {
		e.preventDefault();
		const id = loginId.trim();
		if (!id || !password) {
			return Notify.toastWarn('아이디와 비밀번호를 입력해 주세요.');
		}
		setSubmitting(true);
		try {
			await Notify.toastPromise(login(id, password), {
				loading: '플랫폼 로그인 중...',
				success: '로그인되었습니다.',
				error: (err) => err?.message || '로그인에 실패했습니다.',
			});
			navigate(PLATFORM_PATHS.TENANTS, { replace: true });
		} catch (err) {
			Notify.toastApiFailure(err, '로그인에 실패했습니다.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="bq-login-view-container">
			<div className="login-container login-container--platform">
				<form onSubmit={handleSubmit} className="login-form-stack">
					<h2 className="login-title">플랫폼 로그인</h2>
					<input
						type="text"
						className="login-input"
						placeholder="플랫폼 관리자 ID"
						value={loginId}
						onChange={(e) => setLoginId(e.target.value)}
						autoComplete="username"
						required
					/>
					<input
						type="password"
						className="login-input"
						placeholder="비밀번호"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
						required
					/>
					<button type="submit" className="login-button" disabled={submitting}>
						{submitting ? '로그인 중...' : '로그인'}
					</button>
				</form>
			</div>
		</div>
	);
};

export default PlatformLogin;
