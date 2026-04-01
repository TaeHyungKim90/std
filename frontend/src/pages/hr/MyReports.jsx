import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { reportApi } from 'api/reportApi';
import { attendanceApi } from 'api/attendanceApi';
import { useApiRequest } from 'hooks/useApiRequest';
import { useAuth } from 'context/AuthContext';
import SideDrawer from 'components/common/SideDrawer';
import AppModal from 'components/common/AppModal';
import {
	addDays,
	addMonths,
	formatDt,
	formatYmdToWeekKo,
	normalizeStatus,
	normalizeToMidnight,
	pad2,
	startOfWeekMonday,
	toYmd,
} from 'utils/dateUtils';
import {
	canShowAttendanceReference,
	hasUsableHireDate,
	isYmdStrictlyBeforeJoinDate,
	shouldConfirmNoAttendanceRecord,
} from 'utils/reportDateUtils';
import 'assets/css/report.css';

const NO_HIRE_DATE_MESSAGE =
	'입사일 정보가 등록되지 않아 보고서를 작성할 수 없습니다. 인사팀에 문의해 주세요.';

const REPORT_TABS = [
	{ id: 'daily', label: '일일 보고' },
	{ id: 'weekly', label: '주간 보고' },
];

function monthStartEndYmd(viewMonth) {
	const y = viewMonth.getFullYear();
	const m = viewMonth.getMonth();
	const from = new Date(y, m, 1);
	const to = new Date(y, m + 1, 0);
	return { dateFrom: toYmd(from), dateTo: toYmd(to) };
}

function weekEndYmd(mondayYmd) {
	const d = new Date(mondayYmd + 'T00:00:00');
	const end = addDays(d, 6);
	return toYmd(end);
}

function weekLabel(mondayDate) {
	const start = toYmd(mondayDate);
	const end = weekEndYmd(start);
	return `${start.replace(/-/g, '.')} ~ ${end.replace(/-/g, '.')}`;
}

const MyReports = () => {
	const auth = useAuth();
	const joinDate = auth?.joinDate ?? null; // DB의 join_date 필드와 매핑됨
	const authLoading = auth == null ? true : Boolean(auth.loading);
	const hireDateRaw = joinDate ?? null;
	const hasHireDate = hasUsableHireDate(hireDateRaw);
	const hireDate = hasHireDate ? hireDateRaw : null;
	const reportsBlockedNoHireDate = !authLoading && !hasHireDate;

	const [mainTab, setMainTab] = useState('daily');
	const [viewMonth, setViewMonth] = useState(() => normalizeToMidnight(new Date()));
	const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekMonday(new Date()));

	const [dailyRows, setDailyRows] = useState([]);
	const [dailyLoading, setDailyLoading] = useState(false);

	const [weekDailies, setWeekDailies] = useState([]);
	const [weekSummaryDraft, setWeekSummaryDraft] = useState('');
	const [weekLoading, setWeekLoading] = useState(false);

	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerDate, setDrawerDate] = useState('');
	const [drawerContent, setDrawerContent] = useState('');
	const [drawerAttendance, setDrawerAttendance] = useState(null);
	const [dailyDrawerPreflight, setDailyDrawerPreflight] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmTargetYmd, setConfirmTargetYmd] = useState('');
	const [confirmTargetAttendance, setConfirmTargetAttendance] = useState(null);

	const putDailyCall = useCallback((payload) => reportApi.putDaily(payload), []);
	const { request: saveDailyReq, loading: savingDaily } = useApiRequest(putDailyCall);

	const putWeeklyCall = useCallback((payload) => reportApi.putWeekly(payload), []);
	const { request: saveWeeklyReq, loading: savingWeekly } = useApiRequest(putWeeklyCall);

	const { dateFrom, dateTo } = useMemo(() => monthStartEndYmd(viewMonth), [viewMonth]);
	const mondayYmd = useMemo(() => toYmd(weekAnchor), [weekAnchor]);

	const dailyByDate = useMemo(() => {
		const m = new Map();
		for (const r of dailyRows) {
			if (r?.report_date) m.set(r.report_date, r);
		}
		return m;
	}, [dailyRows]);

	const loadMonthDailies = useCallback(async () => {
		setDailyLoading(true);
		try {
			const res = await reportApi.getDailyRange(dateFrom, dateTo);
			setDailyRows(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			console.error(err);
			Notify.toastError(formatApiDetail(err) || '일일 보고를 불러오지 못했습니다.');
			setDailyRows([]);
		} finally {
			setDailyLoading(false);
		}
	}, [dateFrom, dateTo]);

	const loadWeekBundle = useCallback(async () => {
		const start = mondayYmd;
		const end = weekEndYmd(start);
		setWeekLoading(true);
		try {
			const [dRes, wRes] = await Promise.all([
				reportApi.getDailyRange(start, end),
				reportApi.getWeekly(start),
			]);
			setWeekDailies(Array.isArray(dRes.data) ? dRes.data : []);
			const w = wRes.data;
			setWeekSummaryDraft(w?.summary ? String(w.summary) : '');
		} catch (err) {
			console.error(err);
			Notify.toastError(formatApiDetail(err) || '주간 데이터를 불러오지 못했습니다.');
			setWeekDailies([]);
			setWeekSummaryDraft('');
		} finally {
			setWeekLoading(false);
		}
	}, [mondayYmd]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) return;
		if (mainTab === 'daily') loadMonthDailies();
	}, [mainTab, loadMonthDailies, reportsBlockedNoHireDate]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) return;
		if (mainTab === 'weekly') loadWeekBundle();
	}, [mainTab, loadWeekBundle, reportsBlockedNoHireDate]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) {
			setDrawerOpen(false);
			setDrawerAttendance(null);
			setDailyDrawerPreflight(false);
		}
	}, [reportsBlockedNoHireDate]);

	const daysInMonth = useMemo(() => {
		const y = viewMonth.getFullYear();
		const m = viewMonth.getMonth();
		const last = new Date(y, m + 1, 0).getDate();
		const out = [];
		for (let d = 1; d <= last; d += 1) {
			const dt = new Date(y, m, d);
			out.push(toYmd(dt));
		}
		return out;
	}, [viewMonth]);

	const closeDailyDrawer = useCallback(() => {
		setDrawerOpen(false);
		setDrawerDate('');
		setDrawerContent('');
		setDrawerAttendance(null);
	}, []);

	const applyDailyDrawerOpen = useCallback(
		(ymd, rec) => {
			const row = dailyByDate.get(ymd);
			setDrawerDate(ymd);
			setDrawerContent(row?.content ? String(row.content) : '');
			setDrawerAttendance(rec ?? null);
			setDrawerOpen(true);
		},
		[dailyByDate]
	);

	const closeConfirmModal = useCallback(() => {
		setConfirmOpen(false);
		setConfirmTargetYmd('');
		setConfirmTargetAttendance(null);
	}, []);

	const proceedConfirmOpen = useCallback(() => {
		if (!confirmTargetYmd) return;
		applyDailyDrawerOpen(confirmTargetYmd, confirmTargetAttendance);
		closeConfirmModal();
	}, [applyDailyDrawerOpen, closeConfirmModal, confirmTargetAttendance, confirmTargetYmd]);

	const openDailyDrawer = useCallback(
		async (ymd) => {
			if (dailyDrawerPreflight || savingDaily || weekLoading || dailyLoading) return;
			if (authLoading) {
				Notify.toastError('로그인 정보를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.');
				return;
			}
			if (!hasHireDate) {
				Notify.toastError(NO_HIRE_DATE_MESSAGE);
				return;
			}
			if (isYmdStrictlyBeforeJoinDate(ymd, hireDate)) {
				Notify.toastError('입사일 이전 날짜는 보고서를 작성할 수 없습니다.');
				return;
			}

			setDailyDrawerPreflight(true);
			try {
				const res = await attendanceApi.getAttendanceForDay(ymd);
				const rec = res.data ?? null;

				if (shouldConfirmNoAttendanceRecord(rec)) {
					setConfirmTargetYmd(ymd);
					setConfirmTargetAttendance(rec);
					setConfirmOpen(true);
					return;
				}

				applyDailyDrawerOpen(ymd, rec);
			} catch (err) {
				console.error(err);
				Notify.toastError(formatApiDetail(err) || '출퇴근 정보를 확인하지 못했습니다.');
			} finally {
				setDailyDrawerPreflight(false);
			}
		},
		[authLoading, hasHireDate, hireDate, applyDailyDrawerOpen, dailyDrawerPreflight, savingDaily, weekLoading, dailyLoading]
	);

	const handleSaveDrawer = async () => {
		if (savingDaily || dailyDrawerPreflight) return;
		if (!hasHireDate || reportsBlockedNoHireDate) {
			Notify.toastError(NO_HIRE_DATE_MESSAGE);
			return;
		}
		const text = drawerContent.trim();
		if (!text) {
			Notify.toastError('내용을 입력해 주세요.');
			return;
		}
		try {
			await saveDailyReq({ report_date: drawerDate, content: text });
			closeDailyDrawer();
			await loadMonthDailies();
		} catch {
			/* toast는 훅에서 처리 */
		}
	};

	const handleSubmitWeekly = async () => {
		if (savingWeekly || weekLoading) return;
		if (!hasHireDate || reportsBlockedNoHireDate) {
			Notify.toastError(NO_HIRE_DATE_MESSAGE);
			return;
		}
		const text = weekSummaryDraft.trim();
		if (!text) {
			Notify.toastError('주간 요약을 입력해 주세요.');
			return;
		}
		try {
			await saveWeeklyReq({ week_start_date: mondayYmd, summary: text });
			await loadWeekBundle();
		} catch {
			/* noop */
		}
	};

	const shiftMonth = (dir) => setViewMonth((prev) => addMonths(prev, dir));
	const shiftWeek = (dir) => setWeekAnchor((prev) => addDays(prev, dir * 7));
	const pageBusy = dailyLoading || weekLoading || savingDaily || savingWeekly || dailyDrawerPreflight;

	const weekReadonlyBlocks = useMemo(() => {
		const start = normalizeToMidnight(new Date(mondayYmd + 'T00:00:00'));
		const lines = [];
		for (let i = 0; i < 7; i += 1) {
			const d = addDays(start, i);
			const ymd = toYmd(d);
			const hit = weekDailies.find((x) => x.report_date === ymd);
			lines.push({
				ymd,
				label: `${ymd.slice(5).replace('-', '/')} (${formatYmdToWeekKo(ymd)})`,
				text: hit?.content ? String(hit.content) : '— 등록된 일일 보고가 없습니다 —',
				beforeJoin:
					!authLoading && hasHireDate && isYmdStrictlyBeforeJoinDate(ymd, hireDate),
			});
		}
		return lines;
	}, [mondayYmd, weekDailies, authLoading, hasHireDate, hireDate]);

	useEffect(() => {
		return () => {
			closeDailyDrawer();
			closeConfirmModal();
		};
	}, [closeDailyDrawer, closeConfirmModal]);

	return (
		<div className="rep-page rep-page--wide rep-page--my-reports">
			<h1 className="rep-page__title">내 보고서</h1>
			<p className="rep-page__sub">일일 업무 내역과 주간 요약을 등록합니다. (캘린더 일정과는 별도입니다.)</p>

			<div className="rep-tabs" role="tablist">
				{REPORT_TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={mainTab === t.id}
						disabled={reportsBlockedNoHireDate}
						aria-disabled={reportsBlockedNoHireDate}
						className={`rep-tab ${mainTab === t.id ? 'rep-tab--active' : ''}`}
						onClick={() => {
							if (reportsBlockedNoHireDate) return;
							setMainTab(t.id);
						}}
					>
						{t.label}
					</button>
				))}
			</div>

			{reportsBlockedNoHireDate ? (
				<div className="rep-empty-state" role="alert">
					<p className="rep-empty-state__title">보고서 작성 불가</p>
					<p className="rep-empty-state__message">{NO_HIRE_DATE_MESSAGE}</p>
				</div>
			) : null}

			{!reportsBlockedNoHireDate && mainTab === 'daily' && (
				<>
					<div className="rep-toolbar">
						<span className="rep-label">
							{viewMonth.getFullYear()}년 {pad2(viewMonth.getMonth() + 1)}월
						</span>
						<div>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftMonth(-1)}>
								이전 달
							</button>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftMonth(1)}>
								다음 달
							</button>
						</div>
					</div>
					{authLoading ? (
						<p className="rep-empty">로그인·입사일 정보를 불러오는 중입니다…</p>
					) : dailyLoading ? (
						<p className="rep-empty">불러오는 중…</p>
					) : (
						<div className="rep-list">
							{dailyDrawerPreflight ? (
								<p className="rep-empty rep-empty--inline">출퇴근 기록을 확인하는 중입니다…</p>
							) : null}
							{daysInMonth.map((ymd) => {
								const row = dailyByDate.get(ymd);
								const preview = row?.content
									? String(row.content).replace(/\s+/g, ' ').slice(0, 72)
									: '';
								const beforeJoin =
									hasHireDate && isYmdStrictlyBeforeJoinDate(ymd, hireDate);
								return (
									<button
										key={ymd}
										type="button"
										className={`rep-list-item rep-list-item--daily stagger-item${beforeJoin ? ' rep-list-item--before-join' : ''}`}
										disabled={pageBusy}
										onClick={() => {
											if (beforeJoin) {
												Notify.toastError('입사일 이전 날짜는 보고서를 작성할 수 없습니다.');
												return;
											}
											openDailyDrawer(ymd);
										}}
									>
										<div className="rep-list-item__title-block">
											<div className="rep-list-item__date">{ymd}</div>
											<div className="rep-list-item__meta">{formatYmdToWeekKo(ymd)}</div>
										</div>
										<div className="rep-list-item__preview-wrap">
											<span className="rep-list-item__preview-label">내용</span>
											<div className="rep-list-item__preview">
												{preview || (row ? '(내용 있음)' : '작성 전 — 클릭하여 입력')}
											</div>
										</div>
										{row ? (
											<span className="rep-badge rep-badge--ok">작성됨</span>
										) : (
											<span className="rep-badge">미작성</span>
										)}
									</button>
								);
							})}
						</div>
					)}
				</>
			)}

			{!reportsBlockedNoHireDate && mainTab === 'weekly' && (
				<>
					<div className="rep-toolbar">
						<span className="rep-label">주간: {weekLabel(weekAnchor)}</span>
						<div>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftWeek(-1)}>
								이전 주
							</button>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftWeek(1)}>
								다음 주
							</button>
						</div>
					</div>
					{weekLoading ? (
						<p className="rep-empty">불러오는 중…</p>
					) : (
						<div className="rep-split rep-split--weekly">
							<div className="rep-split__col rep-split__col--readonly">
								<h3 className="rep-split__col-title">이번 주 일일 보고 (읽기 전용)</h3>
								<div className="rep-readonly-block">
									{weekReadonlyBlocks.map((b) => (
										<div
											key={b.ymd}
											className={`rep-daily-row${b.beforeJoin ? ' rep-daily-row--before-join' : ''}`}
										>
											<div className="rep-daily-row__title">{b.label}</div>
											<div className="rep-daily-row__body">
												{b.beforeJoin ? '입사일 이전 날짜입니다.' : b.text}
											</div>
										</div>
									))}
								</div>
							</div>
							<div className="rep-split__col rep-split__col--weekly-form">
								<h3 className="rep-split__col-title">주간 요약 · 제출</h3>
								<textarea
									className="rep-textarea rep-textarea--weekly"
									value={weekSummaryDraft}
									disabled={savingWeekly}
									onChange={(e) => setWeekSummaryDraft(e.target.value)}
									placeholder="해당 주 업무를 요약해 주세요."
								/>
								<button
									type="button"
									className="rep-btn-primary"
									disabled={savingWeekly}
									onClick={handleSubmitWeekly}
								>
									{savingWeekly ? '저장 중…' : '주간 보고 저장'}
								</button>
							</div>
						</div>
					)}
				</>
			)}

			<SideDrawer
				open={drawerOpen && hasHireDate && !reportsBlockedNoHireDate}
				onClose={closeDailyDrawer}
				overlayClassName="rep-drawer-overlay"
				panelClassName="rep-drawer-panel dynamic-enter"
			>
				<div className="rep-drawer-head">
					<h2 className="rep-drawer-title">일일 보고 — {drawerDate}</h2>
					<button type="button" className="rep-drawer-close" onClick={closeDailyDrawer} aria-label="닫기">
						×
					</button>
				</div>
				<div className="rep-drawer-body">
					{canShowAttendanceReference(drawerAttendance) ? (
						<div className="rep-drawer-attendance-ref" role="region" aria-label="출퇴근 참고">
							<div className="rep-drawer-attendance-ref__head">
								<span className="rep-drawer-attendance-ref__badge">출퇴근 기록 (참고)</span>
								{normalizeStatus(drawerAttendance?.status).includes('LATE') ||
								normalizeStatus(drawerAttendance?.status).includes('지각') ? (
									<span className="rep-drawer-attendance-ref__hint">지각 처리된 날일 수 있습니다.</span>
								) : null}
							</div>
							<dl className="rep-drawer-attendance-ref__times">
								<div className="rep-drawer-attendance-ref__row">
									<dt>출근</dt>
									<dd>{formatDt(drawerAttendance.clock_in_time)}</dd>
								</div>
								<div className="rep-drawer-attendance-ref__row">
									<dt>퇴근</dt>
									<dd>{formatDt(drawerAttendance.clock_out_time)}</dd>
								</div>
							</dl>
						</div>
					) : null}
					<label className="rep-label" htmlFor="rep-daily-textarea">
						업무 내역
					</label>
					<textarea
						id="rep-daily-textarea"
						className="rep-textarea rep-textarea--drawer"
						value={drawerContent}
						disabled={savingDaily}
						onChange={(e) => setDrawerContent(e.target.value)}
						placeholder="당일 수행한 업무를 입력하세요."
					/>
					<button type="button" className="rep-btn-primary" disabled={savingDaily} onClick={handleSaveDrawer}>
						{savingDaily ? '저장 중…' : '저장'}
					</button>
				</div>
			</SideDrawer>

			<AppModal isOpen={confirmOpen} onClose={closeConfirmModal} contentClassName="rep-confirm-modal">
				<h3 className="rep-confirm-modal__title">출근 기록 확인</h3>
				<p className="rep-confirm-modal__message">출근 기록이 없는 날입니다. 작성을 진행하시겠습니까?</p>
				<div className="rep-confirm-modal__actions">
					<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={closeConfirmModal}>
						취소
					</button>
					<button type="button" className="rep-btn-primary" disabled={pageBusy} onClick={proceedConfirmOpen}>
						진행
					</button>
				</div>
			</AppModal>
			{pageBusy ? (
				<div className="rep-loading-overlay" role="status" aria-live="polite">
					<div className="rep-loading-overlay__box">처리 중입니다…</div>
				</div>
			) : null}
		</div>
	);
};

export default MyReports;
