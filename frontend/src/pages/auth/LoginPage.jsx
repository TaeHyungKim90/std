// src/pages/auth/LoginView.jsx (수정된 소스)
import React from 'react';
import LoginForm from 'components/auth/LoginForm';
import 'assets/css/loginView.css';
const LoginView = () => {
	const handleTestBridge = () => {
		// 1. 현재 이 화면이 스마트폰 앱(WebView) 안에서 열렸는지 확인합니다.
		if (window.ReactNativeWebView) {
		  // 2. 앱 안이라면, 네이티브 쪽으로 메시지를 던집니다!
		  window.ReactNativeWebView.postMessage(
			JSON.stringify({ 
			  type: 'HELLO_NATIVE', 
			  payload: '마스터님, 프론트엔드 통신 연결 성공입니다! 🎉' 
			})
		  );
		} else {
		  // 3. 그냥 PC 크롬 브라우저에서 열었을 때
		  //alert("지금은 일반 웹 브라우저 환경입니다. 스마트폰 앱에서 눌러주세요!");
		}
	  };
  return (
	<div className="bq-login-view-container">
		{/* ✅ 로고 영역 */}
		{/* <div className="bq-login-logo-area">
			<h1 className="bq-login-logo-title">가치플레이</h1>
			<div className="bq-login-logo-subtitle">vlaueplay System</div>
		</div> */}
		<div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <button 
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
        </div>
		{/* 로그인 폼 컴포넌트 */}
		<LoginForm />
	</div>
  );
};


export default LoginView;