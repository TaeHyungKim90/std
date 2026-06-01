import { PlatformAuthContext } from 'context/PlatformAuthContext';
import { PLATFORM_PATHS } from 'constants/platformPaths';
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
			<div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
				<h2 style={{ textAlign: 'center', marginBottom: 8 }}>플랫폼 관리자 로그인</h2>
				<p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 24, fontSize: '0.95rem' }}>
					테넌트 HR 경로와 별도 (/platform)
				</p>
				<form onSubmit={handleSubmit} className="category-add-box" style={{ flexDirection: 'column', gap: 12 }}>
					<input
						type="text"
						className="cat-input"
						placeholder="플랫폼 관리자 ID"
						value={loginId}
						onChange={(e) => setLoginId(e.target.value)}
						autoComplete="username"
					/>
					<input
						type="password"
						className="cat-input"
						placeholder="비밀번호"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
					/>
					<button type="submit" className="btn-add" disabled={submitting}>
						로그인
					</button>
				</form>
			</div>
		</div>
	);
};

export default PlatformLogin;
