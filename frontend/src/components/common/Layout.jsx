import 'assets/css/header.css';

import React from 'react';
import { Outlet } from 'react-router-dom';

import Header from './Header';
import Sidebar from './Sidebar';

const Layout = () => {
	return (
		<div className="bq-layout-wrapper">
			<Header />
			<div className="bq-layout-body">
				<Sidebar />
				<main className="bq-main-content">
					<div className="bq-page-shell">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
};

export default Layout;