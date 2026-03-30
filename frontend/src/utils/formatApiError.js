/**
 * FastAPI/Starlette 응답의 `detail`을 UI·토스트에 쓸 문자열로 변환합니다.
 * 문자열, 422 검증 오류 배열({ type, loc, msg, ... }), 단일 객체 모두 처리합니다.
 */
export function formatApiDetail(detail) {
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
	if (typeof detail === 'object' && detail !== null && 'msg' in detail) {
		return String(detail.msg);
	}
	try {
		return JSON.stringify(detail);
	} catch {
		return '';
	}
}
