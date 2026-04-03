import { API_ENDPOINTS } from 'constants/constants';

import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트

const PATH = API_ENDPOINTS.ADMIN_HOLIDAYS.replace(/\/$/, '');
/** FastAPI `@router.get("/")` 는 `/admin/holidays/` 로 등록되어 슬래시 없으면 307 리다이렉트 발생 */
const HOLIDAYS_ROOT = `${PATH}/`;

export const holidayApi = {
	getHolidays: (year = '') =>
		client.get(year ? `${HOLIDAYS_ROOT}?year=${year}` : HOLIDAYS_ROOT),

	createHoliday: (holidayData) => client.post(HOLIDAYS_ROOT, holidayData),

	// 공휴일 삭제
	deleteHoliday: (holidayId) => 
		client.delete(`${PATH}/${holidayId}`),

	// 공공데이터 연동
	syncHolidays: (year) => 
		client.post(`${PATH}/sync/${year}`)
};