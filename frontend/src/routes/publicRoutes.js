import React from 'react';
import { Route } from 'react-router-dom';
import PublicLayout from 'components/public/PublicLayout';
import JobListPage from 'pages/public/JobListPage';
import JobDetailPage from 'pages/public/JobDetailPage';
import JobApplyPage from 'pages/public/JobApplyPage';
import ApplicantLoginPage from 'pages/public/ApplicantLoginPage';
import ApplicantSignupPage from 'pages/public/ApplicantSignupPage';
import MyApplicationsPage from 'pages/public/MyApplicationsPage';
// 개발 예정인 빈 페이지 (에러 방지용 임시 컴포넌트)
//const ResumeMgmt = () => <div style={{padding:'50px', textAlign:'center'}}><h2>이력서 관리 (준비중)</h2></div>;

const publicRoutes = (
    <Route path="/careers" element={<PublicLayout />}>
        <Route index element={<JobListPage />} /> {/* /careers 로 접속 시 메인 */}
        <Route path="login" element={<ApplicantLoginPage />} />
        <Route path="signup" element={<ApplicantSignupPage />} />
        
        <Route path=":jobId" element={<JobDetailPage />} />
        <Route path=":jobId/apply" element={<JobApplyPage />} />
        
        {/* 로그인한 사용자만 접근해야 하지만, 라우터 자체는 퍼블릭에 둡니다 (내부에서 검증) */}
        <Route path="my-applications" element={<MyApplicationsPage />} />
        {/* <Route path="resume" element={<ResumeMgmt />} /> */}
    </Route>
);
export default publicRoutes;