import axios from 'axios';
import { useState, useCallback } from 'react';

/**
 * 1. Axios 인스턴스 설정
 * 백엔드 서버가 8000포트에서 실행 중이라면, 
 * 개발 환경(Proxy 설정 시)에 맞춰 baseURL을 설정합니다.
 */
export const client = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL, // FastAPI의 APIRouter prefix와 맞춤
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true, 
});
/**
 * 2 요청 인터셉터 추가 (추가할 부분 ✅)
 * 서버로 요청이 나가기 직전에 브라우저의 localStorage에서 토큰을 꺼내 헤더에 담습니다.
 */
client.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
/**
 * 3. 응답 인터셉터 추가
 * 모든 응답에 대해 에러가 발생하기 전/후에 가로채서 처리합니다.
 */
client.interceptors.response.use(
    (response) => {
      // 200번대 응답은 그대로 반환
      return response;
    },
    (error) => {
      // 에러 상태 코드가 401(Unauthorized)인 경우
      if (error.response && error.response.status === 401) {
        console.warn("세션이 만료되어 로그인이 필요합니다.");
        
        // 🌟 해결 포인트 1: 로그인 API 자체에서 발생한 401(비번 틀림 등)은 리다이렉트 무시!
        if (window.location.pathname.startsWith('/careers')) {
          // 지원자가 채용 페이지에 있다면 -> 지원자용 로그인으로
          if (window.location.pathname !== '/careers/login') {
              window.location.href = '/careers/login';
          }
        } else {
          // 직원이 사내 시스템에 있다면 -> 직원용 로그인으로
          if (window.location.pathname !== '/login') {
              window.location.href = '/login';
          }
        }
      }
      
      // 에러를 그대로 호출한 곳으로 전달
      return Promise.reject(error);
    }
);
/**
 * 4. 공통 비동기 핸들러 (Custom Hook)
 * loading, data, error 상태를 자동으로 관리해줍니다.
 */
export const useApiRequest = (apiCall) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const request = useCallback(async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(...args);
        setData(response.data);
        return response.data; // 성공 시 실제 데이터 반환
      } catch (err) {
        // FastAPI에서 보낸 상세 에러 메시지가 있다면 추출
        const errMsg = err.response?.data?.detail || '서버 통신 중 오류가 발생했습니다.';
        setError(errMsg);
        console.error("API Error:", errMsg);
        throw err; 
      } finally {
        setLoading(false);
      }
    }, [apiCall]);

  return { request, loading, data, error, setData }; // setData를 포함해 수동 업데이트 가능하게 함
};

