import { isSessionExpiredApiError } from 'constants/authEvents';
import toast from 'react-hot-toast';

export const toastWarn = (msg, opts = {}) =>
	toast(msg, {
		icon: '⚠️',
		style: { background: '#FFF3CD', color: '#856404' },
		duration: 5000,
		...opts,
	});
export const toastInfo = (msg) => toast(msg, { icon: '💡', style: { background: '#E2E3E5', color: '#383D41' }});

export const toastSuccess = toast.success;
export const toastError = toast.error;
export const toastLoading = toast.loading;
export const toastPromise = toast.promise;

/** API 실패 토스트 — 401 세션 만료는 인터셉터 전용 토스트만 쓰므로 여기서는 생략 */
export function toastApiFailure(err, fallbackMessage) {
	if (isSessionExpiredApiError(err)) return;
	// 콘솔에는 원인(에러 객체)까지 남기고, 사용자는 통일된 안내 문구만 봅니다.
	// fallbackMessage: "사용자 친화 문구", err: "디버깅용 디테일"
	// eslint-disable-next-line no-console
	console.error(`[API FAILURE] ${fallbackMessage}`, err);
	toast.error(fallbackMessage);
}