import PublicLayout from 'components/public/PublicLayout';
import { PATHS, ROUTE_SEGMENTS } from 'constants/paths';
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const JobListPage = lazy(() => import('pages/public/JobListPage'));
const JobDetailPage = lazy(() => import('pages/public/JobDetailPage'));
const JobApplyPage = lazy(() => import('pages/public/JobApplyPage'));
const ApplicantLoginPage = lazy(() => import('pages/public/ApplicantLoginPage'));
const ApplicantSignupPage = lazy(() => import('pages/public/ApplicantSignupPage'));
const MyApplicationsPage = lazy(() => import('pages/public/MyApplicationsPage'));

const publicRoutes = (
	<Route path={PATHS.CAREERS} element={<PublicLayout />}>
		<Route index element={<JobListPage />} />
		<Route path={ROUTE_SEGMENTS.CAREERS.LOGIN} element={<ApplicantLoginPage />} />
		<Route path={ROUTE_SEGMENTS.CAREERS.SIGNUP} element={<ApplicantSignupPage />} />

		<Route path={ROUTE_SEGMENTS.CAREERS.JOB_ID} element={<JobDetailPage />} />
		<Route path={ROUTE_SEGMENTS.CAREERS.JOB_APPLY} element={<JobApplyPage />} />

		<Route path={ROUTE_SEGMENTS.CAREERS.MY_APPLICATIONS} element={<MyApplicationsPage />} />
	</Route>
);
export default publicRoutes;
