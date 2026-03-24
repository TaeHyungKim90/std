import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트
import { API_ENDPOINTS } from 'constants/constants';
const PATH = API_ENDPOINTS.AUTH;
export const authApi = {
    /**
   * 1. 일반 로그인
   * POST /api/auth/login
   */
  login: (id, pw) => 
    client.post(`${PATH}/login`, { id, pw }),
  /**
   * 2. 로그아웃 (쿠키 삭제)
   * POST /api/auth/logout
   */
  logout: () => 
    client.post(`${PATH}/logout`),
  /**
   * 3. 인증 상태 확인 (리프레시 대응)
   * GET /api/auth/check
   */
  checkAuth: () => 
    client.get(`${PATH}/check`),

  /**
   * 4. 일반 회원가입
   * POST /api/auth/signup
   */
  signup: (payload) => 
    client.post(`${PATH}/signup`, payload),

  /**
   * 5. 아이디 중복 확인
   * POST /api/auth/check-id
   */
  checkId: (user_login_id) => 
    client.post(`${PATH}/check-id`, { user_login_id }),

  /**
   * 6. 카카오 로그인 URL 요청
   * GET /api/auth/kakao/login
   */
  getKakaoLoginUrl: () => 
    client.get(`${PATH}/kakao/login`),

  /**
   * 7. 네이버 로그인 URL 요청 (준비용)
   * GET /api/auth/naver/login
   */
  getNaverLoginUrl: () => 
    client.get(`${PATH}/naver/login`),
  
}