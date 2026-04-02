/**
 * Date/Time utilities (frontend)
 * - Keep functions pure and side-effect free.
 * - All outputs are local-time based unless stated otherwise.
 */

export const pad2 = (n) => String(n).padStart(2, '0');

export const toYmd = (d) => {
	if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const getTodayYmd = () => {
	const d = new Date();
	return toYmd(d);
};

export const parseYmdParam = (val) => {
	if (typeof val !== 'string') return null;
	return /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : null;
};

export const normalizeToMidnight = (d) => {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
};

// JS Date: Sunday=0, Monday=1 ... Saturday=6
export const startOfWeekMonday = (d) => {
	const x = normalizeToMidnight(d);
	const day = x.getDay();
	const offset = (day + 6) % 7; // Monday -> 0, Sunday -> 6
	x.setDate(x.getDate() - offset);
	return x;
};

export const addDays = (d, days) => {
	const x = normalizeToMidnight(d);
	x.setDate(x.getDate() + days);
	return x;
};

export const addMonths = (d, months) => {
	const x = normalizeToMidnight(d);
	const y = x.getFullYear();
	const m = x.getMonth();
	const targetM = m + months;
	const targetY = y + Math.floor(targetM / 12);
	const targetMonth0 = ((targetM % 12) + 12) % 12;
	const lastDay = new Date(targetY, targetMonth0 + 1, 0).getDate();
	const clampedDay = Math.min(x.getDate(), lastDay);
	return new Date(targetY, targetMonth0, clampedDay);
};

export const firstMondayOnOrAfter = (monthStart) => {
	const x = normalizeToMidnight(monthStart);
	while (x.getDay() !== 1) {
		x.setDate(x.getDate() + 1);
	}
	return x;
};

/**
 * HR 표준(ISO 8601 응용): "목요일이 속한 달"을 그 주의 월로 산정하고,
 * 해당 달의 1일이 속한 주의 목요일을 기준으로 n주차를 계산한다.
 *
 * @returns {{ month: number, weekIndex: number }}
 */
export const getIsoMonthAndWeek = (date) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);

	// 1. 해당 주의 목요일 구하기 (기준점)
	const day = d.getDay(); // 0:일, 1:월 ... 6:토
	const diffToThursday = day === 0 ? -3 : 4 - day; 
	const targetThursday = new Date(d);
	targetThursday.setDate(d.getDate() + diffToThursday);

	// 2. 타겟 월(Month)은 목요일이 속한 월
	const targetYear = targetThursday.getFullYear();
	const targetMonth = targetThursday.getMonth(); 

	// 3. 타겟 월의 1일이 속한 주의 목요일 구하기
	const firstDayOfMonth = new Date(targetYear, targetMonth, 1);
	const firstDayDay = firstDayOfMonth.getDay();
	const firstDayDiffToThursday = firstDayDay === 0 ? -3 : 4 - firstDayDay;
	const firstThursday = new Date(firstDayOfMonth);
	firstThursday.setDate(firstDayOfMonth.getDate() + firstDayDiffToThursday);

	// 4. 핵심 방어 로직: 1일의 목요일이 이전 달이라면, '그다음 주 목요일'이 진짜 1주차!
	let monthFirstThursday = new Date(firstThursday);
	if (firstThursday.getMonth() !== targetMonth) {
		monthFirstThursday.setDate(firstThursday.getDate() + 7);
	}

	// 5. (현재 목요일 - 진짜 1주차 목요일) / 7일 + 1 = 현재 주차
	const diffInMs = targetThursday.getTime() - monthFirstThursday.getTime();
	const weekIndex = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7)) + 1;

	return {
		year: targetYear,
		month: targetMonth + 1, // 1-based
		weekIndex: weekIndex
	};
}

export const toTimeInputValue = (iso) => {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * Format datetime-ish value into HH:MM (local time).
 * Used by attendance UIs that show only time part.
 */
export const formatDt = (iso) => {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const formatYmdToMd = (ymd) => {
	if (!ymd) return '-';
	const d = new Date(`${ymd}T00:00:00`);
	if (Number.isNaN(d.getTime())) return '-';
	return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
};

export const formatYmdToWeekKo = (ymd) => {
	if (!ymd) return '—';
	const d = new Date(`${ymd}T00:00:00`);
	if (Number.isNaN(d.getTime())) return '—';
	return `(${WEEK_KO[d.getDay()]})`;
};

export const isWeekendYmd = (ymd) => {
	const d = new Date(`${ymd}T00:00:00`);
	if (Number.isNaN(d.getTime())) return false;
	const day = d.getDay();
	return day === 0 || day === 6;
};

export const formatWorkMinutes = (minutes) => {
	if (minutes === null || minutes === undefined) return '-';
	const n = Number(minutes);
	if (!Number.isFinite(n) || n < 0) return '-';
	const h = Math.floor(n / 60);
	const m = n % 60;
	return `${h}시간 ${m}분`;
};

// Backward-compat name used by some pages
export const formatWorkTime = formatWorkMinutes;

export const normalizeStatus = (status) => (status ?? '').toString().trim().toUpperCase();

/**
 * Format datetime-ish value into HH:mm:ss (local time).
 * Used by HR Attendance page (clock-in/out timestamps).
 */
export const formatTimeHms = (iso) => {
	if (!iso) return '-';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleTimeString('ko-KR', { hour12: false });
};

/**
 * Convert Date -> local ISO without milliseconds (YYYY-MM-DDTHH:mm:ss).
 * This "shifts" by timezone offset to preserve local wall-clock when stringifying.
 */
export const toLocalIsoNoMs = (date) => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
	return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
		.toISOString()
		.split('.')[0];
};

/**
 * Convert Date -> local YYYY-MM-DD.
 */
export const toLocalYmd = (date) => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
	return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
		.toISOString()
		.split('T')[0];
};

