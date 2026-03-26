import React from 'react';
import { Route } from 'react-router-dom';
import TodoListView from 'pages/hr/TodoList';
import AttendanceView from 'pages/hr/Attendance'; // 👈 추가된 출퇴근 페이지
import MyMessages from '../pages/hr/MyMessages';

const hrRoutes = (
  <Route path="/my">
    <Route path="todos" element={<TodoListView />} />
    <Route path="attendance" element={<AttendanceView />} />
    <Route path="/my/messages" element={<MyMessages />} />
  </Route>
);

export default hrRoutes;