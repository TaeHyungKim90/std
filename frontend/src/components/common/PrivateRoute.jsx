import 'assets/css/privateRoute.css';

import { PATHS } from 'constants/paths';
import { AuthContext } from 'context/AuthContext';
import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import LoadingBar from './LoadingBar';
const PrivateRoute = () => {
  const { isLoggedIn, loading } = useContext(AuthContext);

  // 1. 인증 정보 확인 중일 때는 아무것도 하지 않고 대기 (화면 깜빡임 방지)
  if (loading) {
	return (
		<div className="bq-private-loading-container">
			<LoadingBar /> 
			<p className="bq-private-loading-text">보안 세션 확인 중...</p>
		</div>
	);
  }

  // 2. 로그인 상태면 해당 컴포넌트를 보여주고, 아니면 로그인 페이지(/)로 튕겨냄
  return isLoggedIn ? <Outlet /> : <Navigate to={PATHS.LOGIN} replace />;
};
export default PrivateRoute;