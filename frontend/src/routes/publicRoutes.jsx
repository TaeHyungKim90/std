import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import PublicLayout from 'components/public/PublicLayout';

const JobListPage = lazy(() => import('pages/public/JobListPage'));
const JobDetailPage = lazy(() => import('pages/public/JobDetailPage'));
const JobApplyPage = lazy(() => import('pages/public/JobApplyPage'));
const ApplicantLoginPage = lazy(() => import('pages/public/ApplicantLoginPage'));
const ApplicantSignupPage = lazy(() => import('pages/public/ApplicantSignupPage'));
const MyApplicationsPage = lazy(() => import('pages/public/MyApplicationsPage'));

const publicRoutes = (
	<Route path="/careers" element={<PublicLayout />}>
		<Route index element={<JobListPage />} />
		<Route path="login" element={<ApplicantLoginPage />} />
		<Route path="signup" element={<ApplicantSignupPage />} />

		<Route path=":jobId" element={<JobDetailPage />} />
		<Route path=":jobId/apply" element={<JobApplyPage />} />

		<Route path="my-applications" element={<MyApplicationsPage />} />
	</Route>
);
export default publicRoutes;
