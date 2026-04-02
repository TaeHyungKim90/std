import SignupForm from 'components/auth/SignupForm';
import React from 'react';

const SignupView = () => {
  return (
	// 로그인 페이지와 동일한 글래스모피즘 배경 클래스 사용
	<div className="bq-login-view-container">
		<SignupForm />
	</div>
  );
};

export default SignupView;