import React from 'react';
import { Route } from 'react-router-dom';
import AdminDashboard from '../views/admin/AdminDashboard';
import AdminTodoView from '../views/admin/AdminTodoView';
import CategoryMgmtView from '../views/admin/CategoryMgmtView';
import AdminAttendanceView from '../views/admin/AdminAttendanceView';
import AdminUserView from '../views/admin/AdminUserView';

const adminRoutes = (
  <Route path="/admin">
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="todos" element={<AdminTodoView />} />
    <Route path="categories" element={<CategoryMgmtView />} />
    <Route path="attendance" element={<AdminAttendanceView />} />
    <Route path="users" element={<AdminUserView />} />
  </Route>
);

export default adminRoutes;