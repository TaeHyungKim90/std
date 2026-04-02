import { useState, useEffect, useCallback } from 'react';
import {
	APPLICANT_SESSION_UPDATED_EVENT,
	getCachedApplicantUser,
	syncApplicantSessionFromServer,
	clearCachedApplicantUser,
	isApplicantSessionPayloadLoggedIn,
} from 'utils/applicantSession';

/**
 * 채용(지원자) 세션 — 캐시 표시 + 서버 동기화 + 커스텀 이벤트 구독
 * @param {string|number} [resyncKey] — 바뀔 때마다 syncApplicantSessionFromServer 재실행 (예: location.pathname)
 */
export function useApplicantSession(resyncKey) {
	const [user, setUser] = useState(() => {
		const c = getCachedApplicantUser();
		return isApplicantSessionPayloadLoggedIn(c) ? c : null;
	});

	const applyUser = useCallback((payload) => {
		setUser(isApplicantSessionPayloadLoggedIn(payload) ? payload : null);
	}, []);

	const refreshFromServer = useCallback(async () => {
		const next = await syncApplicantSessionFromServer();
		applyUser(next);
		return next;
	}, [applyUser]);

	useEffect(() => {
		const onUpdated = (e) => {
			const next = e.detail?.user;
			if (next === undefined) {
				const c = getCachedApplicantUser();
				applyUser(c);
				return;
			}
			applyUser(next);
		};
		window.addEventListener(APPLICANT_SESSION_UPDATED_EVENT, onUpdated);
		return () => window.removeEventListener(APPLICANT_SESSION_UPDATED_EVENT, onUpdated);
	}, [applyUser]);

	useEffect(() => {
		refreshFromServer();
	}, [resyncKey, refreshFromServer]);

	return {
		user,
		setUser,
		refreshFromServer,
		clearSession: clearCachedApplicantUser,
	};
}
