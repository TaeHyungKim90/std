/**
 * FastAPI/Starlette 응답의 `detail` 페이로드를 UI·토스트용 문자열로 변환합니다.
 * 문자열, 422 검증 오류 배열({ type, loc, msg, ... }), 단일 객체 모두 처리합니다.
 */
function formatDetailPayload(detail) {
	if (detail == null || detail === '') return '';
	if (typeof detail === 'string') return detail;
	if (Array.isArray(detail)) {
		return detail
			.map((item) => {
				if (typeof item === 'string') return item;
				if (item && typeof item === 'object' && item.msg != null) return String(item.msg);
				return '';
			})
			.filter(Boolean)
			.join(' ');
	}
	if (typeof detail === 'object' && detail !== null && typeof detail.message === 'string') {
		return detail.message;
	}
	if (typeof detail === 'object' && detail !== null && 'msg' in detail) {
		return String(detail.msg);
	}
	try {
		return JSON.stringify(detail);
	} catch {
		return '';
	}
}

/**
 * Axios 에러 객체 전체 또는 `detail` 값만 넘겨도 동작합니다.
 * 인터셉터에서 `formatApiDetail(error)` 형태로 호출하는 것을 권장합니다.
 */
export function formatApiDetail(errorOrDetail) {
	if (errorOrDetail == null || errorOrDetail === '') return '';

	// AxiosError는 Error를 상속하므로 `response` 분기를 먼저 처리
	if (typeof errorOrDetail === 'object' && errorOrDetail !== null && 'response' in errorOrDetail) {
		const res = errorOrDetail.response;
		if (!res) {
			const code = errorOrDetail.code;
			const msg = errorOrDetail.message || '';
			if (code === 'ECONNABORTED' || msg === 'Network Error' || code === 'ERR_NETWORK') {
				return '네트워크 연결을 확인해 주세요.';
			}
			return msg || '요청을 완료할 수 없습니다.';
		}
		const data = res.data;
		if (data == null) return '';
		const fromDetail = formatDetailPayload(data.detail ?? data.message);
		if (fromDetail) return fromDetail;
		if (typeof data === 'string') return data;
		return '';
	}

	if (errorOrDetail instanceof Error) {
		return errorOrDetail.message || '';
	}

	return formatDetailPayload(errorOrDetail);
}
