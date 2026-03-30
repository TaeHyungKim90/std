import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const AdminDashboard = lazy(() => import('pages/admin/AdminDashboard'));
const AdminTodoView = lazy(() => import('pages/admin/AdminTodo'));
const CategoryMgmtView = lazy(() => import('pages/admin/CategoryMgmt'));
const AdminAttendanceView = lazy(() => import('pages/admin/AdminAttendance'));
const AdminUserView = lazy(() => import('pages/admin/AdminUser'));
const HolidayMgmtView = lazy(() => import('pages/admin/HolidayMgmt'));
const RecruitmentAdminView = lazy(() => import('pages/admin/RecruitmentAdmin'));
const ApplicantStatusView = lazy(() => import('pages/admin/ApplicantStatus'));
const AdminMessage = lazy(() => import('pages/admin/AdminMessage'));

const adminRoutes = (
	<Route path="/admin">
		<Route path="dashboard" element={<AdminDashboard />} />
		<Route path="todos" element={<AdminTodoView />} />
		<Route path="categories" element={<CategoryMgmtView />} />
		<Route path="holidays" element={<HolidayMgmtView />} />
		<Route path="attendance" element={<AdminAttendanceView />} />
		<Route path="users" element={<AdminUserView />} />
		<Route path="recruitment" element={<RecruitmentAdminView />} />
		<Route path="applicants" element={<ApplicantStatusView />} />
		<Route path="messages" element={<AdminMessage />} />
	</Route>
);

export default adminRoutes;
