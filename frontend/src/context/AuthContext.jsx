import { authApi } from 'api/authApi';
import { AUTH_SESSION_EXPIRED_EVENT, isSessionExpiredApiError } from 'constants/authEvents';
import { PATH_PREFIX,PATHS } from 'constants/paths';
import React, { createContext, useCallback, useContext, useEffect, useRef,useState } from 'react';
import { broadcastLogoutSignal, subscribeLogoutFromOtherTabs } from 'utils/authLogoutBroadcast';
import * as Notify from 'utils/toastUtils';

// 🌟 1. 우리가 만든 똑똑한 리모컨 임포트!
import { useLoading } from './LoadingContext';

function normalizeSessionAvatarAdjust(src) {
	if (!src || typeof src !== 'object') {
		return { zoom: 1, offsetX: 0, offsetY: 0 };
	}
	const z = src.zoom ?? src.avatar_zoom;
	const ox = src.offsetX ?? src.avatar_offset_x;
	const oy = src.offsetY ?? src.avatar_offset_y;
	return {
		zoom: Number.isFinite(Number(z)) && Number(z) > 0 ? Number(z) : 1,
		offsetX: Number.isFinite(Number(ox)) ? Number(ox) : 0,
		offsetY: Number.isFinite(Number(oy)) ? Number(oy) : 0,
	};
}

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userName, setUserName] = useState('');
	const [userNickname, setUserNickname] = useState('');
	const [userRole, setUserRole] = useState('user');
	const [userId, setUserId] = useState('');
	const [userProfileImageUrl, setUserProfileImageUrl] = useState(null);
	const [userProfileImageCacheBust, setUserProfileImageCacheBust] = useState(0);
	const [userAvatarAdjust, setUserAvatarAdjust] = useState(() => ({ zoom: 1, offsetX: 0, offsetY: 0 }));
	const [joinDate, setJoinDate] = useState(null);
	const [resignationDate, setResignationDate] = useState(null);
	const [loading, setLoading] = useState(true);
	const isLoggedInRef = useRef(false);

	// 🌟 2. 옛날 방식 대신 새로운 리모컨 함수 가져오기!
	const { showLoading, hideLoading } = useLoading();

	useEffect(() => {
		isLoggedInRef.current = isLoggedIn;
	}, [isLoggedIn]);

	const resetAuthState = useCallback(() => {
		setIsLoggedIn(false);
		setUserName('');
		setUserNickname('');
		setUserId('');
		setUserProfileImageUrl(null);
		setUserProfileImageCacheBust(0);
		setUserAvatarAdjust({ zoom: 1, offsetX: 0, offsetY: 0 });
		setUserRole('user');
		setJoinDate(null);
		setResignationDate(null);
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
			broadcastLogoutSignal();
		}).catch((error) => {
			Notify.toastApiFailure(error, "로그아웃 API 호출 실패");
		});
	}, [resetAuthState]);

	const applyAuthCheckResult = useCallback((res) => {
		if (res.data && res.data.isLoggedIn) {
			setIsLoggedIn(true);
			setUserName(res.data.userName);
			setUserNickname(res.data.userNickname);
			setUserId(res.data.userId);
			setUserProfileImageUrl(res.data.user_profile_image_url || null);
			setUserAvatarAdjust(normalizeSessionAvatarAdjust(res.data));
			setUserRole(res.data.role || 'user');
			setJoinDate(res.data.join_date || null);
			setResignationDate(res.data.resignation_date || null);
			return true;
		}
		resetAuthState();
		return false;
	}, [resetAuthState]);

	const syncUserProfileImage = useCallback((url, adjustSrc) => {
		setUserProfileImageUrl(url || null);
		if (adjustSrc != null) {
			setUserAvatarAdjust(normalizeSessionAvatarAdjust(adjustSrc));
		}
		setUserProfileImageCacheBust((k) => k + 1);
	}, []);

	// ✅ 2. 인증 확인 함수 (Macro 액션 -> 전체 로딩바 띄우고 토스트는 숨김!)
	const checkAuth = useCallback(async () => {
		// 🌟 앱 진입 시 하얀 화면을 막기 위해 전체 로딩바 ON
		showLoading("사용자 정보를 확인 중입니다... ⏳");

		try {
			const res = await authApi.checkAuth();
			return applyAuthCheckResult(res);
		} catch (err) {
			console.error("인증 확인 실패:", err);
			if (isSessionExpiredApiError(err)) {
				return false;
			}
			resetAuthState();
			return false;
		} finally {
			hideLoading();
			setLoading(false);
		}
	}, [showLoading, hideLoading, resetAuthState, applyAuthCheckResult]);

	/** 전역 로딩 없이 DB 기준으로 세션·프로필(입사일 등)만 동기화 — 화면 재진입 시 사용 */
	const refreshAuth = useCallback(async () => {
		try {
			const res = await authApi.checkAuth();
			return applyAuthCheckResult(res);
		} catch (err) {
			console.error("인증 갱신 실패:", err);
			if (isSessionExpiredApiError(err)) {
				return false;
			}
			resetAuthState();
			return false;
		}
	}, [applyAuthCheckResult, resetAuthState]);

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	// API 401(비로그인 요청 아님) — 사용자가 세션 만료 토스트를 닫은 뒤 직원 UI 상태 동기화
	useEffect(() => {
		const onSessionExpired = () => {
			resetAuthState();
		};
		window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
		return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
	}, [resetAuthState]);

	// 다른 탭에서 로그아웃 → 직원 세션이 있던 탭만 상태 초기화 + 안내 (지원자 전용 탭은 무시)
	useEffect(() => {
		return subscribeLogoutFromOtherTabs(() => {
			if (!isLoggedInRef.current) return;
			resetAuthState();
			Notify.toastInfo('다른 탭에서 로그아웃되어 세션이 종료되었습니다.');
			const path = window.location.pathname;
			if (path.startsWith(PATH_PREFIX.CAREERS)) {
				window.location.reload();
				return;
			}
			window.location.replace(PATHS.LOGIN);
		});
	}, [resetAuthState]);

	return (
		<AuthContext.Provider value={{
			isLoggedIn, setIsLoggedIn,
			userName, setUserName,
			userNickname, setUserNickname,
			userRole, setUserRole,
			userId, setUserId,
			userProfileImageUrl,
			setUserProfileImageUrl,
			userProfileImageCacheBust,
			syncUserProfileImage,
			userAvatarAdjust,
			joinDate, setJoinDate, // DB의 join_date 필드와 매핑됨
			resignationDate, setResignationDate,
			loading, logout,
			checkAuth,
			refreshAuth
		}}>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => useContext(AuthContext);