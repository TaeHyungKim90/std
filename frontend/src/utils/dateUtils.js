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
	const base = normalizeToMidnight(date);

	// 1) 주어진 날짜가 속한 주의 월요일
	const weekMonday = startOfWeekMonday(base);
	// 2) 해당 주의 목요일(월+3일)
	const weekThursday = addDays(weekMonday, 3);

	// 3) "그 주의 월"은 목요일이 속한 달
	const month = weekThursday.getMonth() + 1;

	// 4) 주차 기준점: (목요일이 속한 해/달)의 1일이 속한 주의 목요일
	const anchorYear = weekThursday.getFullYear();
	const anchorMonth0 = weekThursday.getMonth(); // 0-based
	const monthFirst = new Date(anchorYear, anchorMonth0, 1);
	const monthFirstWeekMonday = startOfWeekMonday(monthFirst);
	const monthFirstThursday = addDays(monthFirstWeekMonday, 3);

	const diffMs = weekThursday.getTime() - monthFirstThursday.getTime();
	const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
	const weekIndex = diffWeeks + 1;

	return { month, weekIndex };
};

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

