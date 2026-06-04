import { client } from 'api/axiosInstance';
import LoadingBar from 'components/common/LoadingBar';
import { pathsForTenant, TENANT_PARAM } from 'constants/paths';
import { DEFAULT_BRANDING_LOGO_SRC, resolveBrandingAssetUrl } from 'constants/tenantBranding';
import React, { createContext, useContext, useMemo } from 'react';
import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';

export const TenantContext = createContext(null);

export function useTenant() {
	const ctx = useContext(TenantContext);
	if (!ctx) {
		throw new Error('useTenant는 TenantProvider 내부에서만 사용할 수 있습니다.');
	}
	return ctx;
}

/** 현재 테넌트 기준 PATHS (Link, navigate용) */
export function useAppPaths() {
	return useTenant().paths;
}

/**
 * /:tenantSlug 하위 라우트 — slug 검증 후 자식 Outlet 렌더.
 */
export function TenantLayout() {
	const { tenantSlug: rawSlug } = useParams();
	const tenantSlug = (rawSlug || '').toLowerCase();
	const [status, setStatus] = useState('loading');
	const [tenantName, setTenantName] = useState('');
	const [logoUrl, setLogoUrl] = useState(DEFAULT_BRANDING_LOGO_SRC);
	const [iconUrl, setIconUrl] = useState(DEFAULT_BRANDING_LOGO_SRC);

	const paths = useMemo(() => pathsForTenant(tenantSlug), [tenantSlug]);

	useEffect(() => {
		if (!tenantSlug) {
			setStatus('invalid');
			return;
		}
		let cancelled = false;
		setStatus('loading');
		client
			.get(`/tenants/${encodeURIComponent(tenantSlug)}/exists`, {
				headers: { 'X-Tenant-Slug': tenantSlug },
			})
			.then((res) => {
				if (cancelled) return;
				if (res.data?.exists) {
					setTenantName(res.data.name || tenantSlug);
					setLogoUrl(
						res.data.logo_url
							? resolveBrandingAssetUrl(res.data.logo_url)
							: DEFAULT_BRANDING_LOGO_SRC
					);
					setIconUrl(
						res.data.icon_url
							? resolveBrandingAssetUrl(res.data.icon_url)
							: DEFAULT_BRANDING_LOGO_SRC
					);
					setStatus('ok');
				} else {
					setStatus('invalid');
				}
			})
			.catch(() => {
				if (!cancelled) setStatus('invalid');
			});
		return () => {
			cancelled = true;
		};
	}, [tenantSlug]);

	useEffect(() => {
		if (status !== 'ok' || !tenantName) return;
		document.title = tenantName;
	}, [status, tenantName]);

	useEffect(() => {
		if (status !== 'ok' || !iconUrl) return;
		let link = document.querySelector('link[rel="shortcut icon"]');
		if (!link) {
			link = document.createElement('link');
			link.rel = 'shortcut icon';
			link.type = 'image/png';
			document.head.appendChild(link);
		}
		link.href = iconUrl;
	}, [status, iconUrl]);

	const value = useMemo(
		() => ({ tenantSlug, tenantName, logoUrl, iconUrl, paths }),
		[tenantSlug, tenantName, logoUrl, iconUrl, paths]
	);

	if (status === 'loading') {
		return <LoadingBar text="기업 정보를 확인하는 중..." />;
	}

	if (status === 'invalid') {
		return (
			<div className="flex min-h-screen items-center justify-center p-8 text-center">
				<div>
					<h1 className="text-xl font-semibold">등록되지 않은 기업입니다</h1>
					<p className="mt-2 text-gray-600">
						주소의 기업 코드(<code>{tenantSlug}</code>)를 확인해 주세요.
					</p>
				</div>
			</div>
		);
	}

	return (
		<TenantContext.Provider value={value}>
			<Outlet />
		</TenantContext.Provider>
	);
}

export { TENANT_PARAM };
