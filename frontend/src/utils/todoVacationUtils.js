import { seoulYmdAddDays, toSeoulYmd } from 'utils/employmentDateUtils';

export const VACATION_DEDUCTIBLE_CATEGORIES = new Set([
	'vacation_full',
	'vacation_am',
	'vacation_pm',
]);

export const MY_VACATION_OVERLAP_MESSAGE =
	'해당 날짜에 이미 내 연차 일정이 있어 추가 등록할 수 없습니다.';

/**
 * FullCalendar 이벤트 또는 API todo extendedProps → 서울 기준 포함 구간 [from, to].
 */
export function getEventInclusiveYmdRange(event) {
	const props = event.extendedProps || {};
	const startYmd = toSeoulYmd(props.start_date || event.start);
	if (!startYmd) return null;

	let endYmd = toSeoulYmd(props.end_date);
	if (!endYmd && event.end) {
		const exclusive = toSeoulYmd(event.end);
		endYmd = exclusive ? seoulYmdAddDays(exclusive, -1) : '';
	}
	if (!endYmd) endYmd = startYmd;

	const from = startYmd <= endYmd ? startYmd : endYmd;
	const to = startYmd <= endYmd ? endYmd : startYmd;
	return { from, to };
}

function rangesOverlapYmd(aFrom, aTo, bFrom, bTo) {
	return aFrom <= bTo && bFrom <= aTo;
}

/** 본인 연차·반차(차감 대상)가 해당 날짜와 겹치는지 */
export function hasOwnVacationOnDate(events, ymd, userId) {
	if (!ymd || !userId) return false;
	return events.some((event) => {
		const props = event.extendedProps || {};
		if (props.user_id !== userId) return false;
		if (!VACATION_DEDUCTIBLE_CATEGORIES.has(props.category)) return false;
		const span = getEventInclusiveYmdRange(event);
		if (!span) return false;
		return span.from <= ymd && ymd <= span.to;
	});
}

/** 본인 연차·반차가 [startYmd, endYmd] 구간과 하루라도 겹치는지 */
export function hasOwnVacationOverlappingRange(events, startYmd, endYmd, userId) {
	if (!startYmd || !endYmd || !userId) return false;
	const lo = startYmd <= endYmd ? startYmd : endYmd;
	const hi = startYmd <= endYmd ? endYmd : startYmd;
	return events.some((event) => {
		const props = event.extendedProps || {};
		if (props.user_id !== userId) return false;
		if (!VACATION_DEDUCTIBLE_CATEGORIES.has(props.category)) return false;
		const span = getEventInclusiveYmdRange(event);
		if (!span) return false;
		return rangesOverlapYmd(span.from, span.to, lo, hi);
	});
}
