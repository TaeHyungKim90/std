/**
 * 같은 출처 탭 간 로그아웃 동기화.
 * - BroadcastChannel: 즉시 전파 (발신 탭은 tabId로 자기 메시지 무시)
 * - localStorage + storage 이벤트: BC 미지원/백업용 (발신 탭에는 storage 이벤트가 안 옴)
 */

const CHANNEL_NAME = 'todo-auth-logout-v1';
const STORAGE_KEY = 'todo_auth_logout_ts';

function getTabId() {
	let id = sessionStorage.getItem('auth_tab_id');
	if (!id) {
		id =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
		sessionStorage.setItem('auth_tab_id', id);
	}
	return id;
}

/**
 * 로그아웃 성공 직후 호출: 다른 탭에 무전(신호) 발송.
 */
export function broadcastLogoutSignal() {
	const payload = { type: 'LOGOUT', from: getTabId(), at: Date.now() };

	if (typeof BroadcastChannel !== 'undefined') {
		try {
			const ch = new BroadcastChannel(CHANNEL_NAME);
			ch.postMessage(payload);
			ch.close();
		} catch {
			/* ignore */
		}
	}

	try {
		// 다른 탭에 storage 이벤트를 보내기 위한 최소 기록 — 유지할 필요 없음
		localStorage.setItem(STORAGE_KEY, String(payload.at));
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* private mode 등 */
	}
}

/**
 * 다른 탭에서 로그아웃 신호를 받았을 때 콜백 (짧은 시간 내 중복 호출 방지).
 * @param {() => void} onRemoteLogout
 * @returns {() => void} 구독 해제
 */
export function subscribeLogoutFromOtherTabs(onRemoteLogout) {
	let lastRun = 0;

	const run = () => {
		const now = Date.now();
		if (now - lastRun < 800) return;
		lastRun = now;
		onRemoteLogout();
	};

	const onStorage = (e) => {
		if (e.key === STORAGE_KEY && e.newValue != null) {
			run();
		}
	};
	window.addEventListener('storage', onStorage);

	let ch;
	if (typeof BroadcastChannel !== 'undefined') {
		try {
			ch = new BroadcastChannel(CHANNEL_NAME);
			ch.onmessage = (event) => {
				const data = event.data;
				if (data?.type === 'LOGOUT' && data.from !== getTabId()) {
					run();
				}
			};
		} catch {
			/* ignore */
		}
	}

	return () => {
		window.removeEventListener('storage', onStorage);
		if (ch) {
			try {
				ch.close();
			} catch {
				/* ignore */
			}
		}
	};
}
