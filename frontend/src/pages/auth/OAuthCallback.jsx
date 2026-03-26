// frontend/src/pages/auth/OAuthCallback.jsx
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'context/AuthContext';
const OAuthCallback = () => {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const isProcessed = useRef(false);
    useEffect(() => {
        const verifySocialLogin = async () => {
            // 이미 한 번 실행되었다면 바로 종료!
            if (isProcessed.current) return;
            isProcessed.current = true;

            try {
                // AuthContext에 있는 checkAuth를 호출해서 로그인(쿠키) 확인
                const isAuthenticated = await checkAuth(); 

                if (isAuthenticated) {
                    // 성공 시 깔끔하게 메인으로 이동
                    navigate('/', { replace: true });
                } else {
                    throw new Error("소셜 로그인 인증 실패");
                }
            } catch (error) {
                console.error('소셜 로그인 처리 중 에러:', error);
                alert('로그인에 실패했습니다. 다시 시도해주세요.');
                navigate('/login', { replace: true });
            }
        };

        verifySocialLogin();
    }, [checkAuth, navigate]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <h2>소셜 로그인 처리 중입니다... 🚀</h2>
        </div>
    );
};

export default OAuthCallback;