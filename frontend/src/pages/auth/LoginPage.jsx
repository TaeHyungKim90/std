// src/pages/auth/LoginView.jsx (수정된 소스)
import React from 'react';
import LoginForm from 'components/auth/LoginForm';

/**
 * 로그인 화면
 * - 아래「웹 브릿지 연결 테스트」: 모바일 앱(WebView) 주입 시 `window.ReactNativeWebView` 존재 여부 및
 *   `postMessage`로 네이티브와 통신이 되는지 개발/검증용으로 사용합니다. 일반 브라우저에서는 동작 없음.
 */
const LoginView = () => {
	const handleTestBridge = () => {
		// 웹 브릿지 연결 테스트: RN WebView에서 주입하는 전역 객체 확인
		if (window.ReactNativeWebView) {
			window.ReactNativeWebView.postMessage(
				JSON.stringify({
					type: 'HELLO_NATIVE',
					payload: '마스터님, 프론트엔드 통신 연결 성공입니다! 🎉'
				})
			);
		}
		// else: 일반 데스크톱 브라우저 — ReactNativeWebView 없음, 별도 알림 없음
	};
	return (
	<div className="bq-login-view-container">
		{/* ✅ 로고 영역 */}
		{/* <div className="bq-login-logo-area">
			<h1 className="bq-login-logo-title">가치플레이</h1>
			<div className="bq-login-logo-subtitle">vlaueplay System</div>
		</div> */}
		{/* 웹 브릿지 연결 테스트 (WebView 앱 전용) */}
		{/* <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <button 
				type="button"
                onClick={handleTestBridge}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#FF3B30',
                    color: '#FFF',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
            >
                📱 앱 브릿지 연결 테스트 🚀
            </button>
        </div> */}
		{/* 로그인 폼 컴포넌트 */}
		<LoginForm />
	</div>
  );
};


export default LoginView;