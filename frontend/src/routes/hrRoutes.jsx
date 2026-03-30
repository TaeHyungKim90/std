import React from 'react';
import { Route } from 'react-router-dom';
import HrLayout from 'components/hr/HrLayout';
import TodoListView from 'pages/hr/TodoList';
import AttendanceView from 'pages/hr/Attendance';
import MyMessages from '../pages/hr/MyMessages';

const hrRoutes = (
  <Route path="/my" element={<HrLayout />}>
	<Route path="todos" element={<TodoListView />} />
	<Route path="attendance" element={<AttendanceView />} />
	<Route path="messages" element={<MyMessages />} />
  </Route>
);

export default hrRoutes;