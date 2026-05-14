/**
 * 출퇴근 화면: 마지막으로 선택·출근한 근무장소 location_key를 브라우저에 보관 (계정별).
 * 민감도가 낮은 값이며, httpOnly 쿠키와 무관.
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

export const writePreferredWorkLocation = (userId, locationKey) => {
	const key = preferredWorkLocationStorageKey(userId);
	if (!key || typeof window === 'undefined' || !window.localStorage) return;
	const v = locationKey == null ? '' : String(locationKey).trim();
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
 * @param {string[]} allowedKeys - 현재 API에서 내려온 활성 근무장소 location_key 목록
 * @param {Record<string, string> | undefined} legacyLabelToKey - 예전에 표시명만 localStorage에 둔 경우 복구용 (label → key)
 * @returns {string|null} 저장된 key가 목록에 있으면 그 key, 아니면 null
 */
export const resolvePreferredAgainstOptions = (userId, allowedKeys, legacyLabelToKey) => {
	const stored = readPreferredWorkLocation(userId);
	if (!stored) return null;
	const set = new Set((allowedKeys || []).map((s) => String(s)));
	if (set.has(stored)) return stored;
	if (legacyLabelToKey && typeof legacyLabelToKey === 'object') {
		const mapped = legacyLabelToKey[String(stored)];
		if (mapped && set.has(String(mapped))) return String(mapped);
	}
	return null;
};
