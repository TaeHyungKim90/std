import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { reportApi } from 'api/reportApi';
import SideDrawer from 'components/common/SideDrawer';
import {
	addDays,
	formatYmdToWeekKo,
	getIsoMonthAndWeek,
	getTodayYmd,
	normalizeToMidnight,
	startOfWeekMonday,
	toYmd,
} from 'utils/dateUtils';
import 'assets/css/report.css';
import 'assets/css/attendance.css';
import IdCopyChip from 'components/common/IdCopyChip';

const MONITOR_TABS = [
	{ id: 'daily', label: '일일보고 작성 현황' },
	{ id: 'weekly', label: '주간보고 제출 현황' },
];

const STATUS_LABELS = {
	HOLIDAY: '휴일',
	VACATION: '휴가',
	SUBMITTED: '작성완료',
	MISSING: '미작성',
};

const DAILY_FILTER_OPTIONS = [
	{ value: 'ALL', label: '전체' },
	{ value: 'MISSING', label: '미작성' },
	{ value: 'SUBMITTED', label: '작성완료' },
	{ value: 'VACATION', label: '휴가' },
	{ value: 'HOLIDAY', label: '휴일' },
];

const WEEKLY_FILTER_OPTIONS = [
	{ value: 'ALL', label: '전체' },
	{ value: 'W_MISSING', label: '미제출' },
	{ value: 'W_SUBMITTED', label: '제출완료' },
	{ value: 'W_VACATION', label: '휴가 주차' },
	{ value: 'W_HOLIDAY', label: '휴일 주차' },
];

function weekEndYmd(mondayYmd) {
	const d = new Date(mondayYmd + 'T12:00:00');
	return toYmd(addDays(d, 6));
}

function DailyStatusBadge({ status }) {
	const cls =
		{
			HOLIDAY: 'rep-status-badge rep-status-badge--holiday',
			VACATION: 'rep-status-badge rep-status-badge--vacation',
			SUBMITTED: 'rep-status-badge rep-status-badge--submitted',
			MISSING: 'rep-status-badge rep-status-badge--missing',
		}[status] || 'rep-status-badge rep-status-badge--missing';

	return <span className={cls}>{STATUS_LABELS[status] || status}</span>;
}

