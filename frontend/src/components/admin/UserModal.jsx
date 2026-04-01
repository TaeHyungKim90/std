import React, { useState, useEffect } from 'react';
import 'assets/css/layout.css';
import * as Notify from 'utils/toastUtils';
import { adminApi } from 'api/adminApi';
import { formatDate } from 'utils/commonUtils';
const UserModal = ({ isOpen, onClose, onRefresh, editingUser }) => {
	const [formData, setFormData] = useState({
		user_login_id: '', user_password: '', user_name: '', user_nickname: '', user_phone_number: '', role: 'user', joinDate: '', resignation_date: ''
	});
	// 수정 모드일 경우 기존 데이터 세팅
	useEffect(() => {
		if (editingUser) {
			setFormData({
				...editingUser,
				user_password: '',
				user_phone_number: editingUser.user_phone_number || '',
				joinDate: formatDate(editingUser.join_date),
				resignation_date: formatDate(editingUser.resignation_date)
			});
		} else {
			setFormData({
				user_login_id: '',
				user_password: '',
				user_name: '',
				user_nickname: '',
				role: 'user', joinDate: '', resignation_date: ''
			});
		}
	}, [editingUser, isOpen]);

	const handleSave = async (e) => {
		e.preventDefault();
		const submissionData = {
			...formData,
			joined_at: formData.joinDate || null, // DB의 join_date 필드와 매핑됨
			resignation_date: formData.resignation_date || null,
			// 비밀번호가 빈 값인 경우(수정 모드) 아예 필드에서 제외하거나 처리
			...(editingUser && !formData.user_password ? { user_password: undefined } : {})
		};
		delete submissionData.join_date;
		const saveTask = async () => {
			if (editingUser) {
				// 수정 시 아이디는 변경 불가하므로 제외하고 전송
				const { user_login_id, ...updateData } = submissionData;
				return adminApi.updateUser(editingUser.id, updateData);
			} else {
				return adminApi.createUser(submissionData);
			}
		};
		Notify.toastPromise(saveTask(), {
			loading: editingUser ? '사용자 정보를 수정하는 중입니다...' : '사용자를 등록하는 중입니다...',
			success: editingUser ? '사용자 정보가 수정되었습니다.' : '사용자가 등록되었습니다.',
			error: '저장에 실패했습니다.'
		}).then(() => {
			onRefresh();
			onClose();   // 모달 닫기
		}).catch((err) => {
			console.error("사용자 저장 실패:", err);
		});
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<div className="modal-content dynamic-enter">
				<h3>{editingUser ? "정보 수정" : "사용자 등록"}</h3>
				<form onSubmit={handleSave}>
					{/* 기존 필드들 */}
					<div className="form-group">
						<label>아이디</label>
						<input value={formData.user_login_id} disabled={!!editingUser}
							onChange={e => setFormData({ ...formData, user_login_id: e.target.value })} required />
					</div>
					<div className="form-group">
						<label>비밀번호 {editingUser && "(변경 시에만)"}</label>
						<input type="password" value={formData.user_password}
							onChange={e => setFormData({ ...formData, user_password: e.target.value })} required={!editingUser} />
					</div>
					<div className="form-group">
						<label>성명</label>
						<input value={formData.user_name} onChange={e => setFormData({ ...formData, user_name: e.target.value })} required />
					</div>
					<div className="form-group">
						<label>닉네임</label>
						<input
							value={formData.user_nickname || ''}
							onChange={e => setFormData({ ...formData, user_nickname: e.target.value })}
							placeholder="닉네임을 입력하세요"
						/>
					</div>
					<div className="form-group">
						<label>전화번호</label>
						<input
							type="text"
							name="user_phone_number"
							value={formData.user_phone_number || ''}
							onChange={e => setFormData({ ...formData, user_phone_number: e.target.value })}
						/>
					</div>
					{/* 추가된 날짜 필드들 */}
					<div className="form-row modal-form-row">
						<div className="form-group">
							<label>입사일</label>
							<input type="date" value={formData.joinDate || ''}
								onChange={e => setFormData({ ...formData, joinDate: e.target.value })} />
						</div>
						<div className="form-group">
							<label>퇴사일</label>
							<input type="date" value={formData.resignation_date || ''}
								onChange={e => setFormData({ ...formData, resignation_date: e.target.value })} />
						</div>
					</div>

					<div className="form-group">
						<label>권한</label>
						<select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
							<option value="user">사용자</option>
							<option value="admin">관리자</option>
						</select>
					</div>

					<div className="modal-actions">
						<button type="submit" className="btn-save">저장</button>
						<button type="button" className="btn-cancel" onClick={onClose}>닫기</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default UserModal;