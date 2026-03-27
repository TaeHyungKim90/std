import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { messageApi } from 'api/messageApi'; // 경로 확인
import { commonApi } from 'api/commonApi';	 // 경로 확인
import { adminApi } from 'api/adminApi';	 // 경로 확인

// 🌟 SunEditor 임포트 (CSS 포함 필수)
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';

const MessageSendModal = ({ isOpen, onClose, onSuccess }) => {
	const [users, setUsers] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		title: '',
		content: '',
		message_type: 'individual',
		is_global: false,
		receiver_id: ''
	});

	const [selectedFile, setSelectedFile] = useState(null);

	useEffect(() => {
		if (isOpen) {
			fetchUsers();
			setFormData({ title: '', content: '', message_type: 'individual', is_global: false, receiver_id: '' });
			setSelectedFile(null);
		}
	}, [isOpen]);

	const fetchUsers = async () => {
		Notify.toastPromise(adminApi.getUsers(), {
			loading: '직원 목록을 불러오는 중입니다...',
			success: '직원 목록을 불러왔습니다.',
			error: '직원 목록을 불러오지 못했습니다.'
		}).then((response) => {
			setUsers(response.data || []);
		}).catch((error) => {
			console.error("직원 목록 로드 실패:", error);
		});
	};

	const handleInputChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormData(prev => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value,
			...(name === 'is_global' && {
				message_type: checked ? 'global' : 'individual',
				receiver_id: checked ? '' : prev.receiver_id
			})
		}));
	};

	const handleEditorChange = (content) => {
		setFormData(prev => ({ ...prev, content: content }));
	};

	const handleFileChange = (e) => {
		if (e.target.files[0]) {
			setSelectedFile(e.target.files[0]);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formData.is_global && !formData.receiver_id) {
			Notify.toastWarn("개별 메시지는 수신자를 선택해야 합니다.");
			return;
		}

		setIsSubmitting(true);
		const sendMessageTask = async () => {
			let fileIds = [];

			if (selectedFile) {
				const uploadData = new FormData();
				uploadData.append('files', selectedFile);
				uploadData.append('module_type', 'MESSAGE');

				const uploadRes = await commonApi.uploadFiles(uploadData);
				const newFileId = Array.isArray(uploadRes.data) ? uploadRes.data[0].id : uploadRes.data.id;
				fileIds.push(newFileId);
			}

			const messagePayload = {
				...formData,
				receiver_id: formData.is_global ? null : Number(formData.receiver_id),
				file_ids: fileIds
			};

			return messageApi.sendMessage(messagePayload);
		};

		Notify.toastPromise(sendMessageTask(), {
			loading: '메시지를 전송하는 중입니다...',
			success: '메시지가 성공적으로 전송되었습니다.',
			error: '전송 중 오류가 발생했습니다.'
		}).then(() => {
			onSuccess();
			onClose();
		}).catch((error) => {
			console.error("메시지 전송 실패:", error);
		}).finally(() => {
			setIsSubmitting(false);
		});
	};

	if (!isOpen) return null;

	return (
		// 🌟 모달 배경 (admin.css 적용)
		<div className="modal-overlay">

			{/* 🌟 에디터가 들어가므로 maxWidth를 800px로 넓힘 */}
			<div className="modal-content" style={{ maxWidth: '800px' }}>
				<h2 style={{ marginTop: 0, marginBottom: '25px', color: 'var(--text-main)', fontWeight: '800' }}>
					새 메시지 발송
				</h2>

				<form onSubmit={handleSubmit}>
					<div className="form-group">
						<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
							<input
								type="checkbox"
								name="is_global"
								checked={formData.is_global}
								onChange={handleInputChange}
								style={{ width: '18px', height: '18px', cursor: 'pointer' }}
							/>
							<span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>전체 공지사항으로 보내기</span>
						</label>
					</div>

					{!formData.is_global && (
						<div className="form-group">
							<label>수신자 선택 <span style={{ color: 'red' }}>*</span></label>
							<select
								name="receiver_id"
								value={formData.receiver_id}
								onChange={handleInputChange}
								required={!formData.is_global}
							>
								<option value="">직원을 선택하세요</option>
								{users.map(user => (
									<option key={user.id} value={user.id}>
										{user.user_name} ({user.user_login_id})
									</option>
								))}
							</select>
						</div>
					)}

					<div className="form-group">
						<label>메시지 제목 <span style={{ color: 'red' }}>*</span></label>
						<input
							type="text"
							name="title"
							value={formData.title}
							onChange={handleInputChange}
							required
							placeholder="예: 안내사항"
						/>
					</div>

					{/* 🌟 SunEditor 탑재 영역 */}
					<div className="form-group">
						<label>상세 내용</label>
						<div style={{ border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden' }}>
							<SunEditor
								setContents={formData.content}
								onChange={handleEditorChange}
								setOptions={{
									height: 250,
									buttonList: [
										['undo', 'redo'],
										['font', 'fontSize', 'formatBlock'],
										['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
										['fontColor', 'hiliteColor', 'textStyle'],
										['removeFormat'],
										['outdent', 'indent'],
										['align', 'horizontalRule', 'list', 'lineHeight'],
										['table', 'link', 'image']
									]
								}}
							/>
						</div>
					</div>

					<div className="form-group">
						<label>첨부파일 (PDF, Excel 등)</label>
						<input
							type="file"
							onChange={handleFileChange}
							style={{ padding: '10px', background: '#f8f9fa' }}
						/>
					</div>

					{/* 🌟 하단 액션 버튼 (admin.css 적용) */}
					<div className="modal-actions">
						<button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
							취소
						</button>
						<button type="submit" className="btn-primary" disabled={isSubmitting}>
							{isSubmitting ? '전송 처리 중...' : '메시지 발송'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default MessageSendModal;