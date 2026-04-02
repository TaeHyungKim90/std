import 'assets/css/layout.css';
import 'assets/css/admin-user-profile-extra.css';

import { adminApi } from 'api/adminApi';
import { commonApi } from 'api/commonApi';
import AvatarImageCropModal from 'components/common/AvatarImageCropModal';
import UserAvatar from 'components/common/UserAvatar';
import { Camera } from 'lucide-react';
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
		department_id: '',
		position_id: '',
		salary_bank_name: '',
		salary_account_number: '',
		role: 'user',
		joinDate: '',
		resignation_date: '',
	});

	const [photoFile, setPhotoFile] = useState(null);
	const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
	const [avatarAdjust, setAvatarAdjust] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [departments, setDepartments] = useState([]);
	const [positions, setPositions] = useState([]);

	const BANK_OPTIONS = useMemo(
		() => ['KB국민은행', '신한은행', '우리은행', '하나은행', 'IBK기업은행', 'NH농협은행', '카카오뱅크', '수협은행'],
		[],
	);

	useEffect(() => {
		if (!isOpen) return;
		const fetchMasterData = async () => {
			try {
				const [deptRes, posRes] = await Promise.all([adminApi.getDepartments(), adminApi.getPositions()]);
				setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
				setPositions(Array.isArray(posRes.data) ? posRes.data : []);
			} catch (err) {
				Notify.toastApiFailure(err, '부서/직급 목록을 불러오지 못했습니다.');
				setDepartments([]);
				setPositions([]);
			}
		};
		fetchMasterData();
	}, [isOpen]);
	// 수정 모드일 경우 기존 데이터 세팅
	useEffect(() => {
		if (editingUser) {
			setPhotoFile(null);
			setPhotoPreviewUrl(editingUser.user_profile_image_url || null);
			setAvatarAdjust({
				zoom: Number(editingUser.avatar_zoom ?? 1),
				offsetX: Number(editingUser.avatar_offset_x ?? 0),
				offsetY: Number(editingUser.avatar_offset_y ?? 0),
			});
			setFormData({
				...editingUser,
				user_password: '',
				user_phone_number: editingUser.user_phone_number || '',
				user_profile_image_url: editingUser.user_profile_image_url || '',
				department_id: editingUser.department_id ?? '',
				position_id: editingUser.position_id ?? '',
				salary_bank_name: editingUser.salary_bank_name || '',
				salary_account_number: editingUser.salary_account_number || '',
				joinDate: toDateValue(editingUser.join_date),
				resignation_date: toDateValue(editingUser.resignation_date)
			});
		} else {
			setPhotoFile(null);
			setPhotoPreviewUrl(null);
			setAvatarAdjust({ zoom: 1, offsetX: 0, offsetY: 0 });
			setFormData({
				user_login_id: '',
				user_password: '',
				user_name: '',
				user_nickname: '',
				role: 'user', joinDate: '', resignation_date: '', department_id: '', position_id: ''
			});
		}
	}, [editingUser, isOpen]);

	useEffect(() => {
		if (!editingUser) return;
		setFormData((prev) => {
			const next = { ...prev };
			const fallbackDeptName = editingUser.department_name || null;
			const fallbackPosName = editingUser.position_name || null;
			if ((prev.department_id === '' || prev.department_id == null) && fallbackDeptName && departments.length > 0) {
				const found = departments.find((d) => d.department_name === fallbackDeptName);
				if (found) next.department_id = found.id;
			}
			if ((prev.position_id === '' || prev.position_id == null) && fallbackPosName && positions.length > 0) {
				const found = positions.find((p) => p.position_name === fallbackPosName);
				if (found) next.position_id = found.id;
			}
			return next;
		});
	}, [editingUser, departments, positions]);

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
				department_id: formData.department_id === '' ? null : Number(formData.department_id),
				position_id: formData.position_id === '' ? null : Number(formData.position_id),
				salary_bank_name: formData.salary_bank_name || null,
				salary_account_number: salaryDigits || null,
				role: formData.role,
				joined_at: formData.joinDate && formData.joinDate !== '-' ? formData.joinDate : null,
				resignation_date:
					formData.resignation_date && formData.resignation_date !== '-' ? formData.resignation_date : null,
				avatar_zoom: Number(avatarAdjust.zoom ?? 1),
				avatar_offset_x: Number(avatarAdjust.offsetX ?? 0),
				avatar_offset_y: Number(avatarAdjust.offsetY ?? 0),
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
							<button type="button" className="user-modal-photo-preview-trigger" onClick={() => setCropModalOpen(true)}>
								<UserAvatar
									imageUrl={photoPreviewUrl || formData.user_profile_image_url || null}
									nickname={formData.user_nickname || null}
									name={formData.user_name || null}
									size={64}
									avatarAdjust={avatarAdjust}
								/>
								<span className="user-modal-photo-preview-trigger__badge" aria-hidden="true">
									<Camera size={13} />
								</span>
							</button>
							<div className="user-modal-photo-upload-text">프로필 사진 변경</div>
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
								<select
									value={formData.department_id === '' ? '' : String(formData.department_id)}
									onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
								>
									<option value="">부서 선택</option>
									{departments.map((d) => (
										<option key={d.id} value={d.id}>
											{d.department_name}
										</option>
									))}
								</select>
							</div>
							<div className="form-group">
								<label>직급</label>
								<select
									value={formData.position_id === '' ? '' : String(formData.position_id)}
									onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
								>
									<option value="">직급 선택</option>
									{positions.map((p) => (
										<option key={p.id} value={p.id}>
											{p.position_name}
										</option>
									))}
								</select>
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
			<AvatarImageCropModal
				isOpen={cropModalOpen}
				file={null}
				initialImageUrl={photoPreviewUrl || formData.user_profile_image_url || null}
				initialAdjust={avatarAdjust}
				onClose={() => {
					setCropModalOpen(false);
				}}
				onConfirm={(nextFile, nextUrl, nextAdjust) => {
					if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl);
					setPhotoFile(nextFile);
					setPhotoPreviewUrl(nextUrl);
					setAvatarAdjust({
						zoom: Number(nextAdjust?.zoom ?? 1),
						offsetX: Number(nextAdjust?.offsetX ?? 0),
						offsetY: Number(nextAdjust?.offsetY ?? 0),
					});
					setCropModalOpen(false);
				}}
			/>
		</div>
	);
};

export default UserModal;