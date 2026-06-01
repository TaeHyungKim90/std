import { platformApi } from 'api/platformApi';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const emptyForm = {
	slug: '',
	name: '',
	bootstrap_admin_login_id: 'admin',
	bootstrap_admin_password: '',
};

const TenantMgmt = () => {
	const { showLoading, hideLoading } = useLoading();
	const [tenants, setTenants] = useState([]);
	const [form, setForm] = useState(emptyForm);
	const [editingId, setEditingId] = useState(null);
	const [editName, setEditName] = useState('');

	const loadList = useCallback(async (withOverlay = true) => {
		try {
			if (withOverlay) showLoading('테넌트 목록을 불러오는 중...');
			const res = await platformApi.listTenants();
			setTenants(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			Notify.toastApiFailure(err, '테넌트 목록을 불러오지 못했습니다.');
		} finally {
			if (withOverlay) hideLoading();
		}
	}, [showLoading, hideLoading]);

	useEffect(() => {
		loadList(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleCreate = async () => {
		const slug = (form.slug || '').trim().toLowerCase();
		const name = (form.name || '').trim();
		if (!slug || !name) {
			return Notify.toastWarn('slug와 기업명을 입력해 주세요.');
		}
		const payload = { slug, name };
		const adminId = (form.bootstrap_admin_login_id || '').trim();
		const adminPw = form.bootstrap_admin_password || '';
		if (adminId && adminPw) {
			payload.bootstrap_admin_login_id = adminId;
			payload.bootstrap_admin_password = adminPw;
		}
		Notify.toastPromise(platformApi.createTenant(payload), {
			loading: '테넌트를 등록하는 중...',
			success: '테넌트가 등록되었습니다.',
			error: (err) => err?.message || '테넌트 등록에 실패했습니다.',
		}).then(() => {
			setForm(emptyForm);
			loadList(false);
		});
	};

	const handleStartEdit = (row) => {
		setEditingId(row.id);
		setEditName(row.name || '');
	};

	const handleSaveName = async (id) => {
		const name = (editName || '').trim();
		if (!name) return Notify.toastWarn('기업명을 입력해 주세요.');
		Notify.toastPromise(platformApi.updateTenant(id, { name }), {
			loading: '저장 중...',
			success: '수정되었습니다.',
			error: '수정에 실패했습니다.',
		}).then(() => {
			setEditingId(null);
			loadList(false);
		});
	};

	const handleToggleActive = async (row) => {
		const next = !row.is_active;
		const label = next ? '활성화' : '비활성화';
		if (!window.confirm(`「${row.slug}」 테넌트를 ${label}하시겠습니까?`)) return;
		Notify.toastPromise(platformApi.updateTenant(row.id, { is_active: next }), {
			loading: `${label} 처리 중...`,
			success: `${label}되었습니다.`,
			error: `${label}에 실패했습니다.`,
		}).then(() => loadList(false));
	};

	const formatDate = (value) => {
		if (!value) return '-';
		try {
			return new Date(value).toLocaleString('ko-KR');
		} catch {
			return String(value);
		}
	};

	return (
		<div>
			<div className="admin-header">
				<h2>🏢 테넌트(기업) 관리</h2>
				<p style={{ color: '#6b7280', marginTop: 8 }}>
					신규 기업 등록 시 HR 접속 URL: <code>/&#123;slug&#125;/login</code>
				</p>
			</div>

			<div className="category-add-box" style={{ flexWrap: 'wrap', gap: 8 }}>
				<input
					type="text"
					className="cat-input"
					placeholder="slug (예: acme)"
					value={form.slug}
					onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
				/>
				<input
					type="text"
					className="cat-input"
					placeholder="기업명"
					value={form.name}
					onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
				/>
				<input
					type="text"
					className="cat-input"
					placeholder="초기 admin ID (선택)"
					value={form.bootstrap_admin_login_id}
					onChange={(e) => setForm((f) => ({ ...f, bootstrap_admin_login_id: e.target.value }))}
				/>
				<input
					type="password"
					className="cat-input"
					placeholder="초기 admin 비밀번호 (선택)"
					value={form.bootstrap_admin_password}
					onChange={(e) => setForm((f) => ({ ...f, bootstrap_admin_password: e.target.value }))}
				/>
				<button type="button" className="btn-add" onClick={handleCreate}>
					테넌트 추가
				</button>
			</div>

			<div className="admin-table-wrapper">
				<table className="admin-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>slug</th>
							<th>기업명</th>
							<th>상태</th>
							<th>생성일</th>
							<th>관리</th>
						</tr>
					</thead>
					<tbody>
						{tenants.length > 0 ? (
							tenants.map((t) => (
								<tr key={t.id}>
									<td>{t.id}</td>
									<td>
										<code>{t.slug}</code>
									</td>
									<td>
										{editingId === t.id ? (
											<input
												type="text"
												value={editName}
												onChange={(e) => setEditName(e.target.value)}
											/>
										) : (
											t.name
										)}
									</td>
									<td>{t.is_active ? '활성' : '비활성'}</td>
									<td>{formatDate(t.created_at)}</td>
									<td>
										{editingId === t.id ? (
											<>
												<button type="button" className="btn-save" onClick={() => handleSaveName(t.id)}>
													저장
												</button>
												<button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>
													취소
												</button>
											</>
										) : (
											<>
												<button type="button" className="btn-save" onClick={() => handleStartEdit(t)}>
													수정
												</button>
												<button type="button" className="btn-cancel" onClick={() => handleToggleActive(t)}>
													{t.is_active ? '비활성화' : '활성화'}
												</button>
											</>
										)}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
									등록된 테넌트가 없습니다.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default TenantMgmt;
