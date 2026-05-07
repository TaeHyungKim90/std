import 'assets/css/header.css';

import { PATHS } from 'constants/paths';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Header from './Header';
import Sidebar from './Sidebar';

const Layout = () => {
	const { pathname } = useLocation();
	const pageShellFill = pathname === PATHS.MY_REPORTS;

	return (
		<div className="bq-layout-wrapper">
			<Header />
			<div className="bq-layout-body">
				<Sidebar />
				<main className="bq-main-content">
					<div className={`bq-page-shell${pageShellFill ? ' bq-page-shell--fill' : ''}`}>
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
};

export default Layout;