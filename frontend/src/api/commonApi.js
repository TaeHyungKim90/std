import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트
import { API_ENDPOINTS } from 'constants/constants';

const COMMON_PATH = API_ENDPOINTS.COMMON;
export const commonApi = {
    uploadFiles: (formData) => client.post(`${COMMON_PATH}/upload`, formData, {headers: { 'Content-Type': 'multipart/form-data' }}),
};
