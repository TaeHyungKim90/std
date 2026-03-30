import React from 'react';
import { Route } from 'react-router-dom';
import AdminDashboard from 'pages/admin/AdminDashboard';
import AdminTodoView from 'pages/admin/AdminTodo';
import CategoryMgmtView from 'pages/admin/CategoryMgmt';
import AdminAttendanceView from 'pages/admin/AdminAttendance';
import AdminUserView from 'pages/admin/AdminUser';
import HolidayMgmtView from 'pages/admin/HolidayMgmt'
import RecruitmentAdminView from 'pages/admin/RecruitmentAdmin'
import ApplicantStatusView from 'pages/admin/ApplicantStatus';
import AdminMessage from 'pages/admin/AdminMessage';

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