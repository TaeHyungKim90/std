import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';

const PublicLayout = () => {
    return (
        <div className="public-layout" style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* 모든 공개 페이지 상단에 헤더 고정 */}
            <PublicHeader />
            
            {/* Outlet 자리에 JobListView, JobDetailView 등이 쏙쏙 들어감 */}
            <main className="public-content">
                <Outlet />
            </main>
        </div>
    );
};

export default PublicLayout;