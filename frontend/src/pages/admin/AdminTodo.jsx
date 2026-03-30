import React, { useEffect, useState, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import TodoDetailModal from 'components/common/TodoDetailModal.jsx';
import PaginationBar from 'components/common/PaginationBar';
import { adminApi } from 'api/adminApi.js';
import { useLoading } from 'context/LoadingContext';
import 'assets/css/admin.css';

const PAGE_SIZE = 20;

const AdminTodo = () => {
	const [allTodos, setAllTodos] = useState([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [categoryMap, setCategoryMap] = useState({});
	const [categories, setCategories] = useState([]);
	const [selectedTodo, setSelectedTodo] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const { showLoading, hideLoading } = useLoading();

	const fetchData = useCallback(async () => {
		showLoading('관리자 일정 데이터를 동기화 중입니다... ⏳');
		try {
			const catRes = await adminApi.getCategoryTypes();
			const skip = (page - 1) * PAGE_SIZE;
			const todoRes = await adminApi.getAllTodos({ skip, limit: PAGE_SIZE });
			setCategories(catRes.data);

			const newCatMap = {};
			catRes.data.forEach((cat) => {
				newCatMap[cat.category_key] = `${cat.icon} ${cat.category_name}`;
			});
			setCategoryMap(newCatMap);
			const body = todoRes.data;
			setAllTodos(Array.isArray(body?.items) ? body.items : []);
			setTotal(typeof body?.total === 'number' ? body.total : 0);
		} catch (err) {
			console.error('데이터 로드 실패', err);
			Notify.toastError('데이터를 불러오지 못했습니다.');
		} finally {
			hideLoading();
		}
	}, [page, showLoading, hideLoading]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleOpenModal = (todo) => {
		const mappedTodo = {
			...todo,
			start: todo.start_date,
			end: todo.end_date,
		};
		setSelectedTodo(mappedTodo);
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setSelectedTodo(null);
		setIsModalOpen(false);
	};

	const handleDelete = async (todoId) => {
		if (!window.confirm('관리자 권한으로 이 일정을 삭제하시겠습니까?')) return;
		Notify.toastPromise(adminApi.deleteTodoByAdmin(todoId), {
			loading: '일정을 삭제하는 중입니다...',
			success: '삭제되었습니다.',
			error: '삭제에 실패했습니다.',
		})
			.then(() => {
				fetchData();
			})
			.catch((err) => {
				console.error('삭제 실패', err);
			});
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>📅 전체 일정 모니터링</h2>
			</div>
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
						{allTodos.length === 0 ? (
							<tr>
								<td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
									표시할 일정이 없습니다.
								</td>
							</tr>
						) : null}
						{allTodos.map((todo) => (
							<React.Fragment key={todo.id}>
								<tr className="admin-row">
									<td>
										{todo.author?.user_nickname}({todo.user_id})
									</td>
									<td>
										<span
											className={`category-badge ${todo.category}`}
											style={{
												backgroundColor: '#F0EEE9',
												color: '#141414',
												border: '1px solid #E2DFD8',
											}}
										>
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
									<td>
										{todo.start_date.split('T')[0]} ~ {todo.end_date.split('T')[0]}
									</td>
									<td>
										<button
											type="button"
											onClick={() => handleDelete(todo.id)}
											className="btn-delete-small"
											style={{ padding: '6px 12px', fontSize: '0.85rem' }}
										>
											삭제
										</button>
									</td>
								</tr>
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
			<PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

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
