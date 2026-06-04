import { platformApi } from 'api/platformApi';
import {
	DEFAULT_BRANDING_ICON_PATH,
	DEFAULT_BRANDING_LOGO_PATH,
	DEFAULT_BRANDING_LOGO_SRC,
	resolveBrandingAssetUrl,
} from 'constants/tenantBranding';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const TenantBrandingMgmt = () => {
	const { showLoading, hideLoading } = useLoading();
	const [tenants, setTenants] = useState([]);
	const [selectedId, setSelectedId] = useState('');
	const [branding, setBranding] = useState(null);
	const [previewVersion, setPreviewVersion] = useState(0);
	const logoInputRef = useRef(null);
	const iconInputRef = useRef(null);

	const loadTenants = useCallback(async (withOverlay = true) => {
		try {
			if (withOverlay) showLoading('테넌트 목록을 불러오는 중...');
			const res = await platformApi.listTenants();
			const rows = Array.isArray(res.data) ? res.data : [];
			setTenants(rows);
			setSelectedId((prev) => (prev || (rows[0] ? String(rows[0].id) : '')));
		} catch (err) {
			Notify.toastApiFailure(err, '테넌트 목록을 불러오지 못했습니다.');
		} finally {
			if (withOverlay) hideLoading();
		}
	}, [showLoading, hideLoading]);

	const loadBranding = useCallback(
		async (tenantId, withOverlay = false) => {
			if (!tenantId) {
				setBranding(null);
				return;
			}
			try {
				if (withOverlay) showLoading('브랜딩 정보를 불러오는 중...');
				const res = await platformApi.getTenantBranding(tenantId);
				setBranding(res.data || null);
			} catch (err) {
				Notify.toastApiFailure(err, '브랜딩 정보를 불러오지 못했습니다.');
				setBranding(null);
			} finally {
				if (withOverlay) hideLoading();
			}
		},
		[showLoading, hideLoading]
	);

	useEffect(() => {
		loadTenants(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (selectedId) {
			loadBranding(selectedId, true);
		}
	}, [selectedId, loadBranding]);

	const selectedTenant = tenants.find((t) => String(t.id) === String(selectedId));

	const handleUpload = async (kind, file) => {
		if (!file || !selectedId) return;
		const formData = new FormData();
		formData.append('file', file);
		const apiCall =
			kind === 'logo'
				? () => platformApi.uploadTenantLogo(selectedId, formData)
				: () => platformApi.uploadTenantIcon(selectedId, formData);
		Notify.toastPromise(apiCall(), {
			loading: kind === 'logo' ? '로고를 업로드하는 중...' : '아이콘을 업로드하는 중...',
			success: '저장되었습니다.',
			error: (err) => err?.message || '업로드에 실패했습니다.',
		})
			.then((res) => {
				setBranding(res.data || null);
				setPreviewVersion((v) => v + 1);
				loadTenants(false);
			})
			.catch(() => {});
	};

	const onLogoChange = (e) => {
		const file = e.target.files?.[0];
		if (file) handleUpload('logo', file);
		e.target.value = '';
	};

	const onIconChange = (e) => {
		const file = e.target.files?.[0];
		if (file) handleUpload('icon', file);
		e.target.value = '';
	};

	const logoPreview = branding
		? resolveBrandingAssetUrl(branding.logo_url_effective, undefined, previewVersion)
		: resolveBrandingAssetUrl(DEFAULT_BRANDING_LOGO_PATH);
	const iconPreview = branding
		? resolveBrandingAssetUrl(branding.icon_url_effective, undefined, previewVersion)
		: resolveBrandingAssetUrl(DEFAULT_BRANDING_ICON_PATH);

	const usingDefaultLogo = !branding?.logo_url;
	const usingDefaultIcon = !branding?.icon_url;

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>
					<span>로고·아이콘</span> 브랜딩
				</h2>
				<p className="admin-header__hint">
					테넌트당 로고 1개·파비콘(아이콘) 1개만 등록합니다. 미등록 시 시스템 기본(
					<code>{DEFAULT_BRANDING_LOGO_PATH}</code>)이 적용됩니다.
				</p>
			</div>

			<div className="tenant-branding-toolbar">
				<label htmlFor="tenant-branding-select">테넌트</label>
				<select
					id="tenant-branding-select"
					className="cat-input tenant-branding-select"
					value={selectedId}
					onChange={(e) => setSelectedId(e.target.value)}
				>
					{tenants.length === 0 ? (
						<option value="">등록된 테넌트 없음</option>
					) : (
						tenants.map((t) => (
							<option key={t.id} value={String(t.id)}>
								{t.name} ({t.slug})
							</option>
						))
					)}
				</select>
			</div>

			{selectedTenant && branding ? (
				<div className="tenant-branding-grid">
					<section className="tenant-branding-card">
						<h3>로고</h3>
						<p className="tenant-branding-card__hint">
							HR·채용 헤더에 표시됩니다.
							{usingDefaultLogo ? (
								<span className="tenant-branding-badge">기본 이미지 사용 중</span>
							) : null}
						</p>
						<div className="tenant-branding-preview tenant-branding-preview--logo">
							<img
								src={logoPreview}
								alt={`${selectedTenant.name} 로고 미리보기`}
								onError={(e) => {
									e.currentTarget.onerror = null;
									e.currentTarget.src = DEFAULT_BRANDING_LOGO_SRC;
								}}
							/>
						</div>
						<input
							ref={logoInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
							className="tenant-branding-file"
							onChange={onLogoChange}
						/>
						<button
							type="button"
							className="btn-add"
							onClick={() => logoInputRef.current?.click()}
						>
							로고 업로드
						</button>
					</section>

					<section className="tenant-branding-card">
						<h3>아이콘 (favicon)</h3>
						<p className="tenant-branding-card__hint">
							브라우저 탭·즐겨찾기 아이콘입니다.
							{usingDefaultIcon ? (
								<span className="tenant-branding-badge">기본 이미지 사용 중</span>
							) : null}
						</p>
						<div className="tenant-branding-preview tenant-branding-preview--icon">
							<img src={iconPreview} alt={`${selectedTenant.name} 아이콘 미리보기`} />
						</div>
						<input
							ref={iconInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
							className="tenant-branding-file"
							onChange={onIconChange}
						/>
						<button
							type="button"
							className="btn-add"
							onClick={() => iconInputRef.current?.click()}
						>
							아이콘 업로드
						</button>
					</section>
				</div>
			) : (
				<p className="tenant-branding-empty">테넌트를 선택해 주세요.</p>
			)}
		</div>
	);
};

export default TenantBrandingMgmt;
