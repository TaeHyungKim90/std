import * as Notify from 'utils/toastUtils';

/** axios baseURL 과 동일한 호스트(포트) — /api 제거 */
function getApiOrigin() {
	const base = process.env.REACT_APP_API_BASE_URL || '';
	if (typeof base === 'string' && /\/api\/?$/i.test(base)) {
		return base.replace(/\/?api\/?$/i, '').replace(/\/$/, '') || 'http://localhost:8000';
	}
	return (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
}

/**
 * 서버에 저장된 파일을 브라우저 새 창에서 엽니다.
 * - `SERVE_UPLOADS_STATIC=false` 인 경우: httpOnly 쿠키가 전달되도록 같은 API 호스트의
 *   `GET /api/common/files/by-saved-name/...` 로 엽니다 (직원 로그인 필요).
 * - `REACT_APP_FILE_DOWNLOAD_VIA_API=false` 이면 예전처럼 `/uploads/...` 직접 URL (정적 마운트 필요).
 *
 * @param {string} fileUrl - DB 경로 (예: /uploads/uuid.pdf) 또는 http(s) URL
 */
export const openFileViewer = (fileUrl) => {
	if (!fileUrl) {
		Notify.toastWarn('등록된 파일이 없습니다.');
		return;
	}

	if (fileUrl.startsWith('http')) {
		window.open(fileUrl, '_blank', 'noopener,noreferrer');
		return;
	}

	const origin = getApiOrigin();
	const preferApi = process.env.REACT_APP_FILE_DOWNLOAD_VIA_API !== 'false';

	if (preferApi && fileUrl.startsWith('/uploads/')) {
		const saved = fileUrl.replace(/^\/uploads\//, '').split('?')[0];
		if (!saved) {
			Notify.toastWarn('파일 경로가 올바르지 않습니다.');
			return;
		}
		const fullUrl = `${origin}/api/common/files/by-saved-name/${encodeURIComponent(saved)}`;
		window.open(fullUrl, '_blank', 'noopener,noreferrer');
		return;
	}

	const fullUrl = `${origin}${fileUrl}`;
	window.open(fullUrl, '_blank', 'noopener,noreferrer');
};
