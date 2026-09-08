/**
 * 생년월일 등 YYYY-MM-DD 텍스트 입력용.
 * 한글 Windows `input[type=date]`는 자릿수 입력이 깨질 수 있어(예: 19900505 → 199005-05-일)
 * 숫자만 모아 하이픈을 붙입니다.
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 입력값에서 숫자만 최대 8자리 추출 */
export function digitsFromYmdInput(raw) {
	return String(raw ?? '')
		.replace(/\D/g, '')
		.slice(0, 8);
}

/**
 * 19900505 → 1990-05-05, 199005 → 1990-05, 1990 → 1990
 * @param {string} raw
 * @returns {string}
 */
export function formatDigitsToYmd(raw) {
	const d = digitsFromYmdInput(raw);
	if (d.length <= 4) return d;
	if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
	return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

/** 완전한 YYYY-MM-DD 이면 그대로, 아니면 '' (type=date picker 동기화용) */
export function completeYmdOrEmpty(value) {
	const s = String(value ?? '').trim();
	return YMD_RE.test(s) ? s : '';
}

export function isCompleteYmd(value) {
	return YMD_RE.test(String(value ?? '').trim());
}
