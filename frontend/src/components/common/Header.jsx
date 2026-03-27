// src/components/layout/Header.js
import React, { useContext, useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthContext } from 'context/AuthContext';
import { authApi } from 'api/authApi';
import { MENU_ITEMS } from 'constants/menu';
import logo from 'assets/icon/favicon.png';
import 'assets/css/header.css';

const Header = () => {
	const { isLoggedIn, logout, userNickname, userRole, userName } = useContext(AuthContext);
	const navigate = useNavigate();
	const location = useLocation();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const isAdmin = userRole === 'admin';

	if (!isLoggedIn) return null;

	const currentPath = location.pathname;
	const isAdminMode = currentPath.startsWith('/admin');

	const handleLogout = async () => {
		if (isLoggingOut) return;
		if (!window.confirm("로그아웃 하시겠습니까?")) return;

		try {
			setIsLoggingOut(true);
			await authApi.logout('/auth/logout');
			logout();
			navigate('/login');
		} catch (err) {
			alert("로그아웃 처리 중 문제가 발생했습니다.");
		} finally {
			setIsLoggingOut(false);
		}
	};

	return (
		<header className="modern-header-wrapper">
			<div className="modern-gnb">
				<div className="gnb-left">
					<div onClick={() => navigate('/')} className="bq-logo">
						<img src={logo} alt="가치플레이 로고" className="bq-logo-img" />
						<div className="bq-logo-text-group">
							<span className="bq-logo-main">가치플레이 </span>
							<span className="bq-logo-sub">HR</span>
						</div>
					</div>

					<nav className="gnb-nav">
						{MENU_ITEMS.map((item) => {
							if (item.adminOnly && !isAdmin) return null;
							const isActive = item.id === 'admin' ? isAdminMode : currentPath.startsWith(item.path);

							return (
								<Link key={item.id} to={item.path} className={`gnb-item ${isActive ? 'active' : ''}`}>
									{item.label}
								</Link>
							);
						})}
					</nav>
				</div>

				<div className="gnb-right">
					<div className="bq-user-info">
						<div className="bq-status-dot"></div>
						<span className="user-name-text">
							{userNickname || userName}
							{userNickname && userName && userNickname !== userName ? `(${userName})` : ''} 님
						</span>
					</div>
					<button onClick={handleLogout} className="bq-btn-logout" disabled={isLoggingOut}>
						{isLoggingOut ? '처리중...' : '로그아웃'}
					</button>
				</div>
			</div>
		</header>
	);
};

export default Header;