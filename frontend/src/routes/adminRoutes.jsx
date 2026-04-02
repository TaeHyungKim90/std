import { PATH_PREFIX, ROUTE_SEGMENTS } from 'constants/paths';
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const AdminDashboard = lazy(() => import('pages/admin/AdminDashboard'));
const AdminTodoView = lazy(() => import('pages/admin/AdminTodo'));
const CategoryMgmtView = lazy(() => import('pages/admin/CategoryMgmt'));
const DepartmentMgmtView = lazy(() => import('pages/admin/DepartmentMgmt'));
const AdminAttendanceView = lazy(() => import('pages/admin/AdminAttendance'));
const AdminUserView = lazy(() => import('pages/admin/AdminUser'));
const HolidayMgmtView = lazy(() => import('pages/admin/HolidayMgmt'));
const PositionMgmtView = lazy(() => import('pages/admin/PositionMgmt'));
const RecruitmentAdminView = lazy(() => import('pages/admin/RecruitmentAdmin'));
const ApplicantStatusView = lazy(() => import('pages/admin/ApplicantStatus'));
const AdminMessage = lazy(() => import('pages/admin/AdminMessage'));
const AdminDailyReport = lazy(() => import('pages/admin/AdminDailyReport'));

const adminRoutes = (
	<Route path={PATH_PREFIX.ADMIN}>
		<Route path={ROUTE_SEGMENTS.ADMIN.DASHBOARD} element={<AdminDashboard />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.TODOS} element={<AdminTodoView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.CATEGORIES} element={<CategoryMgmtView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.DEPARTMENTS} element={<DepartmentMgmtView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.HOLIDAYS} element={<HolidayMgmtView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.POSITIONS} element={<PositionMgmtView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.ATTENDANCE} element={<AdminAttendanceView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.USERS} element={<AdminUserView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.REPORTS} element={<AdminDailyReport />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.RECRUITMENT} element={<RecruitmentAdminView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.APPLICANTS} element={<ApplicantStatusView />} />
		<Route path={ROUTE_SEGMENTS.ADMIN.MESSAGES} element={<AdminMessage />} />
	</Route>
);

export default adminRoutes;
