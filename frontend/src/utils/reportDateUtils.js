import dayjs from 'dayjs';

import { toSeoulYmd } from './employmentDateUtils';

/**
 * 입사일 값이 null/undefined/빈 문자열이 아니고 dayjs로 파싱 가능한 경우에만 true.
 * @param {unknown} joinDateLike — 서버 join_date 값
 */
export function hasUsableHireDate(joinDateLike) {
	if (joinDateLike == null) return false;
	const s = String(joinDateLike).trim();
	if (!s) return false;
	return dayjs(s).isValid();
}

/**
 * 일일보고용: 보고일(ymd)과 입사일을 서울 달력 기준 '일' 단위로만 비교.
 * @param {string} ymd
 * @param {string | Date | null | undefined} joinDate 서버 join_date 값
 * @returns {boolean} 입사일보다 이전이면 true (작성 불가)
 */
export function isYmdStrictlyBeforeJoinDate(ymd, joinDate) {
	if (!joinDate) return false;
	const a = toSeoulYmd(String(ymd).trim().slice(0, 10));
	const b = toSeoulYmd(joinDate);
	if (!a || !b) return false;
	return a < b;
}

/**
 * 출근 기록이 없거나 결근으로 보이는 경우 → 작성 전 확인(confirm) 대상.
 * @param {object | null | undefined} record AttendanceResponse
 */
export function shouldConfirmNoAttendanceRecord(record) {
	if (!record) return true;
	if (!record.clock_in_time) return true;
	const s = (record.status ?? '').toString().trim().toUpperCase();
	if (s.includes('ABSENT') || s.includes('결근')) return true;
	return false;
}

/**
 * Drawer 상단에 출·퇴근 시각 참고 표시 여부 (출근 시각 있고 결근 등이 아님).
 */
export function canShowAttendanceReference(record) {
	if (!record?.clock_in_time) return false;
	return !shouldConfirmNoAttendanceRecord(record);
}
