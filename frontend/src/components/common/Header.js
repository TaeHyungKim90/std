import React, { useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // useLocation 추가
import { AuthContext } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { MENU_ITEMS } from '../../constants/menu';
import logo from '../../assets/icon/favicon.png';
import '../../assets/css/header.css';

const Header = () => {
    const { isLoggedIn, logout, userNickname, userRole,userName } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation(); // 현재 경로 파악
    const [isLoggingOut, setIsLoggingOut] = useState(false); // 로그아웃 로딩 상태
    const isAdmin = userRole === 'admin';

    const handleLogout = async () => {
        if (isLoggingOut) return; // 중복 클릭 방지
        
        if (!window.confirm("로그아웃 하시겠습니까?")) return; // 사용자 확인

        try {
            setIsLoggingOut(true);
            await authService.logout('/auth/logout');
            logout(); 
            navigate('/login');
        } catch (err) {
            console.error("로그아웃 실패:", err);
            alert("로그아웃 처리 중 문제가 발생했습니다.");
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <header className="bq-header">
            <div className="bq-logo-section">
                {/* 로고 영역 */}
                <div onClick={() => navigate('/')} className="bq-logo">
                    <img src={logo} alt="가치플레이 로고" className="bq-logo-img" />
                    <div className="bq-logo-text-group">
                        <span className="bq-logo-main">가치플레이 </span>
                        <span className="bq-logo-sub">HR</span>
                    </div>
                </div>
                {/* ✅ 중앙 메뉴 영역 추가 */}
                <nav className="bq-main-menu">
                    {MENU_ITEMS.map((item) => {
                        // 관리자 전용 메뉴인데 사용자가 관리자가 아니면 숨김
                        if (item.adminOnly && !isAdmin) return null;
                        
                        return (
                            <span 
                                key={item.id}
                                onClick={() => navigate(item.path)}
                                className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
                            >
                                {item.label}
                            </span>
                        );
                    })}
                </nav>
            </div>
            {/* 내비게이션 및 사용자 메뉴 영역 */}
            <div className="bq-header-right">
                {isLoggedIn ? (
                    <>
                        <div className="bq-user-info">
                            <div className="bq-status-dot"></div>
                            <span>
                                {userNickname || userName}
                                {userNickname && userName && userNickname !== userName ? `(${userName})` : ''} 님
                </span>
                        </div>
                        <button onClick={handleLogout} className="bq-btn-logout">로그아웃</button>
                    </>
                ) : (
                    <button onClick={() => navigate('/login')} className="bq-btn-login">로그인</button>
                )}
            </div>
        </header>
    );
};

export default Header;