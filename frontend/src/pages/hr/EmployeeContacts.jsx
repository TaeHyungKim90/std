import 'assets/css/employee-contacts.css';

import { directoryApi } from 'api/directoryApi';
import UserAvatar from 'components/common/UserAvatar';
import { useLoading } from 'context/LoadingContext';
import { useCallback, useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatUserDisplayName } from 'utils/userDisplayName';

function MemberCell({ user }) {
	return (
		<div className="emp-contacts__person">
			<UserAvatar
				imageUrl={user.user_profile_image_url}
				nickname={user.user_nickname}
				name={user.user_name}
				size={36}
				avatarAdjust={{
					zoom: user.avatar_zoom,
					offsetX: user.avatar_offset_x,
					offsetY: user.avatar_offset_y,
				}}
			/>
			<span className="emp-contacts__person-name">
				{formatUserDisplayName(user.user_name, user.user_nickname)}
			</span>
		</div>
	);
}

function PhoneLink({ phone }) {
	if (!phone) return <span className="emp-contacts__muted">—</span>;
	return (
		<a href={`tel:${phone}`} className="emp-contacts__phone" onClick={(e) => e.stopPropagation()}>
			{phone}
		</a>
	);
}

function AddressCell({ address }) {
	if (address) return <span>{address}</span>;
	return <span className="emp-contacts__muted">비공개</span>;
}

