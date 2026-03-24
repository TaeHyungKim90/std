// frontend/src/pages/auth/OAuthCallback.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const OAuthCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // 1. 주소창에서 토큰 훔쳐오기 (?)
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('token');

        if (token) {
            // 2. 로컬 스토리지에 쏙 집어넣기 (일반 로그인과 동일한 상태가 됨!)
            localStorage.setItem('accessToken', token);
            
            // 3. 메인 페이지로 자연스럽게 이동 (뒤로가기 방지를 위해 replace: true)
            navigate('/', { replace: true });
        } else {
            alert("소셜 로그인 중 오류가 발생했습니다.");
            navigate('/login', { replace: true });
        }
    }, [navigate, location]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <h2>소셜 로그인 처리 중입니다... 🚀</h2>
        </div>
    );
};

export default OAuthCallback;