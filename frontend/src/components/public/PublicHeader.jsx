import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '../../assets/css/header.css'; // 필요시 퍼블릭 전용 CSS 사용

const PublicHeader = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loggedInUser, setLoggedInUser] = useState(null);

    // 페이지 이동할 때마다 세션 체크 (로그인 상태 실시간 반영)
    useEffect(() => {
        const user = sessionStorage.getItem('applicant_user');
        if (user) setLoggedInUser(JSON.parse(user));
        else setLoggedInUser(null);
    }, [location.pathname]);

    const handleLogout = () => {
        sessionStorage.removeItem('applicant_user');
        setLoggedInUser(null);
        alert("로그아웃 되었습니다.");
        navigate('/careers');
    };

    return (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', borderBottom: '1px solid #eaeaea', background: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                {/* 1. 로고 */}
                <Link to="/careers" style={{ textDecoration: 'none', color: '#111', fontSize: '1.5rem', fontWeight: '900' }}>
                    Gachi 채용
                </Link>

                {/* 2. 공통/권한별 메뉴 */}
                <nav style={{ display: 'flex', gap: '20px', fontWeight: '600' }}>
                    <Link to="/careers" style={{ textDecoration: 'none', color: '#333' }}>채용 공고</Link>
                    {loggedInUser && (
                        <>
                            <Link to="/careers/my-applications" style={{ textDecoration: 'none', color: '#333' }}>내 지원 내역</Link>
                            <Link to="/careers/resume" style={{ textDecoration: 'none', color: '#333' }}>지원서 관리</Link>
                        </>
                    )}
                </nav>
            </div>

            {/* 3. 로그인 / 로그아웃 버튼 */}
            <div>
                {loggedInUser ? (
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ color: '#4A90E2', fontWeight: 'bold' }}>{loggedInUser.name}님</span>
                        <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>로그아웃</button>
                    </div>
                ) : (
                    <button onClick={() => navigate('/careers/login')} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', background: '#111', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        지원자 로그인
                    </button>
                )}
            </div>
        </header>
    );
};

export default PublicHeader;