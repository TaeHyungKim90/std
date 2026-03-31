/**
 * API·페이징 기본값 (프론트엔드 전역).
 * 배포 시 `.env` 의 `REACT_APP_API_BASE_URL`에 맞춥니다.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_MAX_PAGE_SIZE = 100;
export const DEFAULT_PUBLIC_JOBS_PAGE_SIZE = 12;

/** 브라우저 밖(프록시 타겟 등)과 동일한 기본 백엔드 호스트 */
export const BASE_URL = (() => {
	const base = process.env.REACT_APP_API_BASE_URL || '';
	if (typeof base === 'string' && base.trim()) {
		// 예) http://localhost:8000/api  -> http://localhost:8000
		// 예) /api -> '' (이 경우 fallback 적용)
		return base.replace(/\/?api\/?$/i, '').replace(/\/$/, '') || 'http://localhost:8000';
	}
	return 'http://localhost:8000';
})();
