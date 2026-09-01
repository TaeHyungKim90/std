import defaultIcon from 'assets/icon/favicon.png';
import { BASE_URL } from 'constants/apiConfig';

/** 시스템 기본(미등록 테넌트) — CRA public / 백엔드 /assets/icon/favicon.png */
export const DEFAULT_BRANDING_LOGO_PATH = '/assets/icon/favicon.png';
export const DEFAULT_BRANDING_ICON_PATH = '/assets/icon/favicon.png';

/** 번들 자산(개발·CRA) — API 미연결 시 폴백 */
export const DEFAULT_BRANDING_LOGO_SRC = defaultIcon;

/**
 * API·정적 경로를 브라우저에서 쓸 전체 URL로 변환.
 * @param {string|null|undefined} path
 * @param {string} [apiOrigin]
 */
function withCacheBust(url, cacheBust) {
	if (!cacheBust) return url;
	return `${url}${url.includes('?') ? '&' : '?'}v=${cacheBust}`;
}

export function resolveBrandingAssetUrl(path, apiOrigin = BASE_URL, cacheBust) {
	if (!path) {
		const origin = (apiOrigin || '').replace(/\/$/, '');
		if (process.env.NODE_ENV === 'development') {
			return withCacheBust(DEFAULT_BRANDING_LOGO_PATH, cacheBust);
		}
		return withCacheBust(`${origin}${DEFAULT_BRANDING_LOGO_PATH}`, cacheBust);
	}
	if (/^https?:\/\//i.test(path)) {
		return withCacheBust(path, cacheBust);
	}
	const normalized = path.startsWith('/') ? path : `/${path}`;
	// /api/... — CRA dev proxy·배포 동일 출처
	if (normalized.startsWith('/api/')) {
		if (process.env.NODE_ENV === 'development') {
			return withCacheBust(normalized, cacheBust);
		}
		const origin = (apiOrigin || '').replace(/\/$/, '');
		return withCacheBust(`${origin}${normalized}`, cacheBust);
	}
	const origin = (apiOrigin || '').replace(/\/$/, '');
	return withCacheBust(`${origin}${normalized}`, cacheBust);
}
