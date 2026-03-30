import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { authApi } from 'api/authApi';
// 🌟 1. 우리가 만든 똑똑한 리모컨 임포트!
import { useLoading } from './LoadingContext';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userName, setUserName] = useState('');
	const [userNickname, setUserNickname] = useState('');
	const [userRole, setUserRole] = useState('user');
	const [userId, setUserId] = useState('');
	const [loading, setLoading] = useState(true); 
	
	// 🌟 2. 옛날 방식 대신 새로운 리모컨 함수 가져오기!
	const { showLoading, hideLoading } = useLoading();

	const resetAuthState = useCallback(() => {
		setIsLoggedIn(false);
		setUserName('');
		setUserNickname('');
		setUserId('');
		setUserRole('user');
		localStorage.removeItem('accessToken');
	}, []);

	// ✅ 로그아웃: API + 상태 초기화는 여기서만 수행 (Header 등에서 이중 호출 금지)
	const logout = useCallback(() => {
		return Notify.toastPromise(authApi.logout(), {
			loading: '로그아웃 처리 중입니다... 🚪',
			success: '안전하게 로그아웃되었습니다. ',
			error: () => {
				resetAuthState();
				return '로그아웃 처리에 실패했습니다.';
			}
		}).then(() => {
			resetAuthState();
		}).catch((error) => {
			console.error("로그아웃 API 호출 실패:", error);
		});
	}, [resetAuthState]);

	// ✅ 2. 인증 확인 함수 (Macro 액션 -> 전체 로딩바 띄우고 토스트는 숨김!)
	const checkAuth = useCallback(async () => {
		// 🌟 앱 진입 시 하얀 화면을 막기 위해 전체 로딩바 ON
		showLoading("사용자 정보를 확인 중입니다... ⏳"); 
		
		try {
			// 🚨 잦은 알림 방지를 위해 toastPromise 대신 일반 통신 사용
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
				return true;
			} else {
				resetAuthState();
				return false; 
			}
		} catch (err) {
			console.error("인증 확인 실패:", err);
			resetAuthState();
			return false;
		} finally {
			// 🌟 통신이 끝나면 전체 로딩바 OFF
			hideLoading(); 
			setLoading(false); 
		}
	}, [showLoading, hideLoading, resetAuthState]);

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	return (
		<AuthContext value={{ 
			isLoggedIn, setIsLoggedIn,
			userName, setUserName,
			userNickname, setUserNickname,
			userRole, setUserRole, 
			userId, setUserId,
			loading, logout,
			checkAuth
		}}>
			{children}
		</AuthContext>
	);
};

export const useAuth = () => useContext(AuthContext);