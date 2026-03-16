
import React, { createContext, useState, useEffect, useContext } from 'react';
//import { client } from '../utils/apiUtils';
import { authService } from '../services/authService';
export const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState('');
    const [userNickname, setUserNickname] = useState('');
    const [userRole, setUserRole] = useState('user');
    const [userId, setUserId] = useState('');
    const [loading, setLoading] = useState(true); // 앱 실행 초기 로딩 상태 관리
    const logout = () => {
        setIsLoggedIn(false);
        setUserName('');
        setUserNickname('');
        setUserId('');
        setUserRole('user');
        // 필요하다면 여기서 localStorage.clear() 등을 추가하세요.
    };
    const checkAuth = async () => {
        try {
        // 서버에 인증 상태 확인 요청 (client는 apiUtils의 axios 인스턴스)
        const res = await authService.checkAuth();
        
        // [핵심 로직] 서버가 보낸 isLoggedIn 값을 기준으로 상태 결정
        if (res.data && res.data.isLoggedIn) {
            setIsLoggedIn(true);
            setUserName(res.data.userName);
            setUserNickname(res.data.userNickname);
            setUserId(res.data.userId);
            setUserRole(res.data.role || 'user');
        } else {
            // 응답은 왔지만 로그인이 안 되어 있는 경우 (확실하게 로그아웃 상태 처리)
            setIsLoggedIn(false);
            setUserNickname('');
            setUserName('');
            setUserId('');
            setUserRole('user');
        }
        } catch (err) {
            // 서버와의 통신 자체가 실패한 경우 (서버 다운, 401 에러 등)
            console.error("인증 확인 실패:", err);
            setIsLoggedIn(false);
            setUserNickname('');
            setUserName('');
            setUserId('');
            setUserRole('user');
        } finally {
            // 어떤 결과든 인증 확인 작업이 끝났으므로 로딩바 해제
            setLoading(false);
        }
    };
    useEffect(() => {
        checkAuth();
    }, []);

    return (
        // React 19 문법: .Provider 생략 가능
        <AuthContext value={{ isLoggedIn, setIsLoggedIn, userName, setUserName,userNickname, setUserNickname, userRole, setUserRole, loading, logout }}>
        {children}
        </AuthContext>
    );
};
export const useAuth = () => useContext(AuthContext);