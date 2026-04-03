import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/** HR 일정·재직 구간 판단용 (달력 날짜 = 서울 기준) */
export const SEOUL_TZ = 'Asia/Seoul';

/**
 * 서버/Date/문자열을 서울 달력 기준 YYYY-MM-DD로 통일.
 * 날짜만 오는 값(YYYY-MM-DD)은 서울의 그 날짜로 해석.
 */
export function toSeoulYmd(dateLike) {
	if (dateLike == null || dateLike === '') return '';
	const s = String(dateLike).trim();
	const head = s.slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
		return dayjs.tz(head, 'YYYY-MM-DD', SEOUL_TZ).format('YYYY-MM-DD');
	}
	const d = dayjs(s);
	if (!d.isValid()) return '';
	return d.tz(SEOUL_TZ).format('YYYY-MM-DD');
}

export function seoulYmdAddDays(ymd, days) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
	return dayjs.tz(ymd, 'YYYY-MM-DD', SEOUL_TZ).add(days, 'day').format('YYYY-MM-DD');
}

/**
 * @param {string} startYmd YYYY-MM-DD (inclusive)
 * @param {string} endYmd YYYY-MM-DD (inclusive)
 * @returns {string|null} 에러 메시지 또는 null
 */
export function getEmploymentRangeError(startYmd, endYmd, joinYmdOrNull, resignYmdOrNull) {
	const a0 = String(startYmd).slice(0, 10);
	const b0 = String(endYmd).slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(a0) || !/^\d{4}-\d{2}-\d{2}$/.test(b0)) return null;
	let a = a0;
	let b = b0;
	if (a > b) [a, b] = [b, a];

	if (joinYmdOrNull) {
		const j = toSeoulYmd(joinYmdOrNull);
		if (j && a < j) return '입사일 이전 날짜에는 일정을 등록할 수 없습니다.';
		if (j && b < j) return '입사일 이전 날짜에는 일정을 등록할 수 없습니다.';
	}
	if (resignYmdOrNull) {
		const r = toSeoulYmd(resignYmdOrNull);
		if (r && a > r) return '퇴사일 이후 날짜에는 일정을 등록할 수 없습니다.';
		if (r && b > r) return '퇴사일 이후 날짜에는 일정을 등록할 수 없습니다.';
	}
	return null;
}

export function isSeoulYmdWithinEmployment(ymd, joinYmdOrNull, resignYmdOrNull) {
	const y = String(ymd).slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return true;
	return getEmploymentRangeError(y, y, joinYmdOrNull, resignYmdOrNull) == null;
}

/**
 * FullCalendar 종일 이벤트/선택: end는 배타적.
 * @returns {{ startYmd: string, endYmd: string }} 서울 기준 포함 구간
 */
export function fcAllDaySpanToInclusiveYmd(start, endExclusive) {
	const s = toSeoulYmd(start);
	if (!endExclusive) return { startYmd: s, endYmd: s };
	const ex = toSeoulYmd(endExclusive);
	if (!ex) return { startYmd: s, endYmd: s };
	let last = seoulYmdAddDays(ex, -1);
	let lo = s;
	let hi = last;
	if (lo > hi) [lo, hi] = [hi, lo];
	return { startYmd: lo, endYmd: hi };
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DB: 시작일 00:00:00, 종료일(포함) 당일 23:59:59.
 * FullCalendar 종일: end는 배타적 → (종료 포함일 서울 YMD) + 1일 문자열.
 */
export function todoDbToFullCalendarAllDayRange(startDateTimeFromApi, endDateTimeFromApi) {
	const startYmd = toSeoulYmd(startDateTimeFromApi);
	const endInclusiveYmd = toSeoulYmd(endDateTimeFromApi ?? startDateTimeFromApi);
	if (!YMD_RE.test(startYmd) || !YMD_RE.test(endInclusiveYmd)) return null;
	const endExclusiveYmd = seoulYmdAddDays(endInclusiveYmd, 1);
	if (!YMD_RE.test(endExclusiveYmd)) return null;
	return { start: startYmd, end: endExclusiveYmd };
}
