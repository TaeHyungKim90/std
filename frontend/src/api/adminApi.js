import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트
import { API_ENDPOINTS } from 'constants/constants';
import { DEFAULT_PAGE_SIZE } from 'constants/apiConfig';
const PATH = API_ENDPOINTS.ADMIN;
export const adminApi = {
  /**
   * 1. 모든 사용자의 일정 목록 조회 (관리자용)
   * GET /api/admin/all-todo-list
   */
  getAllTodos: (params = {}) =>
	client.get(`${PATH}/todos`, {
		params: { ...params, skip: params.skip ?? 0, limit: params.limit ?? DEFAULT_PAGE_SIZE },
	}),

  /**
   * 5. 특정 날짜에 걸친 '연차/휴가' todo 목록 조회 (직원별 포함, 관리자용)
   * GET /api/admin/todos/vacations/for-date?work_date=YYYY-MM-DD
   */
  getVacationTodosForDate: (workDate) =>
	client.get(`${PATH}/todos/vacations/for-date`, { params: { work_date: workDate } }),

  deleteTodoByAdmin: (id) => 
	client.delete(`${PATH}/todos/${id}`),
  /**
   * 2. 대시보드 통계 데이터 조회
   * GET /api/admin/dashboard
   */
  getDashboard: () => 
	client.get(`${PATH}/stats`),

  /**
   * 3. 카테고리 마스터 목록 조회
   * GET /api/admin/category-types
   */
  getCategoryTypes: () => 
	client.get(`${PATH}/category-types`),

  /**
   * 4. 새로운 카테고리 마스터 등록
   * POST /api/admin/category-types
   * @param {object} payload - { category_key, category_name, icon }
   */
  createCategoryType: (payload) => 
	client.post(`${PATH}/category-types`, payload),
  // 카테고리 수정
  updateCategoryType: (id, payload) => 
	client.patch(`${PATH}/category-types/${id}`, payload),

  // 카테고리 삭제
  deleteCategoryType: (id) => 
	client.delete(`${PATH}/category-types/${id}`),
  /**
   * ⏰ 출퇴근 기록 조회 (필터 포함)
   */
  getAllAttendance: (params = {}) =>
	client.get(`${PATH}/attendance/all`, { params }),

  /**
   * ⏰ 특정 직원 기간별 근태 조회 (관리자)
   * GET /api/admin/attendance/user/{userId}/range?start_date=&end_date=
   */
  getUserAttendanceRange: (userId, startDate, endDate) =>
	client.get(`${PATH}/attendance/user/${encodeURIComponent(userId)}/range`, {
		params: { start_date: startDate, end_date: endDate },
	}),

  /**
   * ⏰ 근태 단건 수정 (관리자)
   * PATCH /api/admin/attendance/records/{recordId}
   */
  updateAttendance: (recordId, payload) =>
	client.patch(`${PATH}/attendance/records/${recordId}`, payload),
  /**
   * 👥 유저 관리 기능 추가
   */
// 모든 사용자 목록 조회
  getUsers: () => 
	client.get(`${PATH}/users`), //

  // 신규 사용자 등록
  createUser: (payload) => 
	client.post(`${PATH}/users`, payload), //

  // 사용자 정보 수정 (PATCH)
  updateUser: (userId, payload) => 
	client.patch(`${PATH}/users/${userId}`, payload), //

  // 사용자 삭제
  deleteUser: (userId) => 
	client.delete(`${PATH}/users/${userId}`), //
  
  // 연차 일괄 정산
  syncVacations: () => 
	client.post(`${PATH}/users/vacations/sync`), //
};