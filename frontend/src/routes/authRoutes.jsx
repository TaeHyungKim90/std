import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import AuthLayout from 'components/auth/AuthLayout';

const LoginPage = lazy(() => import('pages/auth/LoginPage'));
const SignupPage = lazy(() => import('pages/auth/SignupPage'));
const OAuthCallback = lazy(() => import('pages/auth/OAuthCallback'));

const authRoutes = (
	<>
		<Route element={<AuthLayout />}>
			<Route path="/login" element={<LoginPage />} />
			<Route path="/signup" element={<SignupPage />} />
		</Route>
		<Route path="/oauth/callback" element={<OAuthCallback />} />
	</>
);

export default authRoutes;
