import { endSessionRedirect } from 'utils/sessionRedirect';

/** BrowserRouter 내부에서 등록 — 세션 만료 시 SPA navigate용 */
let navigateFn = null;

export function registerAuthNavigate(navigate) {
	navigateFn = navigate;
}

export function navigateToLogin(loginPath, { replace = true } = {}) {
	if (!loginPath) {
		endSessionRedirect();
		return false;
	}
	if (typeof navigateFn === 'function') {
		navigateFn(loginPath, { replace });
		window.setTimeout(endSessionRedirect, 800);
		return true;
	}
	window.location.replace(loginPath);
	endSessionRedirect();
	return true;
}
