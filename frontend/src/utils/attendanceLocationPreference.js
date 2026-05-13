/**
 * 출퇴근 화면: 마지막으로 선택·출근한 근무장소 문자열을 브라우저에 보관 (계정별).
 * 민감도가 낮은 표시용 문자열이며, httpOnly 쿠키와 무관.
 */

const KEY_PREFIX = 'std:attendance:preferredWorkLocation:';

export const preferredWorkLocationStorageKey = (userId) => {
	if (userId == null || String(userId).trim() === '') return null;
	return `${KEY_PREFIX}${String(userId).trim()}`;
};

export const readPreferredWorkLocation = (userId) => {
	const key = preferredWorkLocationStorageKey(userId);
	if (!key || typeof window === 'undefined' || !window.localStorage) return null;
	try {
		const raw = window.localStorage.getItem(key);
		if (raw == null || raw === '') return null;
		return String(raw);
	} catch {
		return null;
	}
};

export const writePreferredWorkLocation = (userId, locationValue) => {
	const key = preferredWorkLocationStorageKey(userId);
	if (!key || typeof window === 'undefined' || !window.localStorage) return;
	const v = locationValue == null ? '' : String(locationValue).trim();
	if (!v) return;
	try {
		window.localStorage.setItem(key, v);
	} catch {
		/* quota / private mode */
	}
};

export const clearPreferredWorkLocation = (userId) => {
	const key = preferredWorkLocationStorageKey(userId);
	if (!key || typeof window === 'undefined' || !window.localStorage) return;
	try {
		window.localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
};

/**
 * @param {string[]} allowedValues - 현재 API에서 내려온 활성 근무장소 value 목록
 * @returns {string|null} 저장값이 목록에 있으면 그 값, 아니면 null
 */
export const resolvePreferredAgainstOptions = (userId, allowedValues) => {
	const stored = readPreferredWorkLocation(userId);
	if (!stored) return null;
	const set = new Set((allowedValues || []).map((s) => String(s)));
	return set.has(stored) ? stored : null;
};
