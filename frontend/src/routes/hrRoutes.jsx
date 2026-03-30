import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import HrLayout from 'components/hr/HrLayout';

const TodoListView = lazy(() => import('pages/hr/TodoList'));
const AttendanceView = lazy(() => import('pages/hr/Attendance'));
const MyMessages = lazy(() => import('pages/hr/MyMessages'));

const hrRoutes = (
	<Route path="/my" element={<HrLayout />}>
		<Route path="todos" element={<TodoListView />} />
		<Route path="attendance" element={<AttendanceView />} />
		<Route path="messages" element={<MyMessages />} />
	</Route>
);

export default hrRoutes;
