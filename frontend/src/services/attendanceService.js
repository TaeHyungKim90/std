import { client } from '../utils/apiUtils'; // api.js에서 만든 공통 client 임포트
import { API_ENDPOINTS } from '../utils/constants';

const PATH = API_ENDPOINTS.ATTENDANCE;

export const attendanceService = {
  /**
   * 오늘 나의 출퇴근 기록 조회
   * GET /hr/attendance/today
   */
  getTodayAttendance: () => client.get(`${PATH}/today`),

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
  getCurrentLocation: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("이 브라우저에서는 위치 정보를 지원하지 않습니다."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("GPS 획득 실패:", error);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }
};