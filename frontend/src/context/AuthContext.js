import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authApi } from 'api/authApi';
import { LoadingContext } from './LoadingContext';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // 1. 인증 관련 상태 정의
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState('');
    const [userNickname, setUserNickname] = useState('');
    const [userRole, setUserRole] = useState('user');
    const [userId, setUserId] = useState('');
    const [loading, setLoading] = useState(true); // 앱 실행 초기 로딩 (Route 보호용)
    
    // 2. 전역 로딩 바 제어 함수 가져오기
    const { setIsLoading } = useContext(LoadingContext);

    // ✅ 공통 상태 초기화 함수 (중복 코드 제거 및 보안 강화)
    const resetAuthState = useCallback(() => {
        setIsLoggedIn(false);
        setUserName('');
        setUserNickname('');
        setUserId('');
        setUserRole('user');
        localStorage.removeItem('accessToken');
    }, []);

    // ✅ 1. 로그아웃 함수 (useCallback으로 메모이제이션)
    const logout = useCallback(async () => {
        try {
            setIsLoading(true); // 전역 로딩 시작
            await authApi.logout(); 
        } catch (error) {
            console.error("로그아웃 API 호출 실패:", error);
        } finally {
            resetAuthState(); // 모든 상태 초기화
            setIsLoading(false); // 전역 로딩 종료
        }
    }, [setIsLoading, resetAuthState]);

    // ✅ 2. 인증 확인 함수 (useCallback으로 메모이제이션)
    const checkAuth = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await authApi.checkAuth();
            
            if (res.data && res.data.isLoggedIn) {
                setIsLoggedIn(true);
                setUserName(res.data.userName);
                setUserNickname(res.data.userNickname);
                setUserId(res.data.userId);
                setUserRole(res.data.role || 'user');
                
                if (res.data.access_token) {
                    localStorage.setItem('accessToken', res.data.access_token);
                }
            } else {
                resetAuthState(); // 로그인 상태가 아니면 초기화
            }
        } catch (err) {
            console.error("인증 확인 실패:", err);
            resetAuthState(); // 에러 발생 시 초기화
        } finally {
            setIsLoading(false);
            setLoading(false); // 초기 인증 체크 완료 표시
        }
    }, [setIsLoading, resetAuthState]);

    // ✅ 3. 앱 구동 시 최초 1회 인증 확인
    useEffect(() => {
        checkAuth();
    }, [checkAuth]); // 의존성 배열에 checkAuth를 넣어 경고 해결

    return (
        // React 19 문법: .Provider 생략 가능
        <AuthContext value={{ 
            isLoggedIn, setIsLoggedIn,
            userName, setUserName,
            userNickname, setUserNickname,
            userRole, setUserRole, 
            userId, setUserId,
            loading, logout 
        }}>
            {children}
        </AuthContext>
    );
};

export const useAuth = () => useContext(AuthContext);