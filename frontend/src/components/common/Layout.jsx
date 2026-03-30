import React from 'react';
import { Outlet } from 'react-router-dom';
import 'assets/css/header.css';
import Header from './Header'; // 이미 만든 헤더 임포트
import Sidebar from './Sidebar';
const Layout = ({ isLoggedIn, isAdmin, userNickname, isLoggingOut, handleLogout }) => {
  return (
	<div className="bq-layout-wrapper">
	  {/* 1. 상단 공통 헤더 */}
	  <Header 
		isLoggedIn={isLoggedIn} 
		isAdmin={isAdmin} 
		userNickname={userNickname} 
		isLoggingOut={isLoggingOut} 
		handleLogout={handleLogout} 
	  />
	  <div className="bq-layout-body">
		<Sidebar />
		{/* 2. 실제 페이지 콘텐츠 영역 */}
		<main className="bq-main-content">
		  {/* Outlet은 AppRoutes에서 설정한 자식 컴포넌트들이 렌더링되는 자리입니다. */}
		  <Outlet />
		</main>
	  </div>
	  {/* 3. 필요하다면 하단 푸터(Footer)도 여기에 추가 가능 */}
	</div>
  );
};

export default Layout;