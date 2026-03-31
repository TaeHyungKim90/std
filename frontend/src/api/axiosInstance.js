import axios from 'axios';
import { formatApiDetail } from 'utils/formatApiError';
import { PATHS, PATH_PREFIX } from 'constants/paths';

/**
 * Axios 인스턴스 (토큰 인터셉터 + 공통 에러 처리)
 * 에러 시 `Promise.reject(new Error(가공된메시지))` — 컴포넌트에서는
 * `catch (err) { Notify.toastError(err.message); }` 로 통일할 수 있습니다.
 * React 훅은 `hooks/useApiRequest.js` 참고.
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
			console.warn('세션이 만료되어 로그인이 필요합니다.');
			if (window.location.pathname.startsWith(PATH_PREFIX.CAREERS)) {
				if (window.location.pathname !== PATHS.CAREERS_LOGIN) {
					window.location.href = PATHS.CAREERS_LOGIN;
				}
			} else if (window.location.pathname !== PATHS.LOGIN) {
				window.location.href = PATHS.LOGIN;
			}
			return Promise.reject(new Error('세션이 만료되어 로그인이 필요합니다.'));
		}

		const msg =
			formatApiDetail(error).trim() || '서버와 통신 중 오류가 발생했습니다.';
		return Promise.reject(new Error(msg));
	}
);
