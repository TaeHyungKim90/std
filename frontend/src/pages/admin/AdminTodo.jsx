import React, { useEffect, useState, useContext } from 'react';
import * as Notify from 'utils/toastUtils';
import TodoDetailModal from 'components/common/TodoDetailModal.jsx';
import { adminApi } from 'api/adminApi.js';
import { LoadingContext } from 'context/LoadingContext';
import 'assets/css/admin.css';
const AdminTodo = () => {
	const [allTodos, setAllTodos] = useState([]);
	const [categoryMap, setCategoryMap] = useState({}); // ✅ 표에 보여줄 한글 사전 (Object)
	const [categories, setCategories] = useState([]);	// ✅ 모달에 넘겨줄 원본 데이터 (Array)
	const [selectedTodo, setSelectedTodo] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const { setIsLoading } = useContext(LoadingContext);
	const fetchData = async () => {
		setIsLoading(true);
		const fetchDataTask = async () => {
			const catRes = await adminApi.getCategoryTypes();
			const todoRes = await adminApi.getAllTodos();
			return { catRes, todoRes };
		};

		Notify.toastPromise(fetchDataTask(), {
			loading: '일정 데이터를 불러오는 중입니다...',
			success: '일정 데이터를 불러왔습니다.',
			error: '데이터를 불러오지 못했습니다.'
		}).then(({ catRes, todoRes }) => {
			setCategories(catRes.data);

			const newCatMap = {};
			catRes.data.forEach(cat => {
				newCatMap[cat.category_key] = `${cat.icon} ${cat.category_name}`;
			});
			setCategoryMap(newCatMap);
			setAllTodos(todoRes.data);
			setIsLoading(false);
		}).catch((err) => {
			console.error("데이터 로드 실패", err);
			setIsLoading(false);
		});
	};

	useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
		Notify.toastPromise(adminApi.deleteTodoByAdmin(todoId), {
			loading: '일정을 삭제하는 중입니다...',
			success: '삭제되었습니다.',
			error: '삭제에 실패했습니다.'
		}).then(() => {
			fetchData();
		}).catch((err) => {
			console.error("삭제 실패", err);
		});
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

export default AdminTodo;