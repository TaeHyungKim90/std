import { useState, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';

/**
 * axios `client` 호출을 감싸 로딩/데이터/에러 상태와 toastPromise를 묶습니다.
 * 인터셉터 전역 토스트와 겹치면 API 호출 config에 `{ skipGlobalErrorToast: true }`를 넣으세요.
 */
export const useApiRequest = (apiCall) => {
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState(null);
	const [error, setError] = useState(null);

	const request = useCallback(
		async (...args) => {
			setLoading(true);
			setError(null);
			return Notify.toastPromise(apiCall(...args), {
				loading: '요청을 처리하는 중입니다...',
				success: '요청이 완료되었습니다.',
				error: (err) => {
					const errMsg = err.response?.data?.detail || '서버 통신 중 오류가 발생했습니다.';
					setError(errMsg);
					return errMsg;
				}
			})
				.then((response) => {
					setData(response.data);
					return response.data;
				})
				.catch((err) => {
					console.error('API Error:', err);
					throw err;
				})
				.finally(() => {
					setLoading(false);
				});
		},
		[apiCall]
	);

	return { request, loading, data, error, setData };
};
