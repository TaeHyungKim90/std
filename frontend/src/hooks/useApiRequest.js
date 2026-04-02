import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { isSessionExpiredApiError } from 'constants/authEvents';

/**
 * axios `client` 호출을 감싸 로딩/토스트/상태를 묶습니다.
 * 401 세션 만료(`API_SESSION_EXPIRED_CODE`) 시에는 인터셉터 전용 토스트만 쓰고 여기서는 에러 토스트를 띄우지 않습니다.
 */
export const useApiRequest = (apiCall) => {
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState(null);
	const [error, setError] = useState(null);

	const request = useCallback(
		async (...args) => {
			setLoading(true);
			setError(null);
			const loadingId = Notify.toastLoading('요청을 처리하는 중입니다...');
			try {
				const response = await apiCall(...args);
				toast.dismiss(loadingId);
				Notify.toastSuccess('요청이 완료되었습니다.');
				setData(response.data);
				return response.data;
			} catch (err) {
				toast.dismiss(loadingId);
				console.error('API Error:', err);
				const errMsg =
					formatApiDetail(err) || '서버 통신 중 오류가 발생했습니다.';
				setError(errMsg);
				if (!isSessionExpiredApiError(err)) {
					Notify.toastError(errMsg);
				}
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[apiCall]
	);

	return { request, loading, data, error, setData };
};
