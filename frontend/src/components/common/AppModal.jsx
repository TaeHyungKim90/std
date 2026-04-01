import React from 'react';

/**
 * `modal-overlay` + `modal-content` 패턴 공통화. 기존 `TodoTemplateModal` 등과 동일한 마크업 계약.
 */
const AppModal = ({
	isOpen,
	onClose,
	children,
	overlayClassName = 'modal-overlay',
	contentClassName = '',
}) => {
	if (!isOpen) return null;

	return (
		<div className={overlayClassName} onClick={onClose} role="presentation">
			<div
				className={`modal-content dynamic-enter ${contentClassName}`.trim()}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				{children}
			</div>
		</div>
	);
};

export default AppModal;
