// src/pages/auth/LoginView.jsx (수정된 소스)
import React from 'react';
import LoginForm from 'components/auth/LoginForm';

/**
 * 로그인 화면
 * - 아래 주석 처리된「웹 브릿지 연결 테스트」: 모바일 앱(WebView)에서 `window.ReactNativeWebView.postMessage` 검증용.
 *   버튼을 다시 쓸 때는 핸들러를 복원하세요.
 */
const LoginView = () => {
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