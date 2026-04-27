const SESSION_HTTPS_PAGE_HTTP_API = 'vp_api_warn_https_page_http_api';
const SESSION_HTTP_PAGE_HTTPS_API = 'vp_api_warn_http_page_https_api';

/**
 * 프론트(페이지)와 API 베이스(REACT_APP_API_BASE_URL) 스킴이 어긋나면 로그인 시 경고.
 * - https 페이지 + http API → mixed-content(브라우저 차단) 가능
 * - http 페이지 + https API → 보안·쿠키(Secure)·리다이렉트 등에서 동작이 꼬일 수 있음
 * 각 케이스당 탭 세션에서 한 번만 alert.
 */
export function warnApiBaseMismatchOnLogin() {
	if (typeof window === 'undefined') return;

	const apiBase = String(process.env.REACT_APP_API_BASE_URL ?? '').trim();
	if (!apiBase) return;

	let apiProtocol = '';
	try {
		apiProtocol = new URL(apiBase, window.location.href).protocol;
	} catch {
		return;
	}

	const pageIsHttps = window.location.protocol === 'https:';
	const apiIsHttp = apiProtocol === 'http:';
	const apiIsHttps = apiProtocol === 'https:';

	if (pageIsHttps && apiIsHttp && !sessionStorage.getItem(SESSION_HTTPS_PAGE_HTTP_API)) {
		sessionStorage.setItem(SESSION_HTTPS_PAGE_HTTP_API, '1');
		window.alert(
			'API 주소(REACT_APP_API_BASE_URL)가 http로 설정되어 있습니다.\n' +
				'지금 페이지는 https라서 브라우저가 API 호출을 차단할 수 있습니다(혼합 콘텐츠).\n' +
				'API 베이스를 https로 맞춘 뒤 프론트를 다시 빌드·배포해 주세요.'
		);
		return;
	}

	if (!pageIsHttps && apiIsHttps && !sessionStorage.getItem(SESSION_HTTP_PAGE_HTTPS_API)) {
		sessionStorage.setItem(SESSION_HTTP_PAGE_HTTPS_API, '1');
		window.alert(
			'API 주소(REACT_APP_API_BASE_URL)가 https로 설정되어 있습니다.\n' +
				'지금 페이지는 http라서 쿠키·리다이렉트·보안 정책 때문에 API가 실패할 수 있습니다.\n' +
				'페이지와 API를 같은 스킴(http끼리 또는 https끼리)으로 맞추거나, 서비스를 https로 통일해 주세요.'
		);
	}
}
