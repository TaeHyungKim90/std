// src/services/holidayService.js

import { client } from '../utils/apiUtils';
import { API_ENDPOINTS } from '../utils/constants';

// 상수로 정의된 엔드포인트 경로를 가져옵니다.
const PATH = API_ENDPOINTS.ADMIN_HOLIDAYS;

export const holidayService = {
    // 공휴일 목록 조회 (연도별 필터링 지원)
    getHolidays: async (year = '') => {
        // 쿼리 파라미터가 있으면 붙여서, 없으면 기본 PATH로 요청
        const url = year ? `${PATH}?year=${year}` : PATH;
        return await client.get(url);
    },

    // 신규 공휴일 등록
    createHoliday: async (holidayData) => {
        return await client.post(PATH, holidayData);
    },

    // 공휴일 삭제
    deleteHoliday: async (holidayId) => {
        return await client.delete(`${PATH}/${holidayId}`);
    },
    // 공공데이터 연동
    syncHolidays: async (year) => {
        return await client.post(`${PATH}/sync/${year}`);
    }
};