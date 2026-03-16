import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ADMIN_SUB_MENU } from '../../constants/menu';
import '../../assets/css/submenu.css';

const SubNavbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // 1. 현재 어떤 그룹(인사 vs 시스템) 소속인지 확인
    const isHrActive = ADMIN_SUB_MENU.HR.items.some(item => currentPath === item.path);
    // 대시보드(/admin/dashboard)는 기본적으로 시스템관리 그룹으로 분류
    const isMgmtActive = ADMIN_SUB_MENU.MGMT.items.some(item => currentPath === item.path) || currentPath === '/admin/dashboard';

    const activeGroup = isHrActive ? ADMIN_SUB_MENU.HR : ADMIN_SUB_MENU.MGMT;

    // 관리자 경로가 아닐 때는 메뉴를 숨김
    if (!currentPath.startsWith('/admin')) return null;

    return (
        <div className="sub-nav-container">
            {/* 1층: 그룹 탭 (Underline 방식) */}
            <div className="sub-nav-group-wrapper">
                <div 
                    className={`group-tab ${isHrActive ? 'active' : ''}`}
                    onClick={() => navigate(ADMIN_SUB_MENU.HR.items[0].path)}
                >
                    인사관리
                </div>
                <div 
                    className={`group-tab ${isMgmtActive ? 'active' : ''}`}
                    onClick={() => navigate(ADMIN_SUB_MENU.MGMT.items[0].path)}
                >
                    시스템관리
                </div>
            </div>

            {/* 2층: 상세 링크 (Text 링크 방식) */}
            <div className="sub-nav-links">
                {activeGroup.items.map(item => (
                    <div 
                        key={item.id}
                        className={`sub-link-item ${currentPath === item.path ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        {item.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SubNavbar;