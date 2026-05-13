import { API_ENDPOINTS } from 'constants/constants';

import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트

const PATH = API_ENDPOINTS.ATTENDANCE;

/** 브라우저 위치 권한 팝업에서 사용자가 응답할 때까지 기다릴 수 있도록 여유 있게 둡니다. */
const GEOLOCATION_TIMEOUT_MS = 90000;

function geolocationErrorMessage(error) {
	if (!error || typeof error.code !== 'number') {
		return '위치 정보를 가져오지 못했습니다.';
	}
	switch (error.code) {
		case 1:
			return '위치 권한이 거부되었습니다. 브라우저 또는 기기 설정에서 위치 권한을 허용해 주세요.';
		case 2:
			return '현재 위치를 확인할 수 없습니다. GPS·네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
		case 3:
			return '위치 확인 시간이 초과되었습니다. 권한 요청 창에서 허용을 누른 뒤 다시 시도해 주세요.';
		default:
			return '위치 정보를 가져오지 못했습니다.';
	}
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
	getCurrentLocation: async () => {
		if (!navigator.geolocation) {
			throw new Error('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
		}

		let deniedBeforePrompt = false;
		if (navigator.permissions?.query) {
			try {
				const status = await navigator.permissions.query({ name: 'geolocation' });
				if (status.state === 'denied') {
					deniedBeforePrompt = true;
				}
			} catch (_) {
				/* Permissions API 미지원 등은 무시하고 getCurrentPosition 사용 */
			}
		}
		if (deniedBeforePrompt) {
			throw new Error(geolocationErrorMessage({ code: 1 }));
		}

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
					reject(new Error(geolocationErrorMessage(error)));
				},
				{
					enableHighAccuracy: true,
					timeout: GEOLOCATION_TIMEOUT_MS,
					maximumAge: 0,
				}
			);
		});
	},
};