import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
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
		setIsLoading(true); // 전역 로딩 시작
		Notify.toastPromise(authApi.logout(), {
			loading: '로그아웃 처리 중입니다...',
			success: '로그아웃되었습니다.',
			error: () => {
				resetAuthState();
				return '로그아웃 처리에 실패했습니다.';
			}
		}).then(() => {
			resetAuthState();
		}).catch((error) => {
			console.error("로그아웃 API 호출 실패:", error);
		}).finally(() => {
			setIsLoading(false); // 전역 로딩 종료
		});
	}, [setIsLoading, resetAuthState]);

	// ✅ 2. 인증 확인 함수 (useCallback으로 메모이제이션)
	const checkAuth = useCallback(async () => {
		setIsLoading(true);
		return Notify.toastPromise(authApi.checkAuth(), {
			loading: '인증 상태를 확인하는 중입니다...',
			success: '인증 상태를 확인했습니다.',
			error: () => {
				resetAuthState();
				return '인증 확인에 실패했습니다.';
			}
		}).then((res) => {
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
				return false; // 로그인 상태가 아니면 초기화
			}
		}).catch((err) => {
			console.error("인증 확인 실패:", err);
		}).then((result) => {
			return typeof result === 'boolean' ? result : false;
		}).finally(() => {
			setIsLoading(false);
			setLoading(false); // 초기 인증 체크 완료 표시
		});
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
			loading, logout,
			checkAuth
		}}>
			{children}
		</AuthContext>
	);
};

export const useAuth = () => useContext(AuthContext);