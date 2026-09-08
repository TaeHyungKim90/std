import AuthLayout from 'components/auth/AuthLayout';
import { lazy } from 'react';
import { Route } from 'react-router-dom';

const LoginPage = lazy(() => import('pages/auth/LoginPage'));
const SignupPage = lazy(() => import('pages/auth/SignupPage'));
const SocialSignupComplete = lazy(() => import('pages/auth/SocialSignupComplete'));
const OAuthCallback = lazy(() => import('pages/auth/OAuthCallback'));

const authRoutes = (
	<>
		<Route element={<AuthLayout />}>
			<Route path="login" element={<LoginPage />} />
			<Route path="signup" element={<SignupPage />} />
			<Route path="signup/social-complete" element={<SocialSignupComplete />} />
		</Route>
		<Route path="oauth/callback" element={<OAuthCallback />} />
	</>
);

export default authRoutes;
