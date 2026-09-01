import AdminRoute from 'components/common/AdminRoute';
import Layout from 'components/common/Layout';
import PrivateRoute from 'components/common/PrivateRoute';
import { DEFAULT_TENANT_SLUG, ROUTE_SEGMENTS, TENANT_PARAM } from 'constants/paths';
import { PLATFORM_ROOT } from 'constants/platformPaths';
import { TenantLayout } from 'context/TenantContext';
import { useAppPaths } from 'context/TenantContext';
import React, { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import adminRoutes from './adminRoutes';
import authRoutes from './authRoutes';
import hrRoutes from './hrRoutes';
import platformRoutes from './platformRoutes';
import publicRoutes from './publicRoutes';

const NotFoundPage = lazy(() => import('pages/public/NotFoundPage'));
const PdfViewerPage = lazy(() => import('pages/hr/PdfViewerPage'));

function TenantHomeRedirect() {
	const paths = useAppPaths();
	return <Navigate to={paths.MY_TODOS} replace />;
}

const AppRoutes = () => {
	return (
		<Routes>
			<Route
				path="/"
				element={<Navigate to={`/${DEFAULT_TENANT_SLUG}/login`} replace />}
			/>
			<Route path={PLATFORM_ROOT}>{platformRoutes}</Route>
			<Route path={TENANT_PARAM} element={<TenantLayout />}>
				{authRoutes}
				{publicRoutes}
				<Route element={<PrivateRoute />}>
					<Route
						path={`my/${ROUTE_SEGMENTS.MY.PDF_VIEWER}`}
						element={<PdfViewerPage />}
					/>
					<Route element={<Layout />}>
						<Route index element={<TenantHomeRedirect />} />
						{hrRoutes}
						<Route element={<AdminRoute />}>{adminRoutes}</Route>
					</Route>
				</Route>
				<Route path="*" element={<NotFoundPage />} />
			</Route>
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
};

export default AppRoutes;
