import { API_ENDPOINTS } from 'constants/constants';

import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트

const PATH = API_ENDPOINTS.ATTENDANCE;

const GEOLOCATION_TIMEOUT_FAST_MS = 28000;
const GEOLOCATION_TIMEOUT_ACCURATE_MS = 60000;

/** iOS Safari 등: Permissions API의 geolocation 상태가 실제와 어긋나는 경우가 많아 선차단하지 않음 */
const GEOLOCATION_ATTEMPTS = [
	{ enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_FAST_MS, maximumAge: 120000 },
	{ enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_ACCURATE_MS, maximumAge: 0 },
];

function geolocationErrorMessage(error) {
	if (!error || typeof error.code !== 'number') {
		return '위치 정보를 가져오지 못했습니다.';
	}
	const appleHint =
		' (Mac/iPhone: 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스 켜기 → Safari(또는 Chrome)에서 이 사이트 위치 「허용」 후 페이지 새로고침)';
	switch (error.code) {
		case 1:
			return `위치 권한이 거부되었습니다. 브라우저·기기 설정에서 이 사이트의 위치를 허용해 주세요.${appleHint}`;
		case 2:
			return '현재 위치를 확인할 수 없습니다. Wi‑Fi·셀룰러를 켠 뒤 실외 또는 창가에서 다시 시도해 주세요.';
		case 3:
			return `위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도하거나, Wi‑Fi를 켠 뒤 재시도해 주세요.${appleHint}`;
		default:
			return '위치 정보를 가져오지 못했습니다.';
	}
}

function getCurrentPositionWithOptions(options) {
	return new Promise((resolve, reject) => {
		navigator.geolocation.getCurrentPosition(
			(position) => {
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				});
			},
			(error) => {
				console.error('GPS 획득 실패:', error);
				reject(error);
			},
			options
		);
	});
}

async function getCurrentLocationWithFallback() {
	let lastError = null;
	for (let i = 0; i < GEOLOCATION_ATTEMPTS.length; i += 1) {
		try {
			return await getCurrentPositionWithOptions(GEOLOCATION_ATTEMPTS[i]);
		} catch (error) {
			lastError = error;
			if (error?.code === 1) break;
			if (i < GEOLOCATION_ATTEMPTS.length - 1) continue;
		}
	}
	throw new Error(geolocationErrorMessage(lastError));
}

export const attendanceApi = {
	/**
	 * 오늘 나의 출퇴근 기록 조회
	 * GET /hr/attendance/today
	 */
	getTodayAttendance: () => client.get(`${PATH}/today`),

	/**
	 * 출퇴근 확인 팝업용 맥락(휴가·공휴일·주말)
	 * GET /hr/attendance/clock-context?work_date=선택
	 */
	getClockContext: (workDate) =>
		client.get(`${PATH}/clock-context`, {
			params: workDate ? { work_date: workDate } : {},
		}),

	/**
	 * 특정 근무일 세션 목록 + 일별 합산
	 * GET /hr/attendance/day/sessions?work_date=YYYY-MM-DD
	 */
	getAttendanceDaySessions: (workDate) =>
		client.get(`${PATH}/day/sessions`, { params: { work_date: workDate } }),

	/**
	 * 특정 근무일의 본인 출퇴근 기록 (없으면 data null)
	 * GET /hr/attendance/day?work_date=YYYY-MM-DD
	 */
	getAttendanceForDay: (workDate) =>
		client.get(`${PATH}/day`, { params: { work_date: workDate } }),

	/**
	 * 월간 캘린더 도장 상태 (점수/순위 제외)
	 * GET /hr/attendance/calendar-stamps?year=&month=
	 */
	getCalendarStamps: ({ year, month }) =>
		client.get(`${PATH}/calendar-stamps`, { params: { year, month } }),

	/**
	 * 출퇴근 선택용 활성 근무장소 목록
	 * GET /hr/attendance/work-locations
	 */
	getWorkLocations: () => client.get(`${PATH}/work-locations`),

	/**
	 * 선호 출퇴근 근무장소 저장(기기 간 동기화). 활성 목록 값만 허용.
	 * PATCH /hr/attendance/preferred-work-location
	 */
	patchPreferredWorkLocation: (data) => client.patch(`${PATH}/preferred-work-location`, data),

	/**
	 * 출근하기
	 * POST /hr/attendance/clock-in
	 */
	clockIn: (data) => client.post(`${PATH}/clock-in`, data),

	/**
	 * 퇴근하기
	 * POST /hr/attendance/clock-out
	 */
	clockOut: (data) => client.post(`${PATH}/clock-out`, data),

	/**
	 * 🌐 브라우저 GPS 좌표 가져오기 (Helper)
	 */
	/**
	 * GPS 좌표 (클릭 핸들러에서 즉시 호출해 Promise를 시작하는 것을 권장 — iOS 사용자 제스처 유지)
	 */
	getCurrentLocation: () => {
		if (!navigator.geolocation) {
			return Promise.reject(new Error('이 브라우저에서는 위치 정보를 지원하지 않습니다.'));
		}
		if (typeof window !== 'undefined' && !window.isSecureContext) {
			return Promise.reject(
				new Error('위치 정보는 HTTPS(보안 연결)에서만 사용할 수 있습니다. 주소가 https:// 인지 확인해 주세요.')
			);
		}
		return getCurrentLocationWithFallback();
	},
};