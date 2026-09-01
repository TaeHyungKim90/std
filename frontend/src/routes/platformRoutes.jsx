import PlatformLayout from 'components/common/PlatformLayout';
import PlatformRoute from 'components/common/PlatformRoute';
import { PLATFORM_ROUTE_SEGMENTS } from 'constants/platformPaths';
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const PlatformLogin = lazy(() => import('pages/platform/PlatformLogin'));
const TenantMgmt = lazy(() => import('pages/platform/TenantMgmt'));
const TenantBrandingMgmt = lazy(() => import('pages/platform/TenantBrandingMgmt'));

const platformRoutes = (
	<>
		<Route path="login" element={<PlatformLogin />} />
		<Route element={<PlatformRoute />}>
			<Route element={<PlatformLayout />}>
				<Route index element={<Navigate to={PLATFORM_ROUTE_SEGMENTS.TENANTS} replace />} />
				<Route path={PLATFORM_ROUTE_SEGMENTS.TENANTS} element={<TenantMgmt />} />
				<Route path={PLATFORM_ROUTE_SEGMENTS.BRANDING} element={<TenantBrandingMgmt />} />
			</Route>
		</Route>
	</>
);

export default platformRoutes;
