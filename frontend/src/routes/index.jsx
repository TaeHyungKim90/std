import AdminRoute from 'components/common/AdminRoute';
import Layout from 'components/common/Layout';
import PrivateRoute from 'components/common/PrivateRoute';
import { PATHS } from 'constants/paths';
import React, { lazy } from 'react';
import { Navigate,Route, Routes } from 'react-router-dom';

import adminRoutes from './adminRoutes';
import authRoutes from './authRoutes';
import hrRoutes from './hrRoutes';
import publicRoutes from './publicRoutes';

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
