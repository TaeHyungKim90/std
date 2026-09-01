/**
 * CRA REACT_APP_API_BASE_URL — FastAPI /api 프리픽스까지 포함.
 * 미설정 시 개발 모드에서 localhost:8000/api 로 폴백(CRA dev server ≠ API).
 */
export function getApiBaseUrl() {
	const raw = String(process.env.REACT_APP_API_BASE_URL ?? '').trim();
	if (raw) {
		return raw.replace(/\/$/, '');
	}
	if (process.env.NODE_ENV === 'development') {
		return 'http://localhost:8000/api';
	}
	return '';
}
