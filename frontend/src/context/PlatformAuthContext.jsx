import { platformApi } from 'api/platformApi';
import { PLATFORM_PATHS } from 'constants/platformPaths';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

export const PlatformAuthContext = createContext(null);

export const PlatformAuthProvider = ({ children }) => {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [loginId, setLoginId] = useState('');
	const [name, setName] = useState('');
	const [loading, setLoading] = useState(true);

	const resetState = useCallback(() => {
		setIsLoggedIn(false);
		setLoginId('');
		setName('');
	}, []);

	const checkSession = useCallback(async () => {
		try {
			const res = await platformApi.me();
			if (res.data?.isLoggedIn) {
				setIsLoggedIn(true);
				setLoginId(res.data.login_id || '');
				setName(res.data.name || '');
			} else {
				resetState();
			}
		} catch {
			resetState();
		} finally {
			setLoading(false);
		}
	}, [resetState]);

	useEffect(() => {
		const path = window.location.pathname;
		if (path.startsWith(PLATFORM_PATHS.LOGIN)) {
			setLoading(false);
			return;
		}
		if (path.startsWith('/platform')) {
			checkSession();
		} else {
			setLoading(false);
		}
	}, [checkSession]);

	const login = useCallback(async (login_id, password) => {
		const res = await platformApi.login({ login_id, password });
		setIsLoggedIn(true);
		setLoginId(res.data.login_id || login_id);
		setName(res.data.name || '');
		return res;
	}, []);

	const logout = useCallback(async () => {
		try {
			await platformApi.logout();
		} catch (err) {
			Notify.toastApiFailure(err, '로그아웃에 실패했습니다.');
		} finally {
			resetState();
		}
	}, [resetState]);

	return (
		<PlatformAuthContext.Provider
			value={{ isLoggedIn, loginId, name, loading, login, logout, checkSession }}
		>
			{children}
		</PlatformAuthContext.Provider>
	);
};

export function usePlatformAuth() {
	const ctx = useContext(PlatformAuthContext);
	if (!ctx) {
		throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
	}
	return ctx;
}
