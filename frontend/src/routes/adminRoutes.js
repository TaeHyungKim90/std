import React from 'react';
import { Route } from 'react-router-dom';
import AdminDashboard from '../views/admin/AdminDashboard';
import AdminTodoView from '../views/admin/AdminTodoView';
import CategoryMgmtView from '../views/admin/CategoryMgmtView';
import AdminAttendanceView from '../views/admin/AdminAttendanceView';
import AdminUserView from '../views/admin/AdminUserView';
import HolidayMgmtView from '../views/admin/HolidayMgmtView'
import RecruitmentAdminView from '../views/admin/RecruitmentAdminView'


const adminRoutes = (
  <Route path="/admin">
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="todos" element={<AdminTodoView />} />
    <Route path="categories" element={<CategoryMgmtView />} />
    <Route path="holidays" element={<HolidayMgmtView />} />
    <Route path="attendance" element={<AdminAttendanceView />} />
    <Route path="users" element={<AdminUserView />} />
    <Route path="recruitment" element={<RecruitmentAdminView />} />

  </Route>
);

export default adminRoutes;