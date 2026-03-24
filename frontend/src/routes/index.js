import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import PrivateRoute from 'components/common/PrivateRoute';
import AdminRoute from 'components/common/AdminRoute';
import Layout from 'components/common/Layout';
// 분리된 라우트 모듈들 임포트
import authRoutes from './authRoutes';
import hrRoutes from './hrRoutes';
import adminRoutes from './adminRoutes';
import publicRoutes from './publicRoutes';
import NotFoundPage from 'pages/public/NotFoundPage';
const AppRoutes = () => {
  return (
    <Routes>
        {/* 1. 공개 라우트 (로그인 등) */}
        {authRoutes}
        {publicRoutes}
        {/* 2. 인증이 필요한 보호된 라우트 */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            {/* 초기 접속 시 리다이렉트 */}
            <Route path="/" element={<Navigate to="/my/todos" replace />} />
            {/* 모듈화된 라우트들 배치 */}
            {hrRoutes}
            <Route element={<AdminRoute />}>
              {adminRoutes}
            </Route>
            
          </Route>      
        </Route>
        
        {/* 3. 404 처리 */}
        <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;