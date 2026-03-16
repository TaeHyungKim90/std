import React from 'react';
import { Route } from 'react-router-dom';
import TodoListView from '../views/hr/TodoListView';
import AttendanceView from '../views/hr/AttendanceView'; // 👈 추가된 출퇴근 페이지

const hrRoutes = (
  <Route path="/my">
    <Route path="todos" element={<TodoListView />} />
    <Route path="attendance" element={<AttendanceView />} />
  </Route>
);

export default hrRoutes;