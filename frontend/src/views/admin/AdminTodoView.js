import React, { useEffect, useState } from 'react';
import '../../assets/css/admin.css';
import TodoDetailModal from '../../components/common/TodoDetailModal';
import { adminService } from '../../services/adminService.js';

const AdminTodoView = () => {
    const [allTodos, setAllTodos] = useState([]);
    const [categoryMap, setCategoryMap] = useState({}); // ✅ 표에 보여줄 한글 사전 (Object)
    const [categories, setCategories] = useState([]);   // ✅ 모달에 넘겨줄 원본 데이터 (Array)
    const [loading, setLoading] = useState(true);
    const [selectedTodo, setSelectedTodo] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // 1. 카테고리 마스터 데이터 불러오기
            const catRes = await adminService.getCategoryTypes();
            
            // 💡 1-1. 모달창을 위해 원본 '배열' 저장
            setCategories(catRes.data); 

            // 💡 1-2. 표에 예쁘게 보여주기 위해 '사전' 만들기
            const newCatMap = {};
            catRes.data.forEach(cat => {
                newCatMap[cat.category_key] = `${cat.icon} ${cat.category_name}`; 
            });
            setCategoryMap(newCatMap); // (수정됨) setCategories가 아니라 setCategoryMap에 저장!

            // 2. 전체 일정 데이터 불러오기
            const todoRes = await adminService.getAllTodos();
            setAllTodos(todoRes.data);
            
        } catch (err) {
            console.error("데이터 로드 실패", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenModal = (todo) => {
        const mappedTodo = {
            ...todo,
            start: todo.start_date,
            end: todo.end_date
        };
        setSelectedTodo(mappedTodo);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setSelectedTodo(null);
        setIsModalOpen(false);
    };

    const handleDelete = async (todoId) => {
        if (!window.confirm("관리자 권한으로 이 일정을 삭제하시겠습니까?")) return;
        try {
            await adminService.deleteTodoByAdmin(todoId);
            alert("삭제되었습니다.");
            fetchData();
        } catch (err) {
            alert("삭제 실패");
        }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>📅 전체 일정 모니터링</h2>
            </div>
            {/* 💡 앞서 수정한 꽉 차는 테이블 레이아웃 적용 */}
            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>작성자(ID)</th>
                            <th>카테고리</th>
                            <th>제목 (클릭 시 상세)</th>
                            <th>기간</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allTodos.map(todo => (
                            <React.Fragment key={todo.id}>
                                <tr className="admin-row">
                                    <td>{todo.author?.user_nickname}({todo.user_id})</td>
                                    <td>
                                        {/* 💡 categories 대신 categoryMap 사용 */}
                                        <span className={`category-badge ${todo.category}`} style={{ backgroundColor: '#F0EEE9', color: '#141414', border: '1px solid #E2DFD8' }}>
                                            {categoryMap[todo.category] || todo.category}
                                        </span>    
                                    </td>
                                    <td 
                                        onClick={() => handleOpenModal(todo)} 
                                        className="todo-title-cell"
                                        style={{ cursor: 'pointer', color: '#3DAF7A', fontWeight: '600' }}
                                    >
                                        {todo.title} 
                                    </td>
                                    <td>{todo.start_date.split('T')[0]} ~ {todo.end_date.split('T')[0]}</td>
                                    <td>
                                        <button onClick={() => handleDelete(todo.id)} className="btn-delete-small" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>삭제</button>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ✅ 모달 호출 (원본 배열인 categories 전달) */}
            {isModalOpen && (
                <TodoDetailModal 
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    event={selectedTodo}
                    fetchTodos={fetchData}
                    mode="admin"
                    categories={categories}
                />
            )}
        </div>
    );
};

export default AdminTodoView;