import toast from 'react-hot-toast';
import { isSessionExpiredApiError } from 'constants/authEvents';
import { formatApiDetail } from 'utils/formatApiError';

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
	const msg = formatApiDetail(err).trim() || fallbackMessage;
	toast.error(msg);
}