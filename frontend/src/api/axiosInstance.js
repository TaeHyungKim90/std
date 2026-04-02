import axios from 'axios';
import { formatApiDetail } from 'utils/formatApiError';
import { PATHS, PATH_PREFIX } from 'constants/paths';
import { AUTH_SESSION_EXPIRED_EVENT, API_SESSION_EXPIRED_CODE } from 'constants/authEvents';
import {
	APPLICANT_USER_STORAGE_KEY,
	APPLICANT_SESSION_UPDATED_EVENT,
} from 'constants/applicantCache';
import { showSessionExpiredToast } from 'utils/showSessionExpiredToast';

/**
 * Axios 인스턴스 (토큰 인터셉터 + 공통 에러 처리)
 * 에러 시 `Promise.reject(new Error(가공된메시지))` — 컴포넌트에서는
 * `catch (err) { Notify.toastApiFailure(err, '…'); }` 권장 — 세션 만료 시 중복 토스트 방지.
 * React 훅은 `hooks/useApiRequest.js` 참고.
 *
 * 401(로그인 요청 제외): 즉시 location 이동하지 않고 토스트(닫기 / 로그인으로)만 띄움.
 * `AUTH_SESSION_EXPIRED_EVENT`로 AuthContext가 직원 상태를 비웁니다.
 */
const baseURL = process.env.REACT_APP_API_BASE_URL ?? '';

export const client = axios.create({
	baseURL,
	headers: {
		'Content-Type': 'application/json'
	},
	withCredentials: true
});

function isCredentialLoginRequest(config) {
	const url = config?.url || '';
	return (
		url.includes('/auth/login') ||
		url.includes('/public/recruitment/login')
	);
}

// 인증: httpOnly 쿠키(accessToken). localStorage JWT는 사용하지 않음(XSS 완화).
client.interceptors.request.use(
	(config) => {
		delete config.headers.Authorization;
		return config;
	},
	(error) => Promise.reject(error)
);

/** `responseType: 'blob'` 요청의 에러 본문이 Blob(JSON)일 때 파싱해 formatApiDetail이 동작하도록 함 */
async function normalizeAxiosErrorBlobData(error) {
	const res = error.response;
	if (!res || !(res.data instanceof Blob)) return;
	try {
		const text = await res.data.text();
		try {
			res.data = JSON.parse(text);
		} catch {
			res.data = { detail: text || '' };
		}
	} catch {
		res.data = { detail: '' };
	}
}

client.interceptors.response.use(
	(response) => response,
	async (error) => {
		await normalizeAxiosErrorBlobData(error);

		const status = error.response?.status;
		const config = error.config || {};

		if (status === 401) {
			if (isCredentialLoginRequest(config)) {
				const msg = formatApiDetail(error) || '아이디 또는 비밀번호를 확인해 주세요.';
				return Promise.reject(new Error(msg));
			}

			const path = window.location.pathname;
			const onCareers = path.startsWith(PATH_PREFIX.CAREERS);
			const loginHref = onCareers ? PATHS.CAREERS_LOGIN : PATHS.LOGIN;
			const alreadyOnLogin = path === PATHS.LOGIN || path === PATHS.CAREERS_LOGIN;

			if (alreadyOnLogin) {
				return Promise.reject(new Error('세션이 만료되어 로그인이 필요합니다.'));
			}

			console.warn('세션이 만료되어 로그인이 필요합니다.');

			window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));

			if (onCareers) {
				sessionStorage.removeItem(APPLICANT_USER_STORAGE_KEY);
				window.dispatchEvent(
					new CustomEvent(APPLICANT_SESSION_UPDATED_EVENT, { detail: { user: null } })
				);
			}

			showSessionExpiredToast(loginHref);

			const expiredErr = new Error('세션이 만료되어 로그인이 필요합니다.');
			expiredErr.code = API_SESSION_EXPIRED_CODE;
			return Promise.reject(expiredErr);
		}

		const msg =
			formatApiDetail(error).trim() || '서버와 통신 중 오류가 발생했습니다.';
		return Promise.reject(new Error(msg));
	}
);
