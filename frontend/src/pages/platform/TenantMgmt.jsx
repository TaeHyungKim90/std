import { platformApi } from 'api/platformApi';
import TenantEditModal from 'components/platform/TenantEditModal';
import { DEFAULT_TENANT_SLUG } from 'constants/paths';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const isDefaultTenant = (row) =>
	(row?.slug || '').toLowerCase() === DEFAULT_TENANT_SLUG.toLowerCase();

const BOOTSTRAP_ADMIN_ID = 'admin';

const emptyForm = {
	slug: '',
	name: '',
	bootstrap_admin_password: '',
};

const TenantMgmt = () => {
	const { showLoading, hideLoading } = useLoading();
	const [tenants, setTenants] = useState([]);
	const [form, setForm] = useState(emptyForm);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingTenant, setEditingTenant] = useState(null);

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
		const adminPw = (form.bootstrap_admin_password || '').trim();
		if (adminPw) {
			payload.bootstrap_admin_login_id = BOOTSTRAP_ADMIN_ID;
			payload.bootstrap_admin_password = adminPw;
		}
		Notify.toastPromise(platformApi.createTenant(payload), {
			loading: '테넌트를 등록하는 중...',
			success: '테넌트가 등록되었습니다.',
			error: (err) => err?.message || '테넌트 등록에 실패했습니다.',
		})
			.then(() => {
				setForm(emptyForm);
				loadList(false);
			})
			.catch(() => {});
	};

	const handleOpenEdit = (row) => {
		setEditingTenant(row);
		setEditModalOpen(true);
	};

	const handleCloseEdit = () => {
		setEditModalOpen(false);
		setEditingTenant(null);
	};

	const handleSaveEdit = async ({ id, name, bootstrap_admin_password: adminPw }) => {
		if (!name) return Notify.toastWarn('기업명을 입력해 주세요.');
		const payload = { name };
		if (adminPw) {
			payload.bootstrap_admin_password = adminPw;
		}
		Notify.toastPromise(platformApi.updateTenant(id, payload), {
			loading: '저장 중...',
			success: '수정되었습니다.',
			error: (err) => err?.message || '수정에 실패했습니다.',
		})
			.then(() => {
				handleCloseEdit();
				loadList(false);
			})
			.catch(() => {});
	};

	const handleToggleActive = async (row) => {
		const next = !row.is_active;
		const label = next ? '활성화' : '비활성화';
		if (!window.confirm(`「${row.slug}」 테넌트를 ${label}하시겠습니까?`)) return;
		Notify.toastPromise(platformApi.updateTenant(row.id, { is_active: next }), {
			loading: `${label} 처리 중...`,
			success: `${label}되었습니다.`,
			error: `${label}에 실패했습니다.`,
		})
			.then(() => loadList(false))
			.catch(() => {});
	};

	const handleDelete = async (row) => {
		const typed = window.prompt(
			`「${row.slug}」 테넌트를 영구 삭제합니다.\n` +
				`직원·채용·일정 등 모든 데이터가 삭제되며 복구할 수 없습니다.\n\n` +
				`계속하려면 slug를 입력하세요: ${row.slug}`
		);
		if (typed === null) return;
		if ((typed || '').trim().toLowerCase() !== (row.slug || '').trim().toLowerCase()) {
			return Notify.toastWarn('slug가 일치하지 않아 삭제가 취소되었습니다.');
		}
		Notify.toastPromise(platformApi.deleteTenant(row.id), {
			loading: '테넌트를 삭제하는 중...',
			success: '테넌트가 삭제되었습니다.',
			error: (err) => err?.message || '삭제에 실패했습니다.',
		})
			.then(() => loadList(false))
			.catch(() => {});
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
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>
					<span>테넌트</span> 기업 관리
				</h2>
				<p className="admin-header__hint">
					신규 기업 등록 시 HR 접속 URL: <code>/{'{slug}'}/login</code>
				</p>
			</div>

			<div className="category-add-box tenant-mgmt-add-form">
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
					className="cat-input cat-input--readonly"
					value={BOOTSTRAP_ADMIN_ID}
					readOnly
					title="초기 HR 관리자 ID (고정)"
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
									<td>{t.name}</td>
									<td>
										<span
											className={`tenant-status ${
												t.is_active ? 'tenant-status--active' : 'tenant-status--inactive'
											}`}
										>
											{t.is_active ? '활성' : '비활성'}
										</span>
									</td>
									<td>{formatDate(t.created_at)}</td>
									<td>
										<button type="button" className="btn-edit" onClick={() => handleOpenEdit(t)}>
											수정
										</button>
										{!isDefaultTenant(t) ? (
											<>
												<button
													type="button"
													className="btn-cancel"
													onClick={() => handleToggleActive(t)}
												>
													{t.is_active ? '비활성화' : '활성화'}
												</button>
												<button type="button" className="btn-delete" onClick={() => handleDelete(t)}>
													삭제
												</button>
											</>
										) : null}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={6} className="admin-table__empty">
									등록된 테넌트가 없습니다.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			<TenantEditModal
				isOpen={editModalOpen}
				tenant={editingTenant}
				onClose={handleCloseEdit}
				onSave={handleSaveEdit}
			/>
		</div>
	);
};

export default TenantMgmt;
