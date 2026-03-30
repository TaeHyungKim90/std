// src/components/auth/LoginForm.jsx (수정된 소스)
// 웹 브릿지(WebView ↔ 네이티브) 연결 테스트: 상위 페이지 `pages/auth/LoginPage.jsx`의
// 「앱 브릿지 연결 테스트」 버튼에서 `window.ReactNativeWebView.postMessage` 호출로 검증합니다.
import React, { useState, useContext, useEffect, useRef } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { useNavigate } from 'react-router-dom';
import { authApi } from 'api/authApi'
import { AuthContext } from 'context/AuthContext';
import { useLoading } from 'context/LoadingContext';
import SocialButtons from './SocialButtons';

const LoginForm = () => {
	const [id, setId] = useState('');
	const [pw, setPw] = useState('');
	const [error, setError] = useState('');
	const [showKoreanWarning, setShowKoreanWarning] = useState(false);
	const { isLoggedIn, loading, setIsLoggedIn, setUserRole, setUserName, setUserNickname } = useContext(AuthContext);
	const { showLoading, hideLoading } = useLoading();
	const navigate = useNavigate();
	const timerRef = useRef(null);
	useEffect(() => {
		// 로딩이 끝났고(false), 로그인 상태(true)라면 '/' (또는 '/my/todos') 로 강제 이동
		if (!loading && isLoggedIn) {
			navigate('/');
		}

		// 컴포넌트가 사라질 때(unmount) 실행 중인 타이머가 있다면 제거
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [isLoggedIn, loading, navigate]);
	// ✅ 한글 입력 차단 핸들러
	const handleInputChange = (setter) => (e) => {
		const { value } = e.target;
		// 영문, 숫자, 특수문자만 남기고 한글은 제거
		if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(value)) {
			setShowKoreanWarning(true);

			// 2초 뒤에 경고 메시지 자동으로 숨기기
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				setShowKoreanWarning(false);
			}, 2000);
		}
		const filteredValue = value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
		setter(filteredValue);
	};

	const handleLogin = async (e) => {
		e.preventDefault();
		setError('');
		showLoading("로그인 정보를 검증 중입니다... ⏳");
		Notify.toastPromise(authApi.login(id, pw), {
			loading: '로그인 중입니다...',
			success: '로그인되었습니다.',
			error: (err) => {
				const errMsg =
					formatApiDetail(err.response?.data?.detail) ||
					'로그인 중 오류가 발생했습니다.';
				setError(errMsg);
				return errMsg;
			}
		}).then((res) => {
			const { success, access_token, userId, userNickname, role, userName } = res.data;
			if (success) {
				localStorage.setItem('accessToken', access_token);
				localStorage.setItem('userId', userId);

				setIsLoggedIn(true);
				setUserNickname(userNickname);
				setUserRole(role);
				setUserName(userName);
				navigate('/my/todos');
			}
		}).catch((err) => {
			console.error("로그인 실패:", err);
		}).finally(() => {
			hideLoading();
		});
	};

	return (
		// ✅ login-wrapper를 제거하고 login-container만 남깁니다.
		// 기존의 login-wrapper에 있던 배경색과 꽉 찬 높이가 제거되어 부모의 배경 이미지가 보입니다.
		<div className="login-container">
			<form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
				<h2 className="login-title">LOGIN</h2>
				{error && <p className="error-message">{error}</p>}
				{showKoreanWarning && (
					<p className="korean-warning" style={{
						color: '#ff4d4f',
						fontSize: '12px',
						marginBottom: '5px',
						textAlign: 'center',
						fontWeight: 'bold',
						animation: 'shake 0.2s ease-in-out' // 흔들리는 효과(CSS 필요)
					}}>
						⚠️ 영문 및 숫자만 입력 가능합니다.
					</p>
				)}
				<input
					type="text"				// 브라우저에게 영문 입력을 강력하게 제안
					inputmode="url"			// 모바일 영문 키보드 강제 유도
					spellcheck="false"		// 빨간 밑줄 방지
					autoCapitalize="none"	// 첫 글자 대문자 자동 전환 방지
					placeholder="아이디 (Admin ID)"
					value={id}
					onChange={handleInputChange(setId)} // ✅ 한글 차단 적용
					className="login-input"
					required
					autoComplete="username"
				/>
				<input
					type="password"
					placeholder="비밀번호 (Password)"
					value={pw}
					onChange={handleInputChange(setPw)} // ✅ 한글 차단 적용
					className="login-input"
					required
					autoComplete="current-password"
				/>
				<button type="submit" className="login-button">로그인</button>
				<SocialButtons />
				<div className="signup-prompt">
					계정이 없으신가요?
					<button type="button" onClick={() => navigate('/signup')} className="signup-link-btn">
						회원가입
					</button>
				</div>
			</form>
		</div>
	);
};

export default LoginForm;