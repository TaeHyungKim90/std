import { adminApi } from 'api/adminApi';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const KEY_PATTERN = /^[a-z0-9_]{2,50}$/;

const normalizePayload = ({ location_key, location_value, description, is_active }) => ({
	location_key: (location_key || '').trim(),
	location_value: (location_value || '').trim(),
	description: (description || '').trim(),
	is_active: Boolean(is_active),
});

const validateForm = (payload, isEdit = false) => {
	if (!payload.location_key) {
		Notify.toastWarn('근무장소 key를 입력해 주세요.');
		return false;
	}
	if (!KEY_PATTERN.test(payload.location_key)) {
		Notify.toastWarn('key는 영문 소문자, 숫자, 밑줄(_)만 사용하는 2~50자여야 합니다.');
		return false;
	}
	if (!payload.location_value) {
		Notify.toastWarn('근무장소 value를 입력해 주세요.');
		return false;
	}
	if (payload.location_value.length > 120) {
		Notify.toastWarn('근무장소 value는 120자 이하여야 합니다.');
		return false;
	}
	if (payload.description.length > 255) {
		Notify.toastWarn('설명은 255자 이하여야 합니다.');
		return false;
	}
	if (!isEdit && !payload.is_active) {
		Notify.toastWarn('신규 등록은 기본적으로 활성 상태여야 합니다.');
		return false;
	}
	return true;
};

const WorkLocationMgmt = () => {
	const { showLoading, hideLoading } = useLoading();
	const [locations, setLocations] = useState([]);
	const [newForm, setNewForm] = useState({
		location_key: '',
		location_value: '',
		description: '',
		is_active: true,
	});
	const [editingId, setEditingId] = useState(null);
	const [editForm, setEditForm] = useState({
		location_key: '',
		location_value: '',
		description: '',
		is_active: true,
	});

	const loadList = useCallback(async (withOverlay = true) => {
		try {
			if (withOverlay) showLoading('근무장소 목록을 불러오는 중입니다... ⏳');
			const res = await adminApi.getWorkLocations();
			setLocations(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			Notify.toastApiFailure(err, '근무장소 목록을 불러오지 못했습니다.');
		} finally {
			if (withOverlay) hideLoading();
		}
	}, [showLoading, hideLoading]);

	useEffect(() => {
		loadList(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleCreate = () => {
		const payload = normalizePayload(newForm);
		if (!validateForm(payload, false)) return;

		Notify.toastPromise(adminApi.createWorkLocation(payload), {
			loading: '근무장소를 등록하는 중입니다...',
			success: '근무장소가 등록되었습니다.',
			error: '근무장소 등록에 실패했습니다.',
		}).then(() => {
			setNewForm({
				location_key: '',
				location_value: '',
				description: '',
				is_active: true,
			});
			loadList(false);
		});
	};

	const handleStartEdit = (row) => {
		setEditingId(row.id);
		setEditForm({
			location_key: row.location_key || '',
			location_value: row.location_value || '',
			description: row.description || '',
			is_active: row.is_active !== false,
		});
	};

	const handleUpdate = (id) => {
		const payload = normalizePayload(editForm);
		if (!validateForm(payload, true)) return;

		Notify.toastPromise(adminApi.updateWorkLocation(id, payload), {
			loading: '근무장소를 수정하는 중입니다...',
			success: '근무장소가 수정되었습니다.',
			error: '근무장소 수정에 실패했습니다.',
		}).then(() => {
			setEditingId(null);
			loadList(false);
		});
	};

	const handleDelete = (id) => {
		if (!window.confirm('해당 근무장소를 삭제하시겠습니까?')) return;
		Notify.toastPromise(adminApi.deleteWorkLocation(id), {
			loading: '근무장소를 삭제하는 중입니다...',
			success: '근무장소가 삭제되었습니다.',
			error: '근무장소 삭제에 실패했습니다.',
		}).then(() => {
			setEditingId(null);
			loadList(false);
		});
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>📍 근무장소 관리</h2>
				<p>key/value 기반으로 근무장소 마스터를 관리합니다. key는 시스템 참조값으로 사용됩니다.</p>
			</div>

			<div className="category-add-box work-location-mgmt__form">
				<input
					type="text"
					className="cat-input"
					placeholder="key (예: seoul_hq)"
					value={newForm.location_key}
					onChange={(e) => setNewForm((prev) => ({ ...prev, location_key: e.target.value }))}
				/>
				<input
					type="text"
					className="cat-input"
					placeholder="value (예: 서울 본사)"
					value={newForm.location_value}
					onChange={(e) => setNewForm((prev) => ({ ...prev, location_value: e.target.value }))}
				/>
				<input
					type="text"
					className="cat-input"
					placeholder="설명 (선택)"
					value={newForm.description}
					onChange={(e) => setNewForm((prev) => ({ ...prev, description: e.target.value }))}
				/>
				<button className="btn-add work-location-mgmt__add-btn" type="button" onClick={handleCreate}>
					추가
				</button>
			</div>
			<p className="work-location-mgmt__hint">
				제약조건: key는 소문자/숫자/_만 허용, key/value는 중복 불가, value는 필수입니다.
			</p>

			<div className="admin-table-wrapper">
				<table className="admin-table">
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
							<th>설명</th>
							<th>상태</th>
							<th>관리</th>
						</tr>
					</thead>
					<tbody>
						{locations.length > 0 ? (
							locations.map((row, index) => (
								<tr key={row.id} className="stagger-item" style={{ animationDelay: `${index * 0.04}s` }}>
									{editingId === row.id ? (
										<>
											<td>
												<input
													type="text"
													value={editForm.location_key}
													onChange={(e) =>
														setEditForm((prev) => ({ ...prev, location_key: e.target.value }))
													}
												/>
											</td>
											<td>
												<input
													type="text"
													value={editForm.location_value}
													onChange={(e) =>
														setEditForm((prev) => ({ ...prev, location_value: e.target.value }))
													}
												/>
											</td>
											<td>
												<input
													type="text"
													value={editForm.description}
													onChange={(e) =>
														setEditForm((prev) => ({ ...prev, description: e.target.value }))
													}
												/>
											</td>
											<td>
												<select
													className="admin-status-select"
													value={editForm.is_active ? 'active' : 'inactive'}
													onChange={(e) =>
														setEditForm((prev) => ({
															...prev,
															is_active: e.target.value === 'active',
														}))
													}
												>
													<option value="active">활성</option>
													<option value="inactive">비활성</option>
												</select>
											</td>
											<td>
												<button className="btn-save" type="button" onClick={() => handleUpdate(row.id)}>
													저장
												</button>
												<button className="btn-cancel" type="button" onClick={() => setEditingId(null)}>
													취소
												</button>
											</td>
										</>
									) : (
										<>
											<td><code>{row.location_key}</code></td>
											<td>{row.location_value}</td>
											<td>{row.description || '-'}</td>
											<td>
												<span className={`status-badge ${row.is_active ? 'open' : 'closed'}`}>
													{row.is_active ? '활성' : '비활성'}
												</span>
											</td>
											<td>
												<button className="btn-edit" type="button" onClick={() => handleStartEdit(row)}>
													수정
												</button>
												<button className="btn-delete" type="button" onClick={() => handleDelete(row.id)}>
													삭제
												</button>
											</td>
										</>
									)}
								</tr>
							))
						) : (
							<tr>
								<td colSpan={5} className="admin-table__empty">
									등록된 근무장소가 없습니다.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default WorkLocationMgmt;
