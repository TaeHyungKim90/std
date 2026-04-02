import 'assets/css/careers.css'; // 🌟 CSS를 여기서 단 한 번만 임포트합니다!

import React from 'react';
import { Outlet } from 'react-router-dom';

import PublicHeader from './PublicHeader';

const PublicLayout = () => {
	return (
		<div className="public-layout">
			<PublicHeader />
			
			<main className="careers-global-bg">
				<div className="public-page-shell careers-main-shell">
					<Outlet />
				</div>
			</main>
		</div>
	);
};

export default PublicLayout;