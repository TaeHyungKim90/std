import HrLayout from 'components/hr/HrLayout';
import { PATH_PREFIX, ROUTE_SEGMENTS } from 'constants/paths';
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const TodoListView = lazy(() => import('pages/hr/TodoList'));
const MyReports = lazy(() => import('pages/hr/MyReports'));
const AttendanceView = lazy(() => import('pages/hr/Attendance'));
const MyMessages = lazy(() => import('pages/hr/MyMessages'));
const MyProfile = lazy(() => import('pages/hr/MyProfile'));

const hrRoutes = (
	<Route path={PATH_PREFIX.MY} element={<HrLayout />}>
		<Route path={ROUTE_SEGMENTS.MY.TODOS} element={<TodoListView />} />
		<Route path={ROUTE_SEGMENTS.MY.REPORTS} element={<MyReports />} />
		<Route path={ROUTE_SEGMENTS.MY.ATTENDANCE} element={<AttendanceView />} />
		<Route path={ROUTE_SEGMENTS.MY.MESSAGES} element={<MyMessages />} />
		<Route path={ROUTE_SEGMENTS.MY.PROFILE} element={<MyProfile />} />
	</Route>
);

export default hrRoutes;
