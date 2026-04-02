import 'assets/css/layout.css';
import 'assets/css/admin-user-profile-extra.css';

import { adminApi } from 'api/adminApi';
import { commonApi } from 'api/commonApi';
import UserAvatar from 'components/common/UserAvatar';
import React, { useEffect, useMemo, useState } from 'react';
import { formatDate } from 'utils/commonUtils';
import * as Notify from 'utils/toastUtils';
const UserModal = ({ isOpen, onClose, onRefresh, editingUser }) => {
	const toDateValue = (v) => {
		// formatDate()는 비어있을 때 '-'를 반환함 → date input/서버에는 '' 또는 null만 전달
		if (!v) return '';
		const s = formatDate(v);
		return s === '-' ? '' : s;
	};

	const [formData, setFormData] = useState({
		user_login_id: '',
		user_password: '',
		user_name: '',
		user_nickname: '',
		user_phone_number: '',
		user_profile_image_url: '',
		user_department: '',
		user_position: '',
		salary_bank_name: '',
		salary_account_number: '',
		role: 'user',
		joinDate: '',
		resignation_date: '',
	});

	const [photoFile, setPhotoFile] = useState(null);
	const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

	const BANK_OPTIONS = useMemo(
		() => ['KB국민은행', '신한은행', '우리은행', '하나은행', 'IBK기업은행', 'NH농협은행', '카카오뱅크', '수협은행'],
		[],
	);
	// 수정 모드일 경우 기존 데이터 세팅
	useEffect(() => {
		if (editingUser) {
			setPhotoFile(null);
			setPhotoPreviewUrl(editingUser.user_profile_image_url || null);
			setFormData({
				...editingUser,
				user_password: '',
				user_phone_number: editingUser.user_phone_number || '',
				user_profile_image_url: editingUser.user_profile_image_url || '',
				user_department: editingUser.user_department || '',
				user_position: editingUser.user_position || '',
				salary_bank_name: editingUser.salary_bank_name || '',
				salary_account_number: editingUser.salary_account_number || '',
				joinDate: toDateValue(editingUser.join_date),
				resignation_date: toDateValue(editingUser.resignation_date)
			});
		} else {
			setPhotoFile(null);
			setPhotoPreviewUrl(null);
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
		const saveTask = async () => {
			// 1) 사진 업로드가 선택된 경우에만 처리
			let nextProfileImageUrl = formData.user_profile_image_url || null;
			if (photoFile) {
				const fd = new FormData();
				fd.append('files', photoFile);
				const upRes = await commonApi.uploadFiles(fd);
				nextProfileImageUrl = upRes.data?.[0]?.file_path ?? null;
			} else {
				// 편집 화면에서 사용자가 변경 없이 저장 눌렀을 경우, preview(blob)만 있을 수 있으니 정리
				nextProfileImageUrl = (photoPreviewUrl && photoPreviewUrl.startsWith('/uploads/'))
					? photoPreviewUrl
					: formData.user_profile_image_url || null;
			}

			const salaryDigits = (formData.salary_account_number || '').replace(/\D/g, '');

			// 2) 백엔드 스키마 키에 맞춘 payload 구성
			const basePayload = {
				user_login_id: formData.user_login_id,
				user_password: formData.user_password,
				user_name: formData.user_name,
				user_nickname: formData.user_nickname || null,
				user_phone_number: formData.user_phone_number || null,
				user_profile_image_url: nextProfileImageUrl,
				user_department: formData.user_department || null,
				user_position: formData.user_position || null,
				salary_bank_name: formData.salary_bank_name || null,
				salary_account_number: salaryDigits || null,
				role: formData.role,
				joined_at: formData.joinDate && formData.joinDate !== '-' ? formData.joinDate : null,
				resignation_date:
					formData.resignation_date && formData.resignation_date !== '-' ? formData.resignation_date : null,
			};

			if (editingUser) {
				// 수정 시: 아이디는 변경 불가 + 비밀번호는 비어있으면 제외
				const { user_login_id: _ignore, user_password: pw, ...updateData } = basePayload;
				const updatePayload = { ...updateData, ...(pw ? { user_password: pw } : {}) };
				return adminApi.updateUser(editingUser.id, updatePayload);
			}

			return adminApi.createUser(basePayload);
		};

		Notify.toastPromise(saveTask(), {
			loading: editingUser ? '사용자 정보를 수정하는 중입니다...' : '사용자를 등록하는 중입니다...',
			success: editingUser ? '사용자 정보가 수정되었습니다.' : '사용자가 등록되었습니다.',
			error: '저장에 실패했습니다.'
		}).then(() => {
			onRefresh();
			onClose();   // 모달 닫기
		}).catch((err) => {
			Notify.toastApiFailure(err, "사용자 저장 실패");
		});
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<div className="modal-content dynamic-enter">
				<h3>{editingUser ? "정보 수정" : "사용자 등록"}</h3>
				<form onSubmit={handleSave}>
					<div className="user-modal-scroll">
						<div className="user-modal-photo-row">
							<UserAvatar
								imageUrl={photoPreviewUrl || formData.user_profile_image_url || null}
								nickname={formData.user_nickname || null}
								name={formData.user_name || null}
								size={64}
							/>
							<label className="user-modal-photo-upload">
								<input
									type="file"
									accept="image/*"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (!file) return;
										if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl);
										const url = URL.createObjectURL(file);
										setPhotoFile(file);
										setPhotoPreviewUrl(url);
									}}
								/>
								사진 업로드
							</label>
						</div>

						{/* 기존 필드들 */}
						<div className="form-group">
							<label>아이디</label>
							<input
								value={formData.user_login_id}
								disabled={!!editingUser}
								onChange={(e) => setFormData({ ...formData, user_login_id: e.target.value })}
								required
							/>
						</div>
						<div className="form-group">
							<label>비밀번호 {editingUser && "(변경 시에만)"}</label>
							<input
								type="password"
								value={formData.user_password}
								onChange={(e) => setFormData({ ...formData, user_password: e.target.value })}
								required={!editingUser}
							/>
						</div>
						<div className="form-group">
							<label>성명</label>
							<input
								value={formData.user_name}
								onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
								required
							/>
						</div>
						<div className="form-group">
							<label>닉네임</label>
							<input
								value={formData.user_nickname || ''}
								onChange={(e) => setFormData({ ...formData, user_nickname: e.target.value })}
								placeholder="닉네임을 입력하세요"
							/>
						</div>
						<div className="form-group">
							<label>전화번호</label>
							<input
								type="text"
								name="user_phone_number"
								value={formData.user_phone_number || ''}
								onChange={(e) => setFormData({ ...formData, user_phone_number: e.target.value })}
							/>
						</div>

						<div className="form-row modal-form-row">
							<div className="form-group">
								<label>부서</label>
								<input
									value={formData.user_department || ''}
									onChange={(e) => setFormData({ ...formData, user_department: e.target.value })}
								/>
							</div>
							<div className="form-group">
								<label>직급</label>
								<input
									value={formData.user_position || ''}
									onChange={(e) => setFormData({ ...formData, user_position: e.target.value })}
								/>
							</div>
						</div>

						<div className="form-row modal-form-row">
							<div className="form-group">
								<label>급여 은행</label>
								<select
									value={formData.salary_bank_name || ''}
									onChange={(e) => setFormData({ ...formData, salary_bank_name: e.target.value })}
								>
									<option value="">은행 선택</option>
									{BANK_OPTIONS.map((b) => (
										<option key={b} value={b}>
											{b}
										</option>
									))}
								</select>
							</div>
							<div className="form-group">
								<label>급여 계좌</label>
								<input
									value={formData.salary_account_number || ''}
									onChange={(e) =>
										setFormData({ ...formData, salary_account_number: e.target.value.replace(/\D/g, '').slice(0, 20) })
									}
								/>
							</div>
						</div>

						{/* 추가된 날짜 필드들 */}
						<div className="form-row modal-form-row">
							<div className="form-group">
								<label>입사일</label>
								<input
									type="date"
									value={formData.joinDate || ''}
									onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
								/>
							</div>
							<div className="form-group">
								<label>퇴사일</label>
								<input
									type="date"
									value={formData.resignation_date || ''}
									onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
								/>
							</div>
						</div>

						<div className="form-group">
							<label>권한</label>
							<select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
								<option value="user">사용자</option>
								<option value="admin">관리자</option>
							</select>
						</div>
					</div>

					<div className="modal-actions user-modal-actions">
						<button type="submit" className="btn-save">저장</button>
						<button type="button" className="btn-cancel" onClick={onClose}>닫기</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default UserModal;