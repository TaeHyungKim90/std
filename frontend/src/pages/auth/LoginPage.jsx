// src/pages/auth/LoginView.jsx (수정된 소스)
import React from 'react';
import LoginForm from 'components/auth/LoginForm';
import 'assets/css/loginView.css';
const LoginView = () => {
  return (
	<div className="bq-login-view-container">
		{/* ✅ 로고 영역 */}
		{/* <div className="bq-login-logo-area">
			<h1 className="bq-login-logo-title">가치플레이</h1>
			<div className="bq-login-logo-subtitle">vlaueplay System</div>
		</div> */}
		
		{/* 로그인 폼 컴포넌트 */}
		<LoginForm />
	</div>
  );
};


export default LoginView;