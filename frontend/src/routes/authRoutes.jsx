import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import AuthLayout from 'components/auth/AuthLayout';
import { PATHS } from 'constants/paths';

const LoginPage = lazy(() => import('pages/auth/LoginPage'));
const SignupPage = lazy(() => import('pages/auth/SignupPage'));
const OAuthCallback = lazy(() => import('pages/auth/OAuthCallback'));

const authRoutes = (
	<>
		<Route element={<AuthLayout />}>
			<Route path={PATHS.LOGIN} element={<LoginPage />} />
			<Route path={PATHS.SIGNUP} element={<SignupPage />} />
		</Route>
		<Route path={PATHS.OAUTH_CALLBACK} element={<OAuthCallback />} />
	</>
);

export default authRoutes;
