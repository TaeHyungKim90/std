import * as Notify from 'utils/toastUtils';
import { client } from 'api/axiosInstance';

/** axios baseURL 과 동일한 호스트(포트) — /api 제거 */
export function getApiOrigin() {
	const base = process.env.REACT_APP_API_BASE_URL || '';
	if (typeof base === 'string' && base.trim()) {
		return base.replace(/\/?api\/?$/i, '').replace(/\/$/, '') || 'http://localhost:8000';
	}
	return 'http://localhost:8000';
}

/**
 * 미리보기·iframe/img src용 절대 URL (인증 쿠키가 필요한 API 경로 포함).
 * @param {string} fileUrl - DB 경로 또는 http(s)
 * @returns {string|null}
 */
export function getFilePreviewUrl(fileUrl) {
	if (!fileUrl) return null;
	if (fileUrl.startsWith('http')) return fileUrl;
	const origin = getApiOrigin();
	const preferApi = process.env.REACT_APP_FILE_DOWNLOAD_VIA_API !== 'false';
	if (preferApi && fileUrl.startsWith('/uploads/')) {
		const saved = fileUrl.replace(/^\/uploads\//, '').split('?')[0];
		if (!saved) return null;
		return `${origin}/api/common/files/by-saved-name/${encodeURIComponent(saved)}`;
	}
	return `${origin}${fileUrl}`;
}

/**
 * 서버에 저장된 파일을 브라우저 새 창에서 엽니다.
 * - `SERVE_UPLOADS_STATIC=false` 인 경우: httpOnly 쿠키가 전달되도록 같은 API 호스트의
 *   `GET /api/common/files/by-saved-name/...` 로 엽니다 (직원 로그인 필요).
 * - `REACT_APP_FILE_DOWNLOAD_VIA_API=false` 이면 예전처럼 `/uploads/...` 직접 URL (정적 마운트 필요).
 *
 * @param {string} fileUrl - DB 경로 (예: /uploads/uuid.pdf) 또는 http(s) URL
 */
/**
 * 인증이 필요한 `GET /api/common/download/{fileId}` 를 Axios로 받아 새 탭에서 엽니다.
 * (직접 `<a href="/api/...">` 는 브라우저 전체가 JSON 에러 페이지로 바뀌므로 사용하지 않습니다.)
 * @param {number} fileId - uploaded_files.id
 * @param {string} [fallbackName] - 표시·다운로드용 파일명 힌트
 */
export async function openAuthenticatedDownloadByFileId(fileId, fallbackName) {
	try {
		const res = await client.get(`/common/download/${fileId}`, {
			responseType: 'blob',
		});
		const blob = res.data;
		if (!(blob instanceof Blob) || blob.size === 0) {
			Notify.toastError('파일을 불러오지 못했습니다.');
			return;
		}
		const url = URL.createObjectURL(blob);
		window.open(url, '_blank', 'noopener,noreferrer');
		setTimeout(() => URL.revokeObjectURL(url), 120_000);
	} catch (err) {
		Notify.toastError(err.message || '파일을 열 수 없습니다.');
	}
}

export const openFileViewer = (fileUrl) => {
	if (!fileUrl) {
		Notify.toastWarn('등록된 파일이 없습니다.');
		return;
	}

	if (fileUrl.startsWith('http')) {
		window.open(fileUrl, '_blank', 'noopener,noreferrer');
		return;
	}

	const fullUrl = getFilePreviewUrl(fileUrl);
	if (!fullUrl) {
		Notify.toastWarn('파일 경로가 올바르지 않습니다.');
		return;
	}
	window.open(fullUrl, '_blank', 'noopener,noreferrer');
};