const EmployeeContacts = () => {
	const { showLoading, hideLoading } = useLoading();
	const [tab, setTab] = useState('list');
	const [q, setQ] = useState('');
	const [qApplied, setQApplied] = useState('');
	const [departmentId, setDepartmentId] = useState('');
	const [departments, setDepartments] = useState([]);
	const [items, setItems] = useState([]);
	const [org, setOrg] = useState({ departments: [], unassigned: [] });

	const loadDepartments = useCallback(async () => {
		const res = await directoryApi.departments();
		setDepartments(Array.isArray(res.data?.items) ? res.data.items : []);
	}, []);

	const loadList = useCallback(async () => {
		const params = {};
		if (qApplied) params.q = qApplied;
		if (departmentId) params.department_id = Number(departmentId);
		const res = await directoryApi.list(params);
		setItems(Array.isArray(res.data?.items) ? res.data.items : []);
	}, [qApplied, departmentId]);

	const loadOrg = useCallback(async () => {
		const res = await directoryApi.org();
		setOrg({
			departments: Array.isArray(res.data?.departments) ? res.data.departments : [],
			unassigned: Array.isArray(res.data?.unassigned) ? res.data.unassigned : [],
		});
	}, []);

	useEffect(() => {
		showLoading('부서 목록을 불러오는 중입니다...');
		loadDepartments()
			.catch((err) => Notify.toastApiFailure(err, '부서 목록을 불러오지 못했습니다.'))
			.finally(() => hideLoading());
	}, [loadDepartments, showLoading, hideLoading]);

	useEffect(() => {
		if (tab !== 'list') return;
		showLoading('연락처를 불러오는 중입니다...');
		loadList()
			.catch((err) => Notify.toastApiFailure(err, '연락처를 불러오지 못했습니다.'))
			.finally(() => hideLoading());
	}, [tab, loadList, showLoading, hideLoading]);

	useEffect(() => {
		if (tab !== 'org') return;
		showLoading('조직도를 불러오는 중입니다...');
		loadOrg()
			.catch((err) => Notify.toastApiFailure(err, '조직도를 불러오지 못했습니다.'))
			.finally(() => hideLoading());
	}, [tab, loadOrg, showLoading, hideLoading]);

	const handleSearch = (e) => {
		e.preventDefault();
		setQApplied(q.trim());
	};

	return (
		<div className="bq-admin-view emp-contacts">
			<div className="admin-header">
				<div>
					<h2>직원 연락처</h2>
					<p>같은 회사 동료의 연락처를 찾고, 부서별 조직도를 확인하세요. 주소는 공개에 동의한 경우에만 표시됩니다.</p>
				</div>
			</div>

			<div className="emp-contacts__tabs" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'list'}
					className={`emp-contacts__tab${tab === 'list' ? ' is-active' : ''}`}
					onClick={() => setTab('list')}
				>
					목록
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'org'}
					className={`emp-contacts__tab${tab === 'org' ? ' is-active' : ''}`}
					onClick={() => setTab('org')}
				>
					조직도
				</button>
			</div>

			{tab === 'list' ? (
				<>
					<form className="emp-contacts__filters" onSubmit={handleSearch}>
						<input
							type="search"
							className="emp-contacts__search"
							placeholder="이름 · 닉네임 · 전화 검색"
							value={q}
							onChange={(e) => setQ(e.target.value)}
							aria-label="연락처 검색"
						/>
						<select
							className="emp-contacts__dept-select"
							value={departmentId}
							onChange={(e) => setDepartmentId(e.target.value)}
							aria-label="부서 필터"
						>
							<option value="">전체 부서</option>
							{departments.map((d) => (
								<option key={d.id} value={d.id}>
									{d.department_name}
								</option>
							))}
						</select>
						<button type="submit" className="btn-primary emp-contacts__search-btn">
							검색
						</button>
					</form>

					<div className="admin-table-wrapper">
						<table className="admin-table emp-contacts__table">
							<thead>
								<tr>
									<th>이름</th>
									<th>부서</th>
									<th>직급</th>
									<th>전화</th>
									<th>주소</th>
								</tr>
							</thead>
							<tbody>
								{items.length === 0 ? (
									<tr>
										<td colSpan={5} className="emp-contacts__empty">
											검색 결과가 없습니다.
										</td>
									</tr>
								) : (
									items.map((user, index) => (
										<tr
											key={user.id}
											className="stagger-item"
											style={{ animationDelay: `${index * 0.03}s` }}
										>
											<td>
												<MemberCell user={user} />
											</td>
											<td>{user.department_name || '—'}</td>
											<td>{user.position_name || '—'}</td>
											<td>
												<PhoneLink phone={user.user_phone_number} />
											</td>
											<td>
												<AddressCell address={user.address} />
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</>
			) : (
				<div className="emp-contacts__org-grid">
					{org.departments.map((dept) => (
						<section key={dept.id} className="emp-contacts__org-col">
							<h3 className="emp-contacts__org-title">
								{dept.department_name}
								<span className="emp-contacts__org-count">{dept.members?.length || 0}</span>
							</h3>
							<div className="emp-contacts__org-cards">
								{(dept.members || []).length === 0 ? (
									<p className="emp-contacts__muted emp-contacts__org-empty">소속 직원이 없습니다.</p>
								) : (
									(dept.members || []).map((user) => (
										<article key={user.id} className="emp-contacts__card">
											<MemberCell user={user} />
											<div className="emp-contacts__card-meta">
												<span>{user.position_name || '직급 미지정'}</span>
												<PhoneLink phone={user.user_phone_number} />
												{user.address ? (
													<span className="emp-contacts__card-addr">{user.address}</span>
												) : null}
											</div>
										</article>
									))
								)}
							</div>
						</section>
					))}

					<section className="emp-contacts__org-col emp-contacts__org-col--unassigned">
						<h3 className="emp-contacts__org-title">
							부서 미배정
							<span className="emp-contacts__org-count">{org.unassigned?.length || 0}</span>
						</h3>
						<div className="emp-contacts__org-cards">
							{(org.unassigned || []).length === 0 ? (
								<p className="emp-contacts__muted emp-contacts__org-empty">해당 인원이 없습니다.</p>
							) : (
								(org.unassigned || []).map((user) => (
									<article key={user.id} className="emp-contacts__card">
										<MemberCell user={user} />
										<div className="emp-contacts__card-meta">
											<span>{user.position_name || '직급 미지정'}</span>
											<PhoneLink phone={user.user_phone_number} />
											{user.address ? (
												<span className="emp-contacts__card-addr">{user.address}</span>
											) : null}
										</div>
									</article>
								))
							)}
						</div>
					</section>
				</div>
			)}
		</div>
	);
};

export default EmployeeContacts;