const AdminDailyReport = () => {
	const [monitorTab, setMonitorTab] = useState('daily');
	const [dailyWorkYmd, setDailyWorkYmd] = useState(() => getTodayYmd());
	const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekMonday(new Date()));

	const [dailyRows, setDailyRows] = useState([]);
	const [weeklyRows, setWeeklyRows] = useState([]);
	const [dailyLoading, setDailyLoading] = useState(false);
	const [weeklyLoading, setWeeklyLoading] = useState(false);

	const [statusFilter, setStatusFilter] = useState('ALL');

	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerUser, setDrawerUser] = useState(null);
	const [drawerBundleWeekYmd, setDrawerBundleWeekYmd] = useState('');
	const [drawerFocusDateYmd, setDrawerFocusDateYmd] = useState('');
	const [bundleLoading, setBundleLoading] = useState(false);
	const [bundleDailies, setBundleDailies] = useState([]);
	const [bundleWeekly, setBundleWeekly] = useState(null);

	const mondayYmd = useMemo(() => toYmd(weekAnchor), [weekAnchor]);
	const bundleWeekFromDaily = useMemo(
		() => toYmd(startOfWeekMonday(normalizeToMidnight(new Date(`${dailyWorkYmd}T12:00:00`)))),
		[dailyWorkYmd]
	);

	const loadDaily = useCallback(async () => {
		setDailyLoading(true);
		try {
			const res = await reportApi.getAdminDailyStatus(dailyWorkYmd);
			setDailyRows(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			console.error(err);
			Notify.toastError(formatApiDetail(err) || '일일 현황을 불러오지 못했습니다.');
			setDailyRows([]);
		} finally {
			setDailyLoading(false);
		}
	}, [dailyWorkYmd]);

	const loadWeekly = useCallback(async () => {
		setWeeklyLoading(true);
		try {
			const res = await reportApi.getAdminWeekStatus(mondayYmd);
			setWeeklyRows(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			console.error(err);
			Notify.toastError(formatApiDetail(err) || '주간 현황을 불러오지 못했습니다.');
			setWeeklyRows([]);
		} finally {
			setWeeklyLoading(false);
		}
	}, [mondayYmd]);

	useEffect(() => {
		if (monitorTab === 'daily') loadDaily();
	}, [monitorTab, loadDaily]);

	useEffect(() => {
		if (monitorTab === 'weekly') loadWeekly();
	}, [monitorTab, loadWeekly]);

	useEffect(() => {
		setStatusFilter('ALL');
	}, [monitorTab]);

	const weekLabelText = useMemo(() => {
		const iw = getIsoMonthAndWeek(weekAnchor);
		return `${iw.year}년 ${iw.month}월 ${iw.weekIndex}주차 (${mondayYmd} ~ ${weekEndYmd(mondayYmd)})`;
	}, [weekAnchor, mondayYmd]);

	const filteredDailyRows = useMemo(() => {
		let list = [...dailyRows];
		if (statusFilter !== 'ALL') {
			list = list.filter((r) => r.daily_status === statusFilter);
		}
		list.sort((a, b) => String(a.user_name || '').localeCompare(String(b.user_name || ''), 'ko'));
		return list;
	}, [dailyRows, statusFilter]);

	const filteredWeeklyRows = useMemo(() => {
		let list = [...weeklyRows];
		if (statusFilter === 'W_MISSING') list = list.filter((r) => !r.weekly_submitted);
		else if (statusFilter === 'W_SUBMITTED') list = list.filter((r) => r.weekly_submitted);
		else if (statusFilter === 'W_VACATION') list = list.filter((r) => r.weekly_status === 'VACATION');
		else if (statusFilter === 'W_HOLIDAY') list = list.filter((r) => r.weekly_status === 'HOLIDAY');
		list.sort((a, b) => String(a.user_name || '').localeCompare(String(b.user_name || ''), 'ko'));
		return list;
	}, [weeklyRows, statusFilter]);

	const filterOptions = monitorTab === 'daily' ? DAILY_FILTER_OPTIONS : WEEKLY_FILTER_OPTIONS;

	const closeDrawer = useCallback(() => {
		setDrawerOpen(false);
		setDrawerUser(null);
		setDrawerBundleWeekYmd('');
		setDrawerFocusDateYmd('');
		setBundleDailies([]);
		setBundleWeekly(null);
		setBundleLoading(false);
	}, []);

	const openDrawer = async (row, bundleWeekYmd, focusDateYmd = '') => {
		if (bundleLoading || dailyLoading || weeklyLoading) return;
		setDrawerUser(row);
		setDrawerBundleWeekYmd(bundleWeekYmd);
		setDrawerFocusDateYmd(focusDateYmd || '');
		setDrawerOpen(true);
		setBundleLoading(true);
		setBundleDailies([]);
		setBundleWeekly(null);
		try {
			const res = await reportApi.getAdminUserBundle(row.user_login_id, bundleWeekYmd);
			setBundleDailies(Array.isArray(res.data?.dailies) ? res.data.dailies : []);
			setBundleWeekly(res.data?.weekly ?? null);
		} catch (err) {
			console.error(err);
			Notify.toastError(formatApiDetail(err) || '상세를 불러오지 못했습니다.');
		} finally {
			setBundleLoading(false);
		}
	};

	const shiftWeek = (dir) => setWeekAnchor((prev) => addDays(prev, dir * 7));

	const loading = monitorTab === 'daily' ? dailyLoading : weeklyLoading;
	const tableRows = monitorTab === 'daily' ? filteredDailyRows : filteredWeeklyRows;
	const pageBusy = loading || bundleLoading;

	useEffect(() => {
		return () => {
			closeDrawer();
		};
	}, [closeDrawer]);

	return (
		<div className="rep-page">
			<div className="rep-admin-daily-top-row">
				<div className="rep-admin-daily-top-row__intro">
					<h1 className="rep-page__title">보고서 모니터링</h1>
					<p className="rep-page__sub">
						일일 탭은 선택한 근무일 기준 직원별 작성 상태(휴일·휴가·작성·미작성)를, 주간 탭은 해당 주의 주간보고 제출·요약을 확인합니다.
						<br />
						행을 클릭하면 해당 주의 상세 Drawer가 열립니다.
					</p>
				</div>
				{monitorTab === 'daily' ? (
					<div className="rep-admin-daily-top-row__date-wrap">
						<div className="adm-attendance__date-toolbar rep-admin-daily-top-row__date">
							<label className="adm-attendance__date-label" htmlFor="rep-admin-daily-work-date">
								기준일
								<input
									id="rep-admin-daily-work-date"
									type="date"
									className="adm-attendance__date-input"
									value={dailyWorkYmd}
									disabled={pageBusy}
									onChange={(e) => setDailyWorkYmd(e.target.value || getTodayYmd())}
								/>
								<button
									type="button"
									className="adm-attendance__today-btn"
									disabled={pageBusy}
									onClick={() => setDailyWorkYmd(getTodayYmd())}
								>
									오늘
								</button>
							</label>
						</div>
						<p className="rep-admin-daily-date-toolbar__hint">
							{formatYmdToWeekKo(dailyWorkYmd)} · 선택한 날짜 기준으로 상태를 표시합니다.
						</p>
					</div>
				) : (
					<div className="rep-admin-weekly-top-row__nav-wrap">
						<p className="rep-admin-weekly-nav__week">{weekLabelText}</p>
						<div className="rep-admin-weekly-nav__btns" aria-label="주차 이동">
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftWeek(-1)}>
								이전 주
							</button>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftWeek(1)}>
								다음 주
							</button>
						</div>
						<p className="rep-admin-daily-date-toolbar__hint rep-admin-weekly-nav__hint">
							선택한 주차 기준으로 제출·요약을 표시합니다.
						</p>
					</div>
				)}
			</div>

			<div className="rep-tabs rep-tabs--segment" role="tablist">
				{MONITOR_TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={monitorTab === t.id}
						className={`rep-tab ${monitorTab === t.id ? 'rep-tab--active' : ''}`}
						disabled={pageBusy}
						onClick={() => setMonitorTab(t.id)}
					>
						{t.label}
					</button>
				))}
			</div>

			{monitorTab === 'daily' && (
				<div className="rep-admin-toolbar-stack rep-admin-toolbar-stack--daily-filter" aria-label="일일 보고 필터">
					<label className="rep-admin-daily-toolbar__group" htmlFor="rep-admin-daily-status-filter">
						<span className="rep-admin-daily-toolbar__label">상태 필터</span>
						<select
							id="rep-admin-daily-status-filter"
							className="rep-admin-filter-select"
							value={statusFilter}
							disabled={pageBusy}
							onChange={(e) => setStatusFilter(e.target.value)}
						>
							{filterOptions.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			{monitorTab !== 'daily' && (
				<div className="rep-admin-filter-bar">
					<label className="rep-admin-filter-label">
						<span className="rep-label">상태 필터</span>
						<select
							className="rep-admin-filter-select"
							value={statusFilter}
							disabled={pageBusy}
							onChange={(e) => setStatusFilter(e.target.value)}
						>
							{filterOptions.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			<div className="rep-admin-table-wrap">
				<table className="rep-admin-table">
					<thead>
						<tr>
							<th>이름</th>
							<th>로그인 ID</th>
							{monitorTab === 'daily' ? (
								<th>일일 상태</th>
							) : (
								<>
									<th>주간 제출</th>
									<th className="rep-admin-th-summary">주간 요약</th>
								</>
							)}
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr>
								<td colSpan={monitorTab === 'daily' ? 3 : 4}>불러오는 중…</td>
							</tr>
						) : tableRows.length === 0 ? (
							<tr>
								<td colSpan={monitorTab === 'daily' ? 3 : 4}>표시할 데이터가 없습니다.</td>
							</tr>
						) : monitorTab === 'daily' ? (
							tableRows.map((row) => (
								<tr key={row.user_login_id} onClick={() => (!pageBusy ? openDrawer(row, bundleWeekFromDaily, dailyWorkYmd) : undefined)}>
									<td>{row.user_name}</td>
									<td className="rep-admin-td-login">
										<IdCopyChip value={row.user_login_id} compact isolateRowClick />
									</td>
									<td>
										<DailyStatusBadge status={row.daily_status} />
									</td>
								</tr>
							))
						) : (
							tableRows.map((row) => (
								<tr key={row.user_login_id} onClick={() => (!pageBusy ? openDrawer(row, mondayYmd) : undefined)}>
									<td>{row.user_name}</td>
									<td className="rep-admin-td-login">
										<IdCopyChip value={row.user_login_id} compact isolateRowClick />
									</td>
									<td>
										{row.weekly_status === 'VACATION' ? (
											<span className="rep-status-badge rep-status-badge--vacation">휴가</span>
										) : row.weekly_status === 'HOLIDAY' ? (
											<span className="rep-status-badge rep-status-badge--holiday">휴일</span>
										) : null}{' '}
										{row.weekly_submitted ? (
											<span className="rep-status-badge rep-status-badge--submitted">제출</span>
										) : (
											<span className="rep-status-badge rep-status-badge--missing">미제출</span>
										)}
									</td>
									<td className="rep-admin-td-summary" title={row.weekly_summary_preview || ''}>
										{row.weekly_summary_preview ? (
											<span className="rep-admin-summary-preview">{row.weekly_summary_preview}</span>
										) : (
											<span className="rep-empty rep-empty--table">—</span>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<SideDrawer
				open={drawerOpen}
				onClose={closeDrawer}
				overlayClassName="rep-admin-drawer-overlay"
				panelClassName="rep-admin-drawer-panel rep-drawer-panel dynamic-enter"
			>
				<div className="rep-drawer-head">
					<h2 className={`rep-drawer-title${drawerUser ? ' rep-drawer-title--with-meta' : ''}`}>
						{drawerUser ? (
							<>
								<span>{drawerUser.user_name}</span>
								<span className="rep-drawer-title__meta">
									(<IdCopyChip value={drawerUser.user_login_id} compact />)
								</span>
							</>
						) : (
							'상세'
						)}
					</h2>
					<button type="button" className="rep-drawer-close" onClick={closeDrawer} aria-label="닫기">
						×
					</button>
				</div>
				<div className="rep-drawer-body">
					{drawerBundleWeekYmd ? (
						<p className="rep-drawer-context">
							기준 주: {drawerBundleWeekYmd} ~ {weekEndYmd(drawerBundleWeekYmd)}
						</p>
					) : null}
					{bundleLoading ? (
						<p className="rep-empty">불러오는 중…</p>
					) : (
						<>
							<section className="rep-admin-section">
								<h3 className="rep-admin-section__title">일일 보고 원본</h3>
								{bundleDailies.length === 0 ? (
									<p className="rep-empty">등록된 일일 보고가 없습니다.</p>
								) : (
									<div className="rep-readonly-block">
										{bundleDailies.map((d) => (
											<div
												key={d.id}
												className={`rep-daily-row${drawerFocusDateYmd && d.report_date === drawerFocusDateYmd ? ' rep-daily-row--focus-date' : ''}`}
											>
												<strong>
													{d.report_date} ({formatYmdToWeekKo(d.report_date)})
												</strong>
												<div>{d.content}</div>
											</div>
										))}
									</div>
								)}
							</section>
							<section className="rep-admin-section">
								<h3 className="rep-admin-section__title">주간 요약</h3>
								{bundleWeekly?.summary ? (
									<div className="rep-readonly-block">{bundleWeekly.summary}</div>
								) : (
									<p className="rep-empty">제출된 주간 보고가 없습니다.</p>
								)}
							</section>
						</>
					)}
				</div>
			</SideDrawer>
			{pageBusy ? (
				<div className="rep-loading-overlay" role="status" aria-live="polite">
					<div className="rep-loading-overlay__box">처리 중입니다…</div>
				</div>
			) : null}
		</div>
	);
};

export default AdminDailyReport;
