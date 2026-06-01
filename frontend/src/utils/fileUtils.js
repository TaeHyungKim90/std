import { BASE_URL } from 'constants/apiConfig';
import { PATHS } from 'constants/paths';
import * as Notify from 'utils/toastUtils';

/** axios baseURL 과 동일한 호스트(포트) — /api 제거 */
export function getApiOrigin() {
	const base = process.env.REACT_APP_API_BASE_URL || '';
	if (typeof base === 'string' && base.trim()) {
		return base.replace(/\/?api\/?$/i, '').replace(/\/$/, '') || BASE_URL;
	}
	return BASE_URL;
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
 * 인증이 필요한 첨부파일을 앱 내부 PDF 뷰어 탭으로 엽니다.
 * 인앱 브라우저에서 기본 PDF 뷰어가 검은 화면이 되는 경우를 피하기 위한 경로입니다.
 * @param {number} fileId - uploaded_files.id
 * @param {string} [fallbackName] - 표시·다운로드용 파일명 힌트
 */
export async function openAuthenticatedDownloadByFileId(fileId, _fallbackName) {
	try {
		const params = new URLSearchParams({ fileId: String(fileId) });
		if (_fallbackName) {
			params.set('name', _fallbackName);
		}
		const url = `${window.location.origin}${PATHS.MY_PDF_VIEWER}?${params.toString()}`;
		window.open(url, '_blank', 'noopener,noreferrer');
	} catch (err) {
		Notify.toastApiFailure(err, '파일을 열 수 없습니다.');
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
