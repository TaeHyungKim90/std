/** 직원 세션 만료(401) — AuthContext 등에서 수신 후 상태 초기화 */
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

/** JWT 테넌트와 URL 테넌트 불일치(403) — 로그아웃 API 없이 UI만 비로그인 처리 */
export const AUTH_TENANT_MISMATCH_EVENT = 'auth:tenant-mismatch';

/** axios 인터셉터가 reject하는 Error에 부여 — catch에서 중복 토스트 방지 */
export const API_SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

export function isSessionExpiredApiError(err) {
	return err?.code === API_SESSION_EXPIRED_CODE;
}
