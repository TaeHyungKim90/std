import 'assets/css/admin.css';

import { recruitmentApi } from 'api/recruitmentApi';
import React, { useEffect, useMemo, useState } from 'react';
import SunEditor from 'suneditor-react';
import * as Notify from 'utils/toastUtils';

const JobPostingModal = ({ isOpen, onClose, onRefresh, editingJob }) => {
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		deadline: '',
		status: 'open',
		resume_template_id: null,
	});
	const [templates, setTemplates] = useState([]);

	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		recruitmentApi
			.getResumeTemplates({ include_deleted: false })
			.then((res) => {
				if (cancelled) return;
				const list = Array.isArray(res.data?.items) ? res.data.items : [];
				setTemplates(list);
			})
			.catch(() => {
				if (!cancelled) setTemplates([]);
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen]);

	useEffect(() => {
		if (editingJob) {
			setFormData({
				...editingJob,
				deadline: editingJob.deadline ? editingJob.deadline.split('T')[0] : '',
				resume_template_id:
					editingJob.resume_template_id != null ? editingJob.resume_template_id : null,
			});
		} else {
			setFormData({
				title: '',
				description: '',
				deadline: '',
				status: 'open',
				resume_template_id: null,
			});
		}
	}, [editingJob, isOpen]);

	// 신규 공고: 템플릿 목록이 오면 기본 템플릿 자동 선택
	useEffect(() => {
		if (!isOpen || editingJob || templates.length === 0) return;
		setFormData((prev) => {
			if (prev.resume_template_id != null) return prev;
			const def = templates.find((t) => t.is_default);
			const pick = def?.id ?? templates[0]?.id ?? null;
			return { ...prev, resume_template_id: pick };
		});
	}, [isOpen, editingJob, templates]);

	const handleEditorChange = (content) => {
		setFormData((prev) => ({ ...prev, description: content }));
	};

	const templateOptions = useMemo(() => {
		const base = [...templates];
		const curId = editingJob?.resume_template_id;
		if (curId != null && !base.some((t) => t.id === curId)) {
			base.unshift({
				id: curId,
				name: '(현재 공고에 연결된 템플릿·비활성)',
				is_default: false,
			});
		}
		return base;
	}, [templates, editingJob]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!editingJob && !templates.length) {
			window.alert(
				'등록된 활성 이력서 템플릿이 없습니다.\n[채용관리 → 이력서 템플릿]에서 먼저 .docx 템플릿을 등록한 뒤 공고를 저장해 주세요.'
			);
			return;
		}
		if (formData.resume_template_id == null) {
			Notify.toastWarn('이력서 템플릿을 선택해 주세요.');
			return;
		}
		const payload = {
			title: formData.title,
			description: formData.description,
			deadline: formData.deadline || null,
			status: formData.status,
			resume_template_id: formData.resume_template_id,
		};
		const apiRequest = editingJob
			? recruitmentApi.updateJobPosting(editingJob.id, payload)
			: recruitmentApi.createJobPosting(payload);

		Notify.toastPromise(apiRequest, {
			loading: '공고를 저장하고 있습니다...',
			success: editingJob ? '채용 공고가 성공적으로 수정되었습니다! 👏' : '채용 공고가 등록되었습니다! 🎉',
			error: '저장에 실패했습니다. 😭',
		})
			.then(() => {
				onRefresh();
				onClose();
			})
			.catch((err) => {
				console.error('공고 저장 실패', err);
			});
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<div className="modal-content dynamic-enter job-posting-modal__content">
				<h2>{editingJob ? '공고 수정' : '새 채용 공고 등록'}</h2>
				<form onSubmit={handleSubmit}>
					<div className="form-group">
						<label>공고명</label>
						<input
							type="text"
							placeholder="예: 2026 상반기 신입 개발자 채용"
							value={formData.title}
							onChange={(e) => setFormData({ ...formData, title: e.target.value })}
							required
						/>
					</div>
					<div className="form-group">
						<label>이력서 템플릿</label>
						<select
							value={formData.resume_template_id ?? ''}
							onChange={(e) =>
								setFormData({
									...formData,
									resume_template_id: e.target.value ? Number(e.target.value) : null,
								})
							}
							required
							disabled={!templateOptions.length}
						>
							{!templateOptions.length ? (
								<option value="">등록된 템플릿 없음</option>
							) : (
								templateOptions.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
										{t.is_default ? ' (기본)' : ''}
									</option>
								))
							)}
						</select>
						{!templates.length && !editingJob && (
							<p className="job-posting-modal__hint" style={{ color: '#c92a2a', marginTop: '0.35rem' }}>
								활성 이력서 템플릿이 없으면 공고를 저장할 수 없습니다.
							</p>
						)}
					</div>
					<div className="form-group">
						<label>직무 설명 (JD)</label>
						<div className="job-posting-modal__editor-offset">
							<SunEditor
								setContents={formData.description}
								onChange={handleEditorChange}
								height="400px"
								setOptions={{
									buttonList: [
										['undo', 'redo'],
										['font', 'fontSize', 'formatBlock'],
										['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
										['fontColor', 'hiliteColor', 'textStyle'],
										['removeFormat'],
										'/',
										['outdent', 'indent'],
										['align', 'horizontalRule', 'list', 'lineHeight'],
										['table', 'link', 'image', 'video'],
										['fullScreen', 'showBlocks', 'codeView'],
									],
								}}
							/>
						</div>
					</div>
					<div className="form-group">
						<label>마감일</label>
						<input
							type="date"
							value={formData.deadline}
							onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
							required
						/>
					</div>
					<div className="modal-actions">
						<button type="submit" className="btn-save">
							등록하기
						</button>
						<button type="button" className="btn-cancel" onClick={onClose}>
							취소
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default JobPostingModal;
