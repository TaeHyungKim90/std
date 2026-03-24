import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트
import { API_ENDPOINTS } from 'constants/constants';

const PATH = API_ENDPOINTS.HR_TODOS;
export const todoService = {
  /**
   * 1. 모든 일정 조회 (GET /api/todos/)
   * 백엔드 Route: @router.get("/", response_model=List[schemas.Todo])
   */
  // ✅ 유저용 카테고리 마스터 목록 불러오기
  getCategories: () => client.get(`${PATH}/categories`),
  getTodoConfigs: () => client.get(`${PATH}/config`),
  updateTodoConfig: (configData) => client.put(`${PATH}/config`, configData),

  getTodos: (skip = 0, limit = 100) => 
    client.get(`${PATH}/`, { params: { skip, limit } }),

  /**
   * 2. 새 일정 등록 (POST /api/todos/)
   * @param {object} todoData - { user_id, title, start_date, end_date, color, category, description }
   */
  createTodo: (todoData) => 
    client.post(`${PATH}/`, todoData),

  /**
   * 3. 일정 수정 (PUT /api/todos/{todo_id})
   * @param {number} id - 수정할 데이터의 고유 ID
   * @param {object} updateData - 수정한 필드들 (TodoUpdate 스키마 대응)
   */
  updateTodo: (id, updateData) => 
    client.patch(`${PATH}/${id}`, updateData),

  /**
   * 4. 일정 삭제 (DELETE /api/todos/{todo_id})
   */
  deleteTodo: (id) => 
    client.delete(`${PATH}/${id}`),
  
};