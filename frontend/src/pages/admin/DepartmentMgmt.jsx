import { adminApi } from 'api/adminApi';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const DepartmentMgmt = () => {
	const { showLoading, hideLoading } = useLoading();

	const [departments, setDepartments] = useState([]);
	const [newName, setNewName] = useState('');
	const [editingId, setEditingId] = useState(null);
	const [editName, setEditName] = useState('');

	const loadList = useCallback(async (withOverlay = true) => {
		try {
			if (withOverlay) showLoading('부서 목록을 불러오는 중입니다... ⏳');
			const res = await adminApi.getDepartments();
			setDepartments(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			Notify.toastApiFailure(err, '부서 목록을 불러오지 못했습니다.');
		} finally {
			if (withOverlay) hideLoading();
		}
	}, [showLoading, hideLoading]);

	useEffect(() => {
		loadList(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleCreate = async () => {
		const name = (newName || '').trim();
		if (!name) return Notify.toastWarn('부서명을 입력해 주세요.');

		Notify.toastPromise(adminApi.createDepartment({ department_name: name }), {
			loading: '부서를 등록하는 중입니다...',
			success: '부서가 등록되었습니다.',
			error: '부서 등록에 실패했습니다.',
		}).then(() => {
			setNewName('');
			loadList(false);
		});
	};

	const handleStartEdit = (dept) => {
		setEditingId(dept.id);
		setEditName(dept.department_name || '');
	};

	const handleUpdate = async (id) => {
		const name = (editName || '').trim();
		if (!name) return Notify.toastWarn('부서명을 입력해 주세요.');

		Notify.toastPromise(adminApi.updateDepartment(id, { department_name: name }), {
			loading: '부서 정보를 수정하는 중입니다...',
			success: '부서가 수정되었습니다.',
			error: '부서 수정에 실패했습니다.',
		}).then(() => {
			setEditingId(null);
			setEditName('');
			loadList(false);
		});
	};

	const handleDelete = async (id) => {
		if (!window.confirm('해당 부서를 삭제하시겠습니까?')) return;
		Notify.toastPromise(adminApi.deleteDepartment(id), {
			loading: '부서를 삭제하는 중입니다...',
			success: '부서가 삭제되었습니다.',
			error: '부서 삭제에 실패했습니다.',
		}).then(() => {
			setEditingId(null);
			setEditName('');
			loadList(false);
		});
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>🏢 부서 관리</h2>
			</div>

			<div className="category-add-box">
				<input
					type="text"
					className="cat-input"
					placeholder="부서명 (예: 개발팀)"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
				/>
				<button className="btn-add" type="button" onClick={handleCreate}>
					추가
				</button>
			</div>

			<div className="admin-table-wrapper">
				<table className="admin-table">
					<thead>
						<tr>
							<th>부서</th>
							<th>관리</th>
						</tr>
					</thead>
					<tbody>
						{departments.length > 0 ? (
							departments.map((d, index) => (
								<tr key={d.id} className="stagger-item" style={{ animationDelay: `${index * 0.04}s` }}>
									{editingId === d.id ? (
										<>
											<td>
												<input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
											</td>
											<td>
												<button className="btn-save" type="button" onClick={() => handleUpdate(d.id)}>
													저장
												</button>
												<button className="btn-cancel" type="button" onClick={() => setEditingId(null)}>
													취소
												</button>
											</td>
										</>
									) : (
										<>
											<td>{d.department_name}</td>
											<td>
												<button className="btn-edit" type="button" onClick={() => handleStartEdit(d)}>
													수정
												</button>
												<button className="btn-delete" type="button" onClick={() => handleDelete(d.id)}>
													삭제
												</button>
											</td>
										</>
									)}
								</tr>
							))
						) : (
							<tr>
								<td colSpan={2} className="admin-table__empty">
									등록된 부서가 없습니다.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default DepartmentMgmt;

