import 'assets/css/admin.css';
import 'assets/css/platform.css';

import { PLATFORM_PATHS } from 'constants/platformPaths';
import { PlatformAuthContext } from 'context/PlatformAuthContext';
import React, { useContext } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const PlatformLayout = () => {
	const { name, loginId, logout } = useContext(PlatformAuthContext);
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate(PLATFORM_PATHS.LOGIN, { replace: true });
	};

	return (
		<div className="bq-platform-shell">
			<header className="platform-topbar">
				<div className="platform-topbar__brand">
					<h1>SaaS 플랫폼 관리</h1>
					<p>HR 테넌트와 분리된 운영 콘솔</p>
				</div>
				<nav className="platform-topbar__nav" aria-label="플랫폼 메뉴">
					<NavLink
						to={PLATFORM_PATHS.TENANTS}
						className={({ isActive }) =>
							`platform-topbar__link${isActive ? ' platform-topbar__link--active' : ''}`
						}
					>
						테넌트 관리
					</NavLink>
					<NavLink
						to={PLATFORM_PATHS.BRANDING}
						className={({ isActive }) =>
							`platform-topbar__link${isActive ? ' platform-topbar__link--active' : ''}`
						}
					>
						로고·아이콘
					</NavLink>
					<span className="platform-topbar__user">{name || loginId}</span>
					<button type="button" className="platform-topbar__logout" onClick={handleLogout}>
						로그아웃
					</button>
				</nav>
			</header>
			<main className="platform-main">
				<Outlet />
			</main>
		</div>
	);
};

export default PlatformLayout;
