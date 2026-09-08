/**
 * 휴대폰 숫자만 정규화. 카카오 `+82 10-...` → `010...`
 * (숫자만 남긴 뒤 11자리로 자르면 82가 남아 신원 매칭이 깨짐)
 */
export function normalizePhoneDigits(value) {
	if (value == null) return '';
	let digits = String(value).replace(/\D/g, '');
	if (!digits) return '';
	if (digits.startsWith('82') && digits.length >= 10) {
		digits = `0${digits.slice(2)}`;
	}
	return digits.slice(0, 11);
}
