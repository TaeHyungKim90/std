import axios from 'axios';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';

/**
 * Axios 인스턴스 (토큰 인터셉터 + 공통 에러 처리)
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

client.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('accessToken');

		if (token && token !== 'null') {
			config.headers.Authorization = `Bearer ${token}`;
		} else {
			delete config.headers.Authorization;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

client.interceptors.response.use(
	(response) => response,
	(error) => {
		const status = error.response?.status;
		const config = error.config || {};

		if (status === 401) {
			if (isCredentialLoginRequest(config)) {
				return Promise.reject(error);
			}
			console.warn('세션이 만료되어 로그인이 필요합니다.');
			if (window.location.pathname.startsWith('/careers')) {
				if (window.location.pathname !== '/careers/login') {
					window.location.href = '/careers/login';
				}
			} else if (window.location.pathname !== '/login') {
				window.location.href = '/login';
			}
			return Promise.reject(error);
		}

		if (!config.skipGlobalErrorToast) {
			const errorMsg =
				formatApiDetail(error.response?.data?.detail) ||
				'서버와 통신 중 오류가 발생했습니다.';
			Notify.toastError(errorMsg);
		}

		return Promise.reject(error);
	}
);
