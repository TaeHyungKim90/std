import { recruitmentApi } from 'api/recruitmentApi';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const ResumeTemplateMgmt = () => {
	const { showLoading, hideLoading } = useLoading();
	const [items, setItems] = useState([]);
	const [newName, setNewName] = useState('');
	const [newDefault, setNewDefault] = useState(true);
	const [newFile, setNewFile] = useState(null);

	const load = useCallback(async () => {
		showLoading('이력서 템플릿을 불러오는 중입니다...');
		try {
			const res = await recruitmentApi.getResumeTemplates({ include_deleted: true });
			const d = res.data;
			setItems(Array.isArray(d?.items) ? d.items : []);
		} catch (err) {
			Notify.toastApiFailure(err, '템플릿 목록을 불러오지 못했습니다.');
		} finally {
			hideLoading();
		}
	}, [showLoading, hideLoading]);

	useEffect(() => {
		load();
	}, [load]);

	const handleCreate = (e) => {
		e.preventDefault();
		if (!newName.trim()) {
			Notify.toastWarn('템플릿 이름(버전명)을 입력해 주세요.');
			return;
		}
		if (!newFile) {
			Notify.toastWarn('.docx 파일을 선택해 주세요.');
			return;
		}
		const fd = new FormData();
		fd.append('name', newName.trim());
		fd.append('is_default', newDefault ? 'true' : 'false');
		fd.append('file', newFile);
		Notify.toastPromise(recruitmentApi.createResumeTemplate(fd), {
			loading: '템플릿을 등록하는 중입니다...',
			success: '템플릿이 등록되었습니다.',
			error: '등록에 실패했습니다.',
		})
			.then(() => {
				setNewName('');
				setNewFile(null);
				setNewDefault(false);
				load();
			})
			.catch(() => {});
	};

	const handleSetDefault = (id) => {
		Notify.toastPromise(recruitmentApi.patchResumeTemplate(id, { is_default: true }), {
			loading: '기본 템플릿을 변경하는 중입니다...',
			success: '기본 템플릿이 변경되었습니다.',
			error: '변경에 실패했습니다.',
		}).then(() => load());
	};

	const handleRename = (id, currentName) => {
		const name = window.prompt('새 템플릿 이름', currentName);
		if (name === null) return;
		const trimmed = name.trim();
		if (!trimmed) {
			Notify.toastWarn('이름을 입력해 주세요.');
			return;
		}
		Notify.toastPromise(recruitmentApi.patchResumeTemplate(id, { name: trimmed }), {
			loading: '이름을 수정하는 중입니다...',
			success: '수정되었습니다.',
			error: '수정에 실패했습니다.',
		}).then(() => load());
	};

	const handleReplaceFile = (id) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
		input.onchange = () => {
			const f = input.files?.[0];
			if (!f) return;
			if (!f.name.toLowerCase().endsWith('.docx')) {
				Notify.toastWarn('.docx 파일만 등록할 수 있습니다.');
				return;
			}
			const fd = new FormData();
			fd.append('file', f);
			Notify.toastPromise(recruitmentApi.replaceResumeTemplateFile(id, fd), {
				loading: '파일을 교체하는 중입니다...',
				success: '파일이 교체되었습니다.',
				error: '교체에 실패했습니다.',
			}).then(() => load());
		};
		input.click();
	};

	const handleDelete = (id) => {
		if (!window.confirm('이 템플릿을 비활성화(삭제)할까요? 기존 공고의 다운로드는 유지됩니다.')) return;
		Notify.toastPromise(recruitmentApi.deleteResumeTemplate(id), {
			loading: '처리 중입니다...',
			success: '비활성화되었습니다.',
			error: '처리에 실패했습니다.',
		}).then(() => load());
	};

	const activeCount = items.filter((t) => !t.is_deleted).length;

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>📄 이력서 템플릿 관리</h2>
			</div>
			<div className="glass-box job-posting-modal__content" style={{ marginBottom: '1.5rem', maxWidth: '720px' }}>
				<p style={{ marginBottom: '0.75rem', color: '#c92a2a', fontSize: '0.9rem' }}>
					<strong>보안 안내:</strong> 다운로드한 워드 파일을 열 때 매크로 실행을 허용하지 마세요. 가능하면 보안
					설정에서 매크로를 비활성화한 상태로 검토해 주세요.
				</p>
				<p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#495057' }}>
					활성 템플릿이 없으면 채용 공고를 등록할 수 없습니다. 신규 공고에는 활성 템플릿만 선택할 수 있으며, 비활성화된
					템플릿은 기존 공고 다운로드용으로만 유지됩니다.
				</p>
			</div>

			<div className="glass-box job-posting-modal__content" style={{ marginBottom: '2rem', maxWidth: '720px' }}>
				<h3 style={{ marginTop: 0 }}>새 템플릿 등록 (.docx만)</h3>
				<form onSubmit={handleCreate} className="admin-form-grid">
					<div className="form-group">
						<label>템플릿 이름 / 버전 표기</label>
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="예: 2026 상반기, v2"
						/>
					</div>
					<div className="form-group">
						<label>
							<input
								type="checkbox"
								checked={newDefault}
								onChange={(e) => setNewDefault(e.target.checked)}
							/>{' '}
							등록 후 기본 템플릿으로 지정
						</label>
					</div>
					<div className="form-group">
						<label>파일 (.docx)</label>
						<input
							type="file"
							accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
							onChange={(e) => setNewFile(e.target.files?.[0] || null)}
						/>
					</div>
					<button type="submit" className="btn-primary">
						등록
					</button>
				</form>
			</div>

			<div className="admin-table-wrapper">
				<p style={{ marginBottom: '0.5rem' }}>
					활성 템플릿 수: <strong>{activeCount}</strong>
				</p>
				<table className="admin-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>이름</th>
							<th>기본</th>
							<th>상태</th>
							<th>작업</th>
						</tr>
					</thead>
					<tbody>
						{items.map((t) => (
							<tr key={t.id} style={{ opacity: t.is_deleted ? 0.55 : 1 }}>
								<td>{t.id}</td>
								<td>{t.name}</td>
								<td>{t.is_default ? '✓' : '—'}</td>
								<td>{t.is_deleted ? '비활성' : '활성'}</td>
								<td>
									{!t.is_deleted && (
										<>
											<button type="button" className="btn-save recruitment-admin__btn-lead" onClick={() => handleSetDefault(t.id)}>
												기본 지정
											</button>{' '}
											<button type="button" className="btn-edit" onClick={() => handleRename(t.id, t.name)}>
												이름 수정
											</button>{' '}
											<button type="button" className="btn-edit" onClick={() => handleReplaceFile(t.id)}>
												파일 교체
											</button>{' '}
											<button type="button" className="btn-delete-small" onClick={() => handleDelete(t.id)}>
												비활성화
											</button>
										</>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{items.length === 0 && <p>등록된 템플릿이 없습니다.</p>}
			</div>
		</div>
	);
};

export default ResumeTemplateMgmt;
