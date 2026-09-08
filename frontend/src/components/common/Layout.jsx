import 'assets/css/header.css';

import { useAppPaths } from 'context/TenantContext';
import { Outlet, useLocation } from 'react-router-dom';

import BirthDateRequiredGate from './BirthDateRequiredGate';
import Header from './Header';
import MustChangePasswordGate from './MustChangePasswordGate';
import Sidebar from './Sidebar';

const Layout = () => {
	const paths = useAppPaths();
	const { pathname } = useLocation();
	const pageShellFill = pathname === paths.MY_REPORTS;

	return (
		<div className="bq-layout-wrapper">
			<MustChangePasswordGate />
			<BirthDateRequiredGate />
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