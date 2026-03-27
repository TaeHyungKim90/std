import React, { useState, useEffect,useContext } from 'react';
import * as Notify from 'utils/toastUtils';
import EmojiPicker from 'emoji-picker-react';
import { LoadingContext } from 'context/LoadingContext';
import { adminApi } from 'api/adminApi';
import 'assets/css/admin.css';

const CategoryMgmt = () => {
	const [categories, setCategories] = useState([]);
	const { setIsLoading } = useContext(LoadingContext);
	
	// 신규 등록용 상태
	const [showNewPicker, setShowNewPicker] = useState(false);
	const [newCat, setNewCat] = useState({ category_key: '', category_name: '', icon: '' });
	// 수정 중인 행의 ID를 저장
	const [editingId, setEditingId] = useState(null);
	const [showEditPicker, setShowEditPicker] = useState(false);
	const [editForm, setEditForm] = useState({ category_key: '', category_name: '', icon: '' });

	const fetchCategories = async () => {
		setIsLoading(true);
		Notify.toastPromise(adminApi.getCategoryTypes(), {
			loading: '카테고리를 불러오는 중입니다...',
			success: '카테고리를 불러왔습니다.',
			error: '카테고리를 불러오지 못했습니다.'
		}).then((res) => {
			setCategories(res.data);
		}).catch((err) => {
			console.error("카테고리 로드 실패", err);		
		}).finally(() => {
			setIsLoading(false);
		});
	};

	useEffect(() => { 
		fetchCategories();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 1. 등록 핸들러
	const handleCreate = async () => {
		if (!newCat.category_key || !newCat.category_name) return Notify.toastWarn("필드 내용을 모두 입력하세요.");
		Notify.toastPromise(adminApi.createCategoryType(newCat), {
			loading: '카테고리를 등록하는 중입니다...',
			success: '카테고리가 등록되었습니다.',
			error: '카테고리 등록에 실패했습니다.'
		}).then(() => {
			setNewCat({ category_key: '', category_name: '', icon: '' });
			setShowNewPicker(false);
			fetchCategories();
		}).catch((err) => {
			console.error("카테고리 등록 실패", err);
		});
	};

	// 2. 수정 모드 진입
	const startEdit = (cat) => {
		setEditingId(cat.id);
		setEditForm({ ...cat });
		setShowEditPicker(false); // 진입 시 픽커는 닫힘 상태
	};

	// 3. 수정 저장
	const handleUpdate = async (id) => {
		const updateTask = async () => {
			const { category_key, ...updateData } = editForm;
			return adminApi.updateCategoryType(id, updateData);
		};
		Notify.toastPromise(updateTask(), {
			loading: '카테고리를 수정하는 중입니다...',
			success: '카테고리가 수정되었습니다.',
			error: '카테고리 수정에 실패했습니다.'
		}).then(() => {
			setEditingId(null);
			setShowEditPicker(false);
			fetchCategories();
		}).catch((err) => {
			console.error("카테고리 수정 실패", err);
		});
	};

	// 4. 삭제 핸들러
	const handleDelete = async (id) => {
		if (!window.confirm("이 카테고리를 삭제하시겠습니까?")) return;
		Notify.toastPromise(adminApi.deleteCategoryType(id), {
			loading: '카테고리를 삭제하는 중입니다...',
			success: '카테고리가 삭제되었습니다.',
			error: '카테고리 삭제에 실패했습니다.'
		}).then(() => {
			fetchCategories();
		}).catch((err) => {
			console.error("카테고리 삭제 실패", err);
		});
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>🏷️ 카테고리 마스터 관리</h2>
			</div>
			{/* --- 신규 등록 섹션 --- */}
			<div className="category-add-box">
				<input type="text" placeholder="키 (vacation)" value={newCat.category_key} onChange={e => setNewCat({...newCat, category_key: e.target.value})} />
				<input type="text" placeholder="이름 (휴가)" value={newCat.category_name} onChange={e => setNewCat({...newCat, category_name: e.target.value})} />
				
				{/* 신규 이모지 선택 */}
				<div className="emoji-picker-container">
					<button className="emoji-btn" onClick={() => setShowNewPicker(!showNewPicker)}>{newCat.icon || '➕'}</button>
					{showNewPicker && (
						<div className="emoji-popover">
							<EmojiPicker onEmojiClick={(e) => {setNewCat({...newCat, icon: e.emoji}); setShowNewPicker(false);}} />
						</div>
					)}
				</div>

				<button className="btn-add" onClick={handleCreate}>새 카테고리 추가</button>
			</div>

			{/* 목록 테이블 */}
			<table className="admin-table">
				<thead>
					<tr>
						<th>키 (Key)</th>
						<th>카테고리명</th>
						<th>아이콘</th>
						<th>액션</th>
					</tr>
				</thead>
				<tbody>
					{categories.map(cat => (
						<tr key={cat.id}>
							{editingId === cat.id ? (
								<>
									<td><code>{cat.category_key}</code></td>
									<td><input type="text" value={editForm.category_name} onChange={e => setEditForm({...editForm, category_name: e.target.value})} /></td>
									{/* ✅ 수정 시 아이콘 선택 부분 수정됨 */}
									<td>
										<div className="emoji-picker-container">
											<button className="emoji-btn" onClick={() => setShowEditPicker(!showEditPicker)}>{editForm.icon || '❓'}</button>
											{showEditPicker && (
												<div className="emoji-popover">
													<EmojiPicker onEmojiClick={(e) => {setEditForm({...editForm, icon: e.emoji}); setShowEditPicker(false);}} />
												</div>
											)}
										</div>
									</td>
									<td>
										<button className="btn-save" onClick={() => handleUpdate(cat.id)}>저장</button>
										<button className="btn-cancel" onClick={() => setEditingId(null)}>취소</button>
									</td>
								</>
							) : (
								<>
									<td><code>{cat.category_key}</code></td>
									<td><strong>{cat.category_name}</strong></td>
									<td className="icon-cell">{cat.icon}</td>
									<td>
										<button className="btn-edit" onClick={() => startEdit(cat)}>수정</button>
										<button className="btn-delete" onClick={() => handleDelete(cat.id)}>삭제</button>
									</td>
								</>
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default CategoryMgmt;