import React, { useEffect, useState } from 'react';

const BOOTSTRAP_ADMIN_ID = 'admin';

const TenantEditModal = ({ isOpen, tenant, onClose, onSave }) => {
	const [name, setName] = useState('');
	const [adminPassword, setAdminPassword] = useState('');

	useEffect(() => {
		if (!isOpen || !tenant) return;
		setName(tenant.name || '');
		setAdminPassword('');
	}, [isOpen, tenant]);

	if (!isOpen || !tenant) return null;

	const handleSubmit = (e) => {
		e.preventDefault();
		onSave({
			id: tenant.id,
			name: (name || '').trim(),
			bootstrap_admin_password: (adminPassword || '').trim(),
		});
	};

	return (
		<div className="modal-overlay" role="presentation" onClick={onClose}>
			<div
				className="modal-content platform-modal dynamic-enter"
				role="dialog"
				aria-modal="true"
				aria-labelledby="tenant-edit-title"
				onClick={(e) => e.stopPropagation()}
			>
				<h3 id="tenant-edit-title">테넌트 수정</h3>
				<form onSubmit={handleSubmit}>
					<div className="form-group">
						<label>slug</label>
						<input type="text" value={tenant.slug || ''} readOnly disabled style={{ background: '#f3f4f6' }} />
					</div>
					<div className="form-group">
						<label>기업명</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							autoFocus
						/>
					</div>
					<div className="form-group">
						<label>HR 관리자 ID</label>
						<input type="text" value={BOOTSTRAP_ADMIN_ID} readOnly disabled style={{ background: '#f3f4f6' }} />
					</div>
					<div className="form-group">
						<label>HR 관리자 비밀번호 (변경 시에만)</label>
						<input
							type="password"
							value={adminPassword}
							onChange={(e) => setAdminPassword(e.target.value)}
							placeholder="새 비밀번호"
							autoComplete="new-password"
						/>
					</div>
					<div className="modal-actions">
						<button type="submit" className="btn-save">
							저장
						</button>
						<button type="button" className="btn-cancel" onClick={onClose}>
							닫기
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default TenantEditModal;
