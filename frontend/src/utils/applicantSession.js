/**
 * 지원자(채용) 세션 단일 진입점
 *
 * - 진실(source of truth): httpOnly 쿠키 기반 서버 세션 → GET /public/recruitment/me
 * - sessionStorage(`applicant_user`): UX용 캐시(즉시 헤더 표시). 반드시 이 모듈만으로 읽기/쓰기.
 *
 * 다른 파일에서 sessionStorage.getItem/setItem('applicant_user')를 직접 쓰지 말 것.
 * UI 동기화: APPLICANT_SESSION_UPDATED_EVENT 수신 또는 useApplicantSession 훅 사용.
 */
import { recruitmentApi } from 'api/recruitmentApi';
import {
	APPLICANT_USER_STORAGE_KEY,
	APPLICANT_SESSION_UPDATED_EVENT,
} from 'constants/applicantCache';

export { APPLICANT_USER_STORAGE_KEY, APPLICANT_SESSION_UPDATED_EVENT };

function dispatchApplicantSessionUpdated(user) {
	window.dispatchEvent(
		new CustomEvent(APPLICANT_SESSION_UPDATED_EVENT, { detail: { user } })
	);
}

/** 파싱 실패·손상 시 키 제거 후 null */
export function getCachedApplicantUser() {
	try {
		const raw = sessionStorage.getItem(APPLICANT_USER_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		sessionStorage.removeItem(APPLICANT_USER_STORAGE_KEY);
		return null;
	}
}

export function isApplicantSessionPayloadLoggedIn(data) {
	return Boolean(data && data.isLoggedIn);
}

/** 캐시에 쓰고 브로드캐스트. user가 null/undefined면 캐시 삭제와 동일 */
export function setCachedApplicantUser(user) {
	if (!user) {
		sessionStorage.removeItem(APPLICANT_USER_STORAGE_KEY);
		dispatchApplicantSessionUpdated(null);
		return;
	}
	sessionStorage.setItem(APPLICANT_USER_STORAGE_KEY, JSON.stringify(user));
	dispatchApplicantSessionUpdated(user);
}

export function clearCachedApplicantUser() {
	sessionStorage.removeItem(APPLICANT_USER_STORAGE_KEY);
	dispatchApplicantSessionUpdated(null);
}

/**
 * 서버 /me 와 sessionStorage 를 일치시킴.
 * @returns {Promise<object|null>} isLoggedIn 인 payload 또는 null(비로그인·오류 시 캐시 비움)
 */
export async function syncApplicantSessionFromServer() {
	try {
		const res = await recruitmentApi.getApplicantMe();
		const data = res?.data;
		if (isApplicantSessionPayloadLoggedIn(data)) {
			setCachedApplicantUser(data);
			return data;
		}
	} catch {
		// 401·네트워크 등
	}
	clearCachedApplicantUser();
	return null;
}
