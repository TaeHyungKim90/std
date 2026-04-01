import React from 'react';

/**
 * 우측 슬라이드 패널 + 오버레이. `UserAttendanceDrawer`·보고서 화면 등에서 공통 사용.
 * 스타일은 호출부에서 `overlayClassName` / `panelClassName`으로 지정합니다.
 */
const SideDrawer = ({
	open,
	onClose,
	children,
	overlayClassName = 'rep-drawer-overlay',
	panelClassName = 'rep-drawer-panel',
	closeAriaLabel = '닫기',
}) => {
	if (!open) return null;

	return (
		<>
			<button type="button" aria-label={closeAriaLabel} onClick={onClose} className={overlayClassName} />
			<aside role="dialog" aria-modal="true" className={panelClassName}>
				{children}
			</aside>
		</>
	);
};

export default SideDrawer;
