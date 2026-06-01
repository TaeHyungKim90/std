import { PlatformAuthContext } from 'context/PlatformAuthContext';
import { PLATFORM_PATHS } from 'constants/platformPaths';
import React, { useContext } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

const PlatformLayout = () => {
	const { name, loginId, logout } = useContext(PlatformAuthContext);
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate(PLATFORM_PATHS.LOGIN, { replace: true });
	};

	return (
		<div className="bq-admin-view" style={{ minHeight: '100vh', padding: '24px' }}>
			<header
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginBottom: '24px',
					paddingBottom: '16px',
					borderBottom: '1px solid #e5e7eb',
				}}
			>
				<div>
					<h1 style={{ margin: 0, fontSize: '1.35rem' }}>SaaS 플랫폼 관리</h1>
					<p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
						HR 테넌트와 분리된 운영 콘솔
					</p>
				</div>
				<nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
					<Link to={PLATFORM_PATHS.TENANTS}>테넌트 관리</Link>
					<span style={{ color: '#374151', fontSize: '0.9rem' }}>
						{name || loginId}
					</span>
					<button type="button" className="btn-cancel" onClick={handleLogout}>
						로그아웃
					</button>
				</nav>
			</header>
			<main>
				<Outlet />
			</main>
		</div>
	);
};

export default PlatformLayout;
