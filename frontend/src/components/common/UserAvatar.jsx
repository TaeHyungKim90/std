import 'assets/css/user-avatar.css';

import React, { useMemo, useState } from 'react';
import { getFilePreviewUrl } from 'utils/fileUtils';

const getInitial = (value) => {
	const s = String(value ?? '').trim();
	if (!s) return '?';
	// 한글 포함: 첫 글자(유니코드 서러게이트 이슈 방지 위해 Array.from 사용)
	return Array.from(s)[0] || '?';
};

/**
 * @param {object} props
 * @param {string|null|undefined} props.imageUrl - 서버 파일 경로(/uploads/...) 또는 http URL
 * @param {string|null|undefined} props.nickname - 빈 사진 대체 이니셜용
 * @param {string|null|undefined} props.name - nickname 없을 때 대체 이니셜용
 * @param {number} props.size - px
 * @param {string} props.className
 */
const UserAvatar = ({ imageUrl, nickname, name, size = 56, className = '' }) => {
	const [imgFailed, setImgFailed] = useState(false);

	const resolvedImgUrl = useMemo(() => {
		if (!imageUrl) return null;
		const s = String(imageUrl);
		// 이미지 미리보기 URL(blob:, data:)는 파일 유틸을 거치지 않습니다.
		if (s.startsWith('blob:') || s.startsWith('data:')) return s;
		const url = getFilePreviewUrl(s);
		return url || null;
	}, [imageUrl]);

	const initial = useMemo(() => getInitial(nickname || name), [nickname, name]);

	return (
		<div
			className={`user-avatar ${className}`.trim()}
			style={{ width: size, height: size }}
			aria-label="사용자 아바타"
		>
			{resolvedImgUrl && !imgFailed ? (
				<img
					src={resolvedImgUrl}
					alt=""
					className="user-avatar__img"
					style={{ width: size, height: size }}
					onError={() => setImgFailed(true)}
				/>
			) : (
				<div className="user-avatar__fallback" style={{ width: size, height: size }}>
					{initial}
				</div>
			)}
		</div>
	);
};

export default UserAvatar;

