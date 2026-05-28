import React from 'react';
import toast from 'react-hot-toast';

const DEDUP_MS = 3000;
let lastShownAt = 0;

const boxStyle = {
	background: '#2d2d2d',
	color: '#fff',
	padding: '16px 18px',
	borderRadius: 10,
	maxWidth: 380,
	boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
	fontSize: 14,
	lineHeight: 1.5,
};

const actionsStyle = {
	display: 'flex',
	gap: 8,
	justifyContent: 'flex-end',
	flexWrap: 'wrap',
	marginTop: 12,
};

const btnBase = {
	cursor: 'pointer',
	fontSize: 14,
	fontWeight: 600,
	padding: '8px 14px',
	borderRadius: 8,
	border: 'none',
};

/**
 * 세션 만료(401) 안내 — 즉시 리다이렉트 대신 토스트로 작성 중 폼 보호.
 * 연속 401은 짧은 시간 내 한 번만 표시합니다.
 * @param {string} loginHref 로그인(또는 지원자 로그인) 절대 경로
 * @param {Function} onBeforeRedirect 로그인 화면 이동 전 실행할 정리 작업
 */
export function showSessionExpiredToast(loginHref, onBeforeRedirect) {
	const now = Date.now();
	if (now - lastShownAt < DEDUP_MS) return;
	lastShownAt = now;

	const redirectToLogin = (toastId) => {
		toast.dismiss(toastId);
		if (typeof onBeforeRedirect === 'function') {
			onBeforeRedirect();
		}
		window.location.href = loginHref;
	};

	toast.custom(
		(t) => (
			<div style={boxStyle} role="alert">
				<strong style={{ display: 'block', marginBottom: 6 }}>세션이 만료되었습니다</strong>
				<span>
					저장하지 않은 내용이 있으면 메모해 두세요. 닫으면 로그인 화면으로 이동합니다.
				</span>
				<div style={actionsStyle}>
					<button
						type="button"
						style={{
							...btnBase,
							background: 'transparent',
							color: '#ccc',
							border: '1px solid #555',
						}}
						onClick={() => redirectToLogin(t.id)}
					>
						닫기
					</button>
					<button
						type="button"
						style={{
							...btnBase,
							background: '#28a745',
							color: '#fff',
						}}
						onClick={() => redirectToLogin(t.id)}
					>
						로그인으로 이동
					</button>
				</div>
			</div>
		),
		{ duration: Infinity, id: 'session-expired' }
	);
}
