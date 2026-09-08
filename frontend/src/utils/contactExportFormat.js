import { normalizePhoneDigits } from 'utils/phoneNormalize';

/** 엑셀/화면용 전화: 010-3665-2602 */
export function formatPhoneDisplay(value) {
	let digits = normalizePhoneDigits(value);
	if (!digits) return '';
	// Excel/CSV에서 앞자리 0이 빠진 10자리(10xxxxxxxx) 복구
	if (digits.length === 10 && digits.startsWith('10')) {
		digits = `0${digits}`;
	}
	if (digits.length === 11) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
	}
	if (digits.length === 10) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
	}
	return digits;
}

/** 엑셀용 생년월일: YYYY-MM-DD 문자열 (Excel 날짜 자동변환 방지용) */
export function formatBirthDateForExport(value) {
	if (value == null || value === '') return '';
	const s = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
		return s.slice(0, 10);
	}
	// Excel 로케일 등으로 MM-DD-YYYY 가 된 경우
	const mdy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
	if (mdy) {
		const mm = mdy[1].padStart(2, '0');
		const dd = mdy[2].padStart(2, '0');
		return `${mdy[3]}-${mm}-${dd}`;
	}
	const digits = s.replace(/\D/g, '');
	if (digits.length === 8) {
		const yyyy = digits.slice(0, 4);
		// 19xx/20xx 로 시작하면 YYYYMMDD, 아니면 MMDDYYYY 로 가정
		if (yyyy.startsWith('19') || yyyy.startsWith('20')) {
			return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
		}
		return `${digits.slice(4, 8)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
	}
	return s;
}
