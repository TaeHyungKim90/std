import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import PrivateRoute from 'components/common/PrivateRoute';
import AdminRoute from 'components/common/AdminRoute';
import Layout from 'components/common/Layout';
import authRoutes from './authRoutes';
import hrRoutes from './hrRoutes';
import adminRoutes from './adminRoutes';
import publicRoutes from './publicRoutes';
import { PATHS } from 'constants/paths';

const NotFoundPage = lazy(() => import('pages/public/NotFoundPage'));

const AppRoutes = () => {
	return (
		<Routes>
			{authRoutes}
			{publicRoutes}
			<Route element={<PrivateRoute />}>
				<Route element={<Layout />}>
					<Route path={PATHS.HOME} element={<Navigate to={PATHS.MY_TODOS} replace />} />
					{hrRoutes}
					<Route element={<AdminRoute />}>{adminRoutes}</Route>
				</Route>
			</Route>

			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
};

export default AppRoutes;
