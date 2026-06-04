/**
 * Jest — TenantContext 목 (setupTests에서 전역 등록).
 */
const React = require('react');
const { pathsForTenant } = require('constants/paths');

const DEFAULT_TEST_SLUG = 'valuesplay';

function buildTenantMocks(slug = DEFAULT_TEST_SLUG) {
	const paths = pathsForTenant(slug);
	const tenantValue = {
		tenantSlug: slug,
		tenantName: '가치플레이',
		logoUrl: '/assets/icon/favicon.png',
		iconUrl: '/assets/icon/favicon.png',
		paths,
	};
	const Ctx = React.createContext(tenantValue);
	return {
		__esModule: true,
		TenantContext: Ctx,
		useTenant: () => tenantValue,
		useAppPaths: () => paths,
		TenantLayout: ({ children }) =>
			React.createElement(Ctx.Provider, { value: tenantValue }, children),
		TENANT_PARAM: ':tenantSlug',
	};
}

module.exports = buildTenantMocks();
