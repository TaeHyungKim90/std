import { client } from './axiosInstance.js';
import { API_ENDPOINTS } from '../constants/constants';

const PATH = API_ENDPOINTS.ADMIN_HOLIDAYS;

export const holidayApi = {
    // 공휴일 목록 조회 (연도별 필터링 지원)
    getHolidays: (year = '') => 
        client.get(year ? `${PATH}?year=${year}` : PATH),

    // 신규 공휴일 등록
    createHoliday: (holidayData) => 
        client.post(PATH, holidayData),

    // 공휴일 삭제
    deleteHoliday: (holidayId) => 
        client.delete(`${PATH}/${holidayId}`),

    // 공공데이터 연동
    syncHolidays: (year) => 
        client.post(`${PATH}/sync/${year}`)
};