import axios from 'axios';
import { formatApiDetail } from 'utils/formatApiError';

import { PLATFORM_PATHS } from '../constants/platformPaths';

const baseURL = process.env.REACT_APP_API_BASE_URL ?? '';

export const platformClient = axios.create({
	baseURL,
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true,
});

platformClient.interceptors.request.use(
	(config) => {
		delete config.headers.Authorization;
		if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
			if (typeof config.headers.delete === 'function') {
				config.headers.delete('Content-Type');
			} else {
				delete config.headers['Content-Type'];
			}
		}
		return config;
	},
	(error) => Promise.reject(error),
);

platformClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		const status = error.response?.status;
		const config = error.config || {};
		const isLogin = (config.url || '').includes('/platform/auth/login');

		if (status === 401 && !isLogin) {
			const path = window.location.pathname;
			if (path !== PLATFORM_PATHS.LOGIN) {
				window.location.href = PLATFORM_PATHS.LOGIN;
			}
			return Promise.reject(new Error('플랫폼 세션이 만료되었습니다.'));
		}

		const msg = formatApiDetail(error).trim() || '서버와 통신 중 오류가 발생했습니다.';
		return Promise.reject(new Error(msg));
	},
);

export const platformApi = {
	login: (payload) => platformClient.post('/platform/auth/login', payload),
	logout: () => platformClient.post('/platform/auth/logout'),
	me: () => platformClient.get('/platform/auth/me'),
	listTenants: () => platformClient.get('/platform/tenants'),
	createTenant: (payload) => platformClient.post('/platform/tenants', payload),
	updateTenant: (id, payload) => platformClient.patch(`/platform/tenants/${id}`, payload),
};
