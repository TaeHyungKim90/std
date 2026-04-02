/**
 * 긴 로그인 ID·UUID 등을 목록에서 짧게 표시할 때 사용합니다.
 * @param {string|number|null|undefined} value
 * @param {{ head?: number; tail?: number }} [opts]
 */
export function formatIdSnippet(value, opts = {}) {
	const { head = 6, tail = 4 } = opts;
	if (value == null || value === '') return '';
	const s = String(value);
	if (s.length <= head + tail + 1) return s;
	return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** 이 길이 이상이면 목록에서 줄여 보이기 (이메일·UUID 등) */
export function shouldAbbreviateId(value, minLen = 20) {
	if (value == null || value === '') return false;
	return String(value).length >= minLen;
}
