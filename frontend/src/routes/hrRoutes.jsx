import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import HrLayout from 'components/hr/HrLayout';
import { PATH_PREFIX, ROUTE_SEGMENTS } from 'constants/paths';

const TodoListView = lazy(() => import('pages/hr/TodoList'));
const AttendanceView = lazy(() => import('pages/hr/Attendance'));
const MyMessages = lazy(() => import('pages/hr/MyMessages'));

const hrRoutes = (
	<Route path={PATH_PREFIX.MY} element={<HrLayout />}>
		<Route path={ROUTE_SEGMENTS.MY.TODOS} element={<TodoListView />} />
		<Route path={ROUTE_SEGMENTS.MY.ATTENDANCE} element={<AttendanceView />} />
		<Route path={ROUTE_SEGMENTS.MY.MESSAGES} element={<MyMessages />} />
	</Route>
);

export default hrRoutes;
