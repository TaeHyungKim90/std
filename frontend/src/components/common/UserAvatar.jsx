import 'assets/css/user-avatar.css';

import React, { useCallback, useMemo, useState } from 'react';
import { getFilePreviewUrl } from 'utils/fileUtils';

const getInitial = (value) => {
	const s = String(value ?? '').trim();
	if (!s) return '?';
	return Array.from(s)[0] || '?';
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** 크롭 모달과 동일: cover 스케일 후 줌·이동 (오프셋은 뷰포트 한 변 대비 정규화 -1~1) */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

/**
 * @param {string|number|null} props.imageCacheBust - 동일 /uploads URL 브라우저 캐시 무력화
 */
const UserAvatar = ({
	imageUrl,
	nickname,
	name,
	size = 56,
	className = '',
	avatarAdjust = null,
	imageCacheBust = null,
}) => {
	const [imgFailed, setImgFailed] = useState(false);
	const [natural, setNatural] = useState({ width: 0, height: 0 });

	const resolvedImgUrl = useMemo(() => {
		if (!imageUrl) return null;
		const s = String(imageUrl);
		if (s.startsWith('blob:') || s.startsWith('data:')) return s;
		let url = getFilePreviewUrl(s);
		if (!url) return null;
		if (imageCacheBust != null && String(imageCacheBust).length > 0) {
			const sep = url.includes('?') ? '&' : '?';
			url = `${url}${sep}cb=${encodeURIComponent(imageCacheBust)}`;
		}
		return url;
	}, [imageUrl, imageCacheBust]);

	const initial = useMemo(() => getInitial(nickname || name), [nickname, name]);

	const useCropLayout = avatarAdjust != null;

	const normalizedAdjust = useMemo(() => {
		const zoom = clamp(Number(avatarAdjust?.zoom ?? 1), MIN_ZOOM, MAX_ZOOM);
		const offsetX = clamp(Number(avatarAdjust?.offsetX ?? 0), -1, 1);
		const offsetY = clamp(Number(avatarAdjust?.offsetY ?? 0), -1, 1);
		return { zoom, offsetX, offsetY };
	}, [avatarAdjust?.offsetX, avatarAdjust?.offsetY, avatarAdjust?.zoom]);

	const onImgLoad = useCallback((e) => {
		const el = e.currentTarget;
		setNatural({
			width: el.naturalWidth || 1,
			height: el.naturalHeight || 1,
		});
		setImgFailed(false);
	}, []);

	const cropLayout = useMemo(() => {
		if (!useCropLayout || !natural.width || !natural.height) return null;
		const { width: nw, height: nh } = natural;
		const baseScale = Math.max(size / nw, size / nh);
		const scale = baseScale * normalizedAdjust.zoom;
		return {
			imgWidth: nw * scale,
			imgHeight: nh * scale,
			tx: normalizedAdjust.offsetX * size,
			ty: normalizedAdjust.offsetY * size,
		};
	}, [natural.height, natural.width, normalizedAdjust.offsetX, normalizedAdjust.offsetY, normalizedAdjust.zoom, size, useCropLayout]);

	return (
		<div
			className={`user-avatar ${className}`.trim()}
			style={{ width: size, height: size, position: 'relative' }}
			aria-label="사용자 아바타"
		>
			{resolvedImgUrl && !imgFailed ? (
				useCropLayout ? (
					cropLayout ? (
						<img
							src={resolvedImgUrl}
							alt=""
							className="user-avatar__img user-avatar__img--crop"
							style={{
								position: 'absolute',
								left: '50%',
								top: '50%',
								width: cropLayout.imgWidth,
								height: cropLayout.imgHeight,
								maxWidth: 'none',
								maxHeight: 'none',
								objectFit: 'fill',
								transform: `translate(calc(-50% + ${cropLayout.tx}px), calc(-50% + ${cropLayout.ty}px))`,
							}}
							onLoad={onImgLoad}
							onError={() => setImgFailed(true)}
						/>
					) : (
						<img
							src={resolvedImgUrl}
							alt=""
							className="user-avatar__img"
							style={{ width: size, height: size, objectFit: 'cover' }}
							onLoad={onImgLoad}
							onError={() => setImgFailed(true)}
						/>
					)
				) : (
					<img
						src={resolvedImgUrl}
						alt=""
						className="user-avatar__img"
						style={{ width: size, height: size }}
						onError={() => setImgFailed(true)}
					/>
				)
			) : (
				<div className="user-avatar__fallback" style={{ width: size, height: size }}>
					{initial}
				</div>
			)}
		</div>
	);
};

export default UserAvatar;
