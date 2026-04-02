import 'assets/css/loginView.css';

import { Outlet } from 'react-router-dom';

/** 로그인·회원가입 등 인증 화면 공통 스타일을 한 번만 로드합니다. */
const AuthLayout = () => <Outlet />;

export default AuthLayout;
