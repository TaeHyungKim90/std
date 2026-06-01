/** 플랫폼(SaaS) 관리 경로 — 테넌트 slug prefix 없음 */

export const PLATFORM_ROOT = '/platform';

export const PLATFORM_PATHS = {
	LOGIN: `${PLATFORM_ROOT}/login`,
	TENANTS: `${PLATFORM_ROOT}/tenants`,
};

export const PLATFORM_ROUTE_SEGMENTS = {
	LOGIN: 'login',
	TENANTS: 'tenants',
};
