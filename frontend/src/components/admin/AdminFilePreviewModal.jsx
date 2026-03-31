import React, { useMemo } from 'react';
import { getFilePreviewUrl } from 'utils/fileUtils';
import 'assets/css/admin.css';

function fileExtensionFromPath(fileUrl) {
	if (!fileUrl) return '';
	const path = fileUrl.split('?')[0].split('#')[0];
	const base = path.split('/').pop() || '';
	const i = base.lastIndexOf('.');
	return i >= 0 ? base.slice(i + 1).toLowerCase() : '';
}

/**
 * 관리자 화면: PDF·이미지는 모달 안에서 미리보기, 그 외는 안내 후 새 탭.
 */
const AdminFilePreviewModal = ({ isOpen, onClose, fileUrl, fileLabel = '첨부 파일' }) => {
	const resolvedUrl = useMemo(() => getFilePreviewUrl(fileUrl), [fileUrl]);
	const ext = useMemo(() => fileExtensionFromPath(fileUrl || ''), [fileUrl]);

	if (!isOpen || !resolvedUrl) return null;

	const isPdf = ext === 'pdf';
	const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

	const openNewTab = () => {
		window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
	};

	return (
		<div className="admin-file-preview-backdrop" role="presentation" onClick={onClose}>
			<div
				className="admin-file-preview-panel dynamic-enter"
				role="dialog"
				aria-modal="true"
				aria-label={fileLabel}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="admin-file-preview-header">
					<span className="admin-file-preview-title">{fileLabel}</span>
					<div className="admin-file-preview-actions">
						<button type="button" className="admin-file-preview-tab-btn" onClick={openNewTab}>
							새 탭
						</button>
						<button type="button" className="admin-file-preview-close" onClick={onClose} aria-label="닫기">
							×
						</button>
					</div>
				</div>
				<div className="admin-file-preview-body">
					{isPdf && (
						<iframe title={fileLabel} src={resolvedUrl} className="admin-file-preview-frame" />
					)}
					{isImage && (
						<div className="admin-file-preview-img-wrap">
							<img src={resolvedUrl} alt={fileLabel} className="admin-file-preview-img" />
						</div>
					)}
					{!isPdf && !isImage && (
						<div className="admin-file-preview-fallback">
							<p>이 형식은 브라우저에서 바로 미리보기할 수 없습니다.</p>
							<button type="button" className="btn-primary" onClick={openNewTab}>
								새 탭에서 열기
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default AdminFilePreviewModal;
