import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import '../../assets/css/careers.css'; // 🌟 CSS를 여기서 단 한 번만 임포트합니다!

const PublicLayout = () => {
    return (
        <div className="public-layout">
            <PublicHeader />
            
            {/* 🌟 전역 배경 클래스 적용 (헤더 아래 모든 화면이 이 배경을 공유함) */}
            <main className="careers-global-bg">
                <Outlet />
            </main>
        </div>
    );
};

export default PublicLayout;