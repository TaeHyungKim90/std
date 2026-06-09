import 'assets/css/report.css';

import { attendanceApi } from 'api/attendanceApi';
import { holidayApi } from 'api/holidayApi';
import { reportApi } from 'api/reportApi';
import AppModal from 'components/common/AppModal';
import SideDrawer from 'components/common/SideDrawer';
import { useAuth } from 'context/AuthContext';
import { useApiRequest } from 'hooks/useApiRequest';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	addDays,
	addMonths,
	formatDt,
	formatYmdToWeekKo,
	normalizeStatus,
	normalizeToMidnight,
	pad2,
	toYmd,
} from 'utils/dateUtils';
import {
	canShowAttendanceReference,
	hasUsableHireDate,
	isYmdStrictlyBeforeJoinDate,
	shouldConfirmNoAttendanceRecord,
} from 'utils/reportDateUtils';
import * as Notify from 'utils/toastUtils';

const NO_HIRE_DATE_MESSAGE =
	'입사일 정보가 등록되지 않아 보고서를 작성할 수 없습니다. 인사팀에 문의해 주세요.';

const REPORT_TABS = [
	{ id: 'daily', label: '일일 보고' },
	{ id: 'weekly', label: '주간 보고' },
	{ id: 'monthly', label: '월간 보고' },
];

function monthStartEndYmd(viewMonth) {
	const y = viewMonth.getFullYear();
	const m = viewMonth.getMonth();
	const from = new Date(y, m, 1);
	const to = new Date(y, m + 1, 0);
	return { dateFrom: toYmd(from), dateTo: toYmd(to) };
}

/** dateFrom~dateTo(포함) YYYY-MM-DD 목록 — 렌더·API 구간 동일 기준 (31일 달 누락 방지) */
function enumerateYmdInclusive(dateFrom, dateTo) {
	const out = [];
	const startDate = new Date(`${dateFrom}T00:00:00`);
	const endDate = new Date(`${dateTo}T00:00:00`);
	if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return out;
	for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
		out.push(toYmd(d));
	}
	return out;
}

function weekEndYmd(weekStartYmd) {
	const d = new Date(weekStartYmd + 'T00:00:00');
	const end = addDays(d, 6);
	return toYmd(end);
}

function startOfWeekSunday(d) {
	const x = normalizeToMidnight(d);
	x.setDate(x.getDate() - x.getDay());
	return x;
}

function weekLabel(weekStartDate) {
	const start = toYmd(weekStartDate);
	const end = weekEndYmd(start);
	return `${start.replace(/-/g, '.')} ~ ${end.replace(/-/g, '.')}`;
}

function getYearsInRange(startYmd, endYmd) {
	const startYear = Number(String(startYmd).slice(0, 4));
	const endYear = Number(String(endYmd).slice(0, 4));
	if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return [];
	const years = [];
	for (let y = startYear; y <= endYear; y += 1) {
		years.push(String(y));
	}
	return years;
}

/** 일일보고 drawer: 단일 근태 레거시 또는 GET day/sessions 응답 */
function attendanceSessionsFromDrawerPayload(payload) {
	if (!payload) return [];
	if (Array.isArray(payload.items)) return payload.items;
	if (payload.clock_in_time) return [payload];
	return [];
}

function getDateTone(ymd, holidayDates) {
	if (!ymd) return '';
	const d = new Date(`${ymd}T00:00:00`);
	if (Number.isNaN(d.getTime())) return '';
	if (holidayDates.has(ymd) || d.getDay() === 0) return 'holiday';
	if (d.getDay() === 6) return 'saturday';
	return '';
}

function getDailyConfirmMessage(ymd, clockCtx) {
	const d = new Date(`${ymd}T00:00:00`);
	const reasons = [];
	if (clockCtx?.is_public_holiday) {
		reasons.push('공휴일');
	} else if (!Number.isNaN(d.getTime()) && d.getDay() === 0) {
		reasons.push('휴일');
	}
	if (!Number.isNaN(d.getTime()) && d.getDay() === 6) {
		reasons.push('토요일');
	}
	if (
		clockCtx?.requires_full_day_vacation_confirm ||
		clockCtx?.has_half_day_vacation ||
		clockCtx?.has_sick_or_special_vacation ||
		clockCtx?.requires_official_leave_confirm
	) {
		reasons.push('휴가일');
	}
	if (reasons.length === 0) {
		return '출근 기록이 없는 날입니다. 작성을 진행하시겠습니까?';
	}
	return `${reasons.join(', ')}입니다. 작성을 진행하시겠습니까?`;
}

function isVacationContext(clockCtx) {
	return Boolean(
		clockCtx?.requires_full_day_vacation_confirm ||
			clockCtx?.has_half_day_vacation ||
			clockCtx?.has_sick_or_special_vacation ||
			clockCtx?.requires_official_leave_confirm
	);
}

function clockContextsFromRangeResponse(res) {
	const items = Array.isArray(res?.data?.items) ? res.data.items : [];
	return Object.fromEntries(items.map((ctx) => [ctx.work_date, ctx]));
}

function isSameCalendarMonth(a, b) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** 내 보고서 일일 목록 스크롤 박스(.rep-my-reports-body--scroll)를 우선 — scrollHeight 판정 전에 잘못된 조상 선택 방지 */
function getVerticalScrollParent(node) {
	let el = node?.parentElement ?? null;
	while (el && el !== document.documentElement) {
		if (el.classList.contains('rep-my-reports-body--scroll')) {
			return el;
		}
		const { overflowY } = getComputedStyle(el);
		if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1) {
			return el;
		}
		el = el.parentElement;
	}
	return document.scrollingElement || document.documentElement;
}

/** 일일 목록 스크롤 박스 안에서 오늘 행이 보이는 영역 상단에 오도록 스크롤 */
function scrollDailyRowToListViewportTop(rowEl, gapPx = 8) {
	if (!rowEl || !(rowEl instanceof Element)) return;
	const scrollParent = getVerticalScrollParent(rowEl);
	if (!scrollParent) return;
	const pRect = scrollParent.getBoundingClientRect();
	const desiredRowTop = pRect.top + gapPx;
	const eRect = rowEl.getBoundingClientRect();
	const delta = eRect.top - desiredRowTop;
	if (Math.abs(delta) < 2) return;
	scrollParent.scrollTop += delta;
}

const MyReports = () => {
	const auth = useAuth();
	const refreshAuth = auth?.refreshAuth;
	const joinDate = auth?.joinDate ?? null; // DB의 join_date 필드와 매핑됨
	const authLoading = auth == null ? true : Boolean(auth.loading);
	const hireDateRaw = joinDate ?? null;
	const hasHireDate = hasUsableHireDate(hireDateRaw);
	const hireDate = hasHireDate ? hireDateRaw : null;
	const reportsBlockedNoHireDate = !authLoading && !hasHireDate;

	const [mainTab, setMainTab] = useState('daily');
	const [viewMonth, setViewMonth] = useState(() => normalizeToMidnight(new Date()));
	const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekSunday(new Date()));

	const [dailyRows, setDailyRows] = useState([]);
	const [dailyLoading, setDailyLoading] = useState(false);
	const [holidayDates, setHolidayDates] = useState(() => new Set());
	const [holidayNames, setHolidayNames] = useState({});
	const [dailyClockContexts, setDailyClockContexts] = useState({});

	const [weekDailies, setWeekDailies] = useState([]);
	const [weekSummaryDraft, setWeekSummaryDraft] = useState('');
	const [weekLoading, setWeekLoading] = useState(false);
	const [weekClockContexts, setWeekClockContexts] = useState({});

	const [monthDailies, setMonthDailies] = useState([]);
	const [monthSummaryDraft, setMonthSummaryDraft] = useState('');
	const [monthLoading, setMonthLoading] = useState(false);
	const [monthClockContexts, setMonthClockContexts] = useState({});

	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerDate, setDrawerDate] = useState('');
	const [drawerContent, setDrawerContent] = useState('');
	/** 열었을 때(또는 해당 날짜로 다시 적용했을 때) 서버/목록 기준 본문 — 수정 여부 판별용 */
	const [drawerBaseline, setDrawerBaseline] = useState('');
	const [drawerAttendance, setDrawerAttendance] = useState(null);
	const [dailyDrawerPreflight, setDailyDrawerPreflight] = useState(false);
	const [dailyUnsavedModal, setDailyUnsavedModal] = useState(null);
	const suppressDailyDirtyGuardRef = useRef(false);
	const openDailyDrawerRef = useRef(async (_ymd) => {});
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmTargetYmd, setConfirmTargetYmd] = useState('');
	const [confirmTargetAttendance, setConfirmTargetAttendance] = useState(null);
	const [confirmMessage, setConfirmMessage] = useState('출근 기록이 없는 날입니다. 작성을 진행하시겠습니까?');

	const dailyListRef = useRef(null);
	const prevDailyLoadingRef = useRef(false);

	const putDailyCall = useCallback((payload) => reportApi.putDaily(payload), []);
	const { request: saveDailyReq, loading: savingDaily } = useApiRequest(putDailyCall);

	const putWeeklyCall = useCallback((payload) => reportApi.putWeekly(payload), []);
	const { request: saveWeeklyReq, loading: savingWeekly } = useApiRequest(putWeeklyCall);

	const putMonthlyCall = useCallback((payload) => reportApi.putMonthly(payload), []);
	const { request: saveMonthlyReq, loading: savingMonthly } = useApiRequest(putMonthlyCall);

	const { dateFrom, dateTo } = useMemo(() => monthStartEndYmd(viewMonth), [viewMonth]);
	const monthStartYmd = dateFrom;
	const weekStartYmd = useMemo(() => toYmd(startOfWeekSunday(weekAnchor)), [weekAnchor]);

	const drawerAttendanceSessions = useMemo(
		() => attendanceSessionsFromDrawerPayload(drawerAttendance),
		[drawerAttendance]
	);

	const loadHolidayDates = useCallback(async (startYmd, endYmd) => {
		const years = getYearsInRange(startYmd, endYmd);
		if (years.length === 0) {
			setHolidayDates(new Set());
			setHolidayNames({});
			return;
		}
		const responses = await Promise.all(years.map((year) => holidayApi.getHolidays(year)));
		const next = new Set();
		const names = {};
		for (const res of responses) {
			for (const holiday of Array.isArray(res.data) ? res.data : []) {
				if (holiday?.holiday_date) {
					next.add(holiday.holiday_date);
					if (holiday?.holiday_name) {
						names[holiday.holiday_date] = holiday.holiday_name;
					}
				}
			}
		}
		setHolidayDates(next);
		setHolidayNames(names);
	}, []);

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
			const [res, , ctxRes] = await Promise.all([
				reportApi.getDailyRange(dateFrom, dateTo),
				loadHolidayDates(dateFrom, dateTo),
				attendanceApi.getClockContextRange(dateFrom, dateTo).catch(() => ({ data: { items: [] } })),
			]);
			setDailyRows(Array.isArray(res.data) ? res.data : []);
			setDailyClockContexts(clockContextsFromRangeResponse(ctxRes));
		} catch (err) {
			Notify.toastApiFailure(err, '일일 보고를 불러오지 못했습니다.');
			setDailyRows([]);
			setDailyClockContexts({});
		} finally {
			setDailyLoading(false);
		}
	}, [dateFrom, dateTo, loadHolidayDates]);

	const loadWeekBundle = useCallback(async () => {
		const start = weekStartYmd;
		const end = weekEndYmd(start);
		setWeekLoading(true);
		try {
			const [dRes, wRes, , ctxRes] = await Promise.all([
				reportApi.getDailyRange(start, end),
				reportApi.getWeekly(start),
				loadHolidayDates(start, end),
				attendanceApi.getClockContextRange(start, end).catch(() => ({ data: { items: [] } })),
			]);
			setWeekDailies(Array.isArray(dRes.data) ? dRes.data : []);
			setWeekClockContexts(clockContextsFromRangeResponse(ctxRes));
			const w = wRes.data;
			setWeekSummaryDraft(w?.summary ? String(w.summary) : '');
		} catch (err) {
			Notify.toastApiFailure(err, '주간 데이터를 불러오지 못했습니다.');
			setWeekDailies([]);
			setWeekClockContexts({});
			setWeekSummaryDraft('');
		} finally {
			setWeekLoading(false);
		}
	}, [weekStartYmd, loadHolidayDates]);

	const loadMonthBundle = useCallback(async () => {
		setMonthLoading(true);
		try {
			const [dRes, mRes, , ctxRes] = await Promise.all([
				reportApi.getDailyRange(dateFrom, dateTo),
				reportApi.getMonthly(monthStartYmd),
				loadHolidayDates(dateFrom, dateTo),
				attendanceApi.getClockContextRange(dateFrom, dateTo).catch(() => ({ data: { items: [] } })),
			]);
			setMonthDailies(Array.isArray(dRes.data) ? dRes.data : []);
			setMonthClockContexts(clockContextsFromRangeResponse(ctxRes));
			const m = mRes.data;
			setMonthSummaryDraft(m?.summary ? String(m.summary) : '');
		} catch (err) {
			Notify.toastApiFailure(err, '월간 데이터를 불러오지 못했습니다.');
			setMonthDailies([]);
			setMonthClockContexts({});
			setMonthSummaryDraft('');
		} finally {
			setMonthLoading(false);
		}
	}, [dateFrom, dateTo, monthStartYmd, loadHolidayDates]);

	// 다른 메뉴를 갔다가 다시 들어올 때 입사일 등 최신 값을 DB와 맞춤 (페이지 내 탭 전환만으로는 호출되지 않음)
	useEffect(() => {
		if (!refreshAuth) return;
		refreshAuth();
	}, [refreshAuth]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) return;
		if (mainTab === 'daily') void loadMonthDailies();
	}, [mainTab, loadMonthDailies, reportsBlockedNoHireDate]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) return;
		if (mainTab === 'weekly') loadWeekBundle();
	}, [mainTab, loadWeekBundle, reportsBlockedNoHireDate]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) return;
		if (mainTab === 'monthly') void loadMonthBundle();
	}, [mainTab, loadMonthBundle, reportsBlockedNoHireDate]);

	useEffect(() => {
		if (reportsBlockedNoHireDate) {
			setDrawerOpen(false);
			setDrawerAttendance(null);
			setDailyDrawerPreflight(false);
		}
	}, [reportsBlockedNoHireDate]);

	const daysInMonth = useMemo(() => enumerateYmdInclusive(dateFrom, dateTo), [dateFrom, dateTo]);

	const viewingCurrentMonth = useMemo(
		() => isSameCalendarMonth(viewMonth, normalizeToMidnight(new Date())),
		[viewMonth]
	);

	// 일일 목록 로드가 끝난 직후에만 스크롤 — 마운트 시 dailyLoading=false인 채로 effect가 먼저 도는 레이스 방지
	useEffect(() => {
		const wasLoading = prevDailyLoadingRef.current;
		const finishedMonthFetch = wasLoading === true && dailyLoading === false;
		prevDailyLoadingRef.current = dailyLoading;

		if (!finishedMonthFetch) return;
		if (mainTab !== 'daily' || reportsBlockedNoHireDate || authLoading) return;
		if (!viewingCurrentMonth) return;

		const todayYmd = toYmd(normalizeToMidnight(new Date()));
		const root = dailyListRef.current;
		if (!root) return;
		const el = root.querySelector(`[data-rep-daily-ymd="${todayYmd}"]`);
		if (!el) return;

		// 레이아웃은 .bq-main-content 가 스크롤 — scrollIntoView 만으론 맨 위 정렬이 불안정할 수 있음
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				scrollDailyRowToListViewportTop(el, 8);
			});
		});
	}, [
		authLoading,
		dailyLoading,
		mainTab,
		reportsBlockedNoHireDate,
		viewMonth,
		viewingCurrentMonth,
	]);

	const closeDailyDrawer = useCallback(() => {
		setDrawerOpen(false);
		setDrawerDate('');
		setDrawerContent('');
		setDrawerBaseline('');
		setDrawerAttendance(null);
	}, []);

	const applyDailyDrawerOpen = useCallback(
		(ymd, rec) => {
			const row = dailyByDate.get(ymd);
			const initial = row?.content ? String(row.content) : '';
			setDrawerDate(ymd);
			setDrawerContent(initial);
			setDrawerBaseline(initial);
			setDrawerAttendance(rec ?? null);
			setDrawerOpen(true);
		},
		[dailyByDate]
	);

	const isDailyDrawerDirty = useMemo(() => {
		if (!drawerOpen || !drawerDate) return false;
		return drawerContent.trim() !== drawerBaseline.trim();
	}, [drawerOpen, drawerDate, drawerContent, drawerBaseline]);

	const requestCloseDailyDrawer = useCallback(() => {
		if (!drawerOpen) return;
		if (isDailyDrawerDirty) {
			setDailyUnsavedModal({ intent: 'close', pendingYmd: null });
			return;
		}
		closeDailyDrawer();
	}, [drawerOpen, isDailyDrawerDirty, closeDailyDrawer]);

	const discardDailyDraftAndProceed = useCallback(() => {
		const pending = dailyUnsavedModal;
		setDailyUnsavedModal(null);
		if (!pending) return;
		if (pending.intent === 'close') {
			closeDailyDrawer();
			return;
		}
		if (pending.intent === 'openOther' && pending.pendingYmd) {
			closeDailyDrawer();
			suppressDailyDirtyGuardRef.current = true;
			void openDailyDrawerRef.current(pending.pendingYmd);
		}
	}, [dailyUnsavedModal, closeDailyDrawer]);

	const closeConfirmModal = useCallback(() => {
		setConfirmOpen(false);
		setConfirmTargetYmd('');
		setConfirmTargetAttendance(null);
		setConfirmMessage('출근 기록이 없는 날입니다. 작성을 진행하시겠습니까?');
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

			if (!suppressDailyDirtyGuardRef.current) {
				if (drawerOpen && drawerDate && drawerDate !== ymd) {
					if (drawerContent.trim() !== drawerBaseline.trim()) {
						setDailyUnsavedModal({ intent: 'openOther', pendingYmd: ymd });
						return;
					}
				}
			}
			suppressDailyDirtyGuardRef.current = false;

			setDailyDrawerPreflight(true);
			try {
				const [res, ctxRes] = await Promise.all([
					attendanceApi.getAttendanceDaySessions(ymd),
					attendanceApi.getClockContext(ymd),
				]);
				const bundle = res.data ?? null;
				const clockCtx = ctxRes.data ?? null;

				if (shouldConfirmNoAttendanceRecord(bundle)) {
					setConfirmTargetYmd(ymd);
					setConfirmTargetAttendance(bundle);
					setConfirmMessage(getDailyConfirmMessage(ymd, clockCtx));
					setConfirmOpen(true);
					return;
				}

				applyDailyDrawerOpen(ymd, bundle);
			} catch (err) {
				Notify.toastApiFailure(err, '출퇴근 정보를 확인하지 못했습니다.');
			} finally {
				setDailyDrawerPreflight(false);
			}
		},
		[
			authLoading,
			hasHireDate,
			hireDate,
			applyDailyDrawerOpen,
			dailyDrawerPreflight,
			savingDaily,
			weekLoading,
			dailyLoading,
			drawerOpen,
			drawerDate,
			drawerContent,
			drawerBaseline,
		]
	);

	useEffect(() => {
		openDailyDrawerRef.current = openDailyDrawer;
	}, [openDailyDrawer]);

	const handleSaveDrawer = async (afterSuccess) => {
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
			await loadMonthDailies();
			setDailyUnsavedModal(null);
			if (afterSuccess?.kind === 'openOther' && afterSuccess.ymd) {
				closeDailyDrawer();
				suppressDailyDirtyGuardRef.current = true;
				await openDailyDrawerRef.current(afterSuccess.ymd);
			} else {
				closeDailyDrawer();
			}
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
			await saveWeeklyReq({ week_start_date: weekStartYmd, summary: text });
			await loadWeekBundle();
		} catch {
			/* noop */
		}
	};

	const handleSubmitMonthly = async () => {
		if (savingMonthly || monthLoading) return;
		if (!hasHireDate || reportsBlockedNoHireDate) {
			Notify.toastError(NO_HIRE_DATE_MESSAGE);
			return;
		}
		const text = monthSummaryDraft.trim();
		if (!text) {
			Notify.toastError('월간 요약을 입력해 주세요.');
			return;
		}
		try {
			await saveMonthlyReq({ month_start_date: monthStartYmd, summary: text });
			await loadMonthBundle();
		} catch {
			/* noop */
		}
	};

	const shiftMonth = (dir) => setViewMonth((prev) => addMonths(prev, dir));
	const shiftWeek = (dir) => setWeekAnchor((prev) => addDays(prev, dir * 7));
	const pageBusy =
		dailyLoading ||
		weekLoading ||
		monthLoading ||
		savingDaily ||
		savingWeekly ||
		savingMonthly ||
		dailyDrawerPreflight;

	const weekReadonlyBlocks = useMemo(() => {
		const start = normalizeToMidnight(new Date(weekStartYmd + 'T00:00:00'));
		const lines = [];
		for (let i = 0; i < 7; i += 1) {
			const d = addDays(start, i);
			const ymd = toYmd(d);
			const hit = weekDailies.find((x) => x.report_date === ymd);
			const hasDailyReport = Boolean(hit);
			const clockCtx = weekClockContexts[ymd] ?? null;
			const isVacationDay = isVacationContext(clockCtx);
			const isWeekend = d.getDay() === 0 || d.getDay() === 6;
			const isPublicHoliday = holidayDates.has(ymd) || clockCtx?.is_public_holiday;
			const holidayLabel = holidayNames[ymd] || clockCtx?.holiday_name || '공휴일';
			const skipIfEmpty = isWeekend;
			if (!hasDailyReport && skipIfEmpty) {
				continue;
			}
			const dateTone = isVacationDay ? 'holiday' : getDateTone(ymd, holidayDates);
			lines.push({
				ymd,
				label: `${ymd.slice(5).replace('-', '/')} ${formatYmdToWeekKo(ymd)}`,
				text: hit?.content
					? String(hit.content)
					: isVacationDay
						? '— 휴가 —'
						: isPublicHoliday
							? `— ${holidayLabel} —`
							: '— 등록된 일일 보고가 없습니다 —',
				dateTone,
				isVacationDay,
				isPublicHoliday,
				holidayLabel,
				beforeJoin:
					!authLoading && hasHireDate && isYmdStrictlyBeforeJoinDate(ymd, hireDate),
			});
		}
		return lines;
	}, [weekStartYmd, weekDailies, authLoading, hasHireDate, hireDate, holidayDates, holidayNames, weekClockContexts]);

	const monthReadonlyBlocks = useMemo(() => {
		const lines = [];
		for (const ymd of enumerateYmdInclusive(dateFrom, dateTo)) {
			const hit = monthDailies.find((x) => x.report_date === ymd);
			const clockCtx = monthClockContexts[ymd] ?? null;
			const isVacationDay = isVacationContext(clockCtx);
			const isPublicHoliday = holidayDates.has(ymd) || clockCtx?.is_public_holiday;
			const holidayLabel = holidayNames[ymd] || clockCtx?.holiday_name || '공휴일';
			const dateTone = isVacationDay ? 'holiday' : getDateTone(ymd, holidayDates);
			const beforeJoin =
				!authLoading && hasHireDate && isYmdStrictlyBeforeJoinDate(ymd, hireDate);
			lines.push({
				ymd,
				label: `${ymd.slice(5).replace('-', '/')} ${formatYmdToWeekKo(ymd)}`,
				text: hit?.content
					? String(hit.content)
					: isVacationDay
						? '— 휴가 —'
						: isPublicHoliday
							? `— ${holidayLabel} —`
							: '— 등록된 일일 보고가 없습니다 —',
				dateTone,
				isVacationDay,
				isPublicHoliday,
				holidayLabel,
				beforeJoin,
			});
		}
		return lines;
	}, [
		dateFrom,
		dateTo,
		monthDailies,
		authLoading,
		hasHireDate,
		hireDate,
		holidayDates,
		holidayNames,
		monthClockContexts,
	]);

	useEffect(() => {
		return () => {
			closeDailyDrawer();
			closeConfirmModal();
		};
	}, [closeDailyDrawer, closeConfirmModal]);

	return (
		<div className="rep-page rep-page--wide rep-page--my-reports">
			<div className="rep-my-reports-head">
				<h1 className="rep-page__title">내 보고서</h1>
				<p className="rep-page__sub">
					일일 업무 내역과 주간·월간 요약을 등록합니다. (캘린더 일정과는 별도입니다.)
				</p>

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

				{!reportsBlockedNoHireDate && (mainTab === 'daily' || mainTab === 'monthly') ? (
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
				) : null}

				{!reportsBlockedNoHireDate && mainTab === 'weekly' ? (
					<div className="rep-toolbar">
						<span className="rep-label">주간: {weekLabel(startOfWeekSunday(weekAnchor))}</span>
						<div>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftWeek(-1)}>
								이전 주
							</button>
							<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => shiftWeek(1)}>
								다음 주
							</button>
						</div>
					</div>
				) : null}
			</div>

			<div className="rep-my-reports-body rep-my-reports-body--scroll">
				{reportsBlockedNoHireDate ? (
					<div className="rep-empty-state" role="alert">
						<p className="rep-empty-state__title">보고서 작성 불가</p>
						<p className="rep-empty-state__message">{NO_HIRE_DATE_MESSAGE}</p>
					</div>
				) : null}

				{!reportsBlockedNoHireDate && mainTab === 'daily' && (
					<>
						{authLoading ? (
							<p className="rep-empty">로그인·입사일 정보를 불러오는 중입니다…</p>
						) : dailyLoading ? (
							<p className="rep-empty">불러오는 중…</p>
						) : (
							<div className="rep-list" ref={dailyListRef}>
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
								const isVacationDay = isVacationContext(dailyClockContexts[ymd]);
								const dateTone = isVacationDay ? 'holiday' : getDateTone(ymd, holidayDates);
								return (
									<button
										key={ymd}
										type="button"
										data-rep-daily-ymd={ymd}
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
											<div className={`rep-list-item__date${dateTone ? ` rep-date-color--${dateTone}` : ''}`}>{ymd}</div>
											<div className={`rep-list-item__meta${dateTone ? ` rep-date-color--${dateTone}` : ''}`}>
												{formatYmdToWeekKo(ymd)}
												{isVacationDay ? ' 휴가' : ''}
											</div>
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
											<div className={`rep-daily-row__title${b.dateTone ? ` rep-date-color--${b.dateTone}` : ''}`}>{b.label}</div>
											<div className={`rep-daily-row__body${(b.isVacationDay && b.text === '— 휴가 —') || (b.isPublicHoliday && b.text === `— ${b.holidayLabel} —`) ? ' rep-date-color--holiday' : ''}`}>
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

				{!reportsBlockedNoHireDate && mainTab === 'monthly' && (
					<>
						{monthLoading ? (
							<p className="rep-empty">불러오는 중…</p>
						) : (
							<div className="rep-split rep-split--monthly">
								<div className="rep-split__col rep-split__col--readonly">
									<h3 className="rep-split__col-title">이번 달 일일 보고 (읽기 전용)</h3>
									<div className="rep-readonly-block">
										{monthReadonlyBlocks.map((b) => (
											<div
												key={b.ymd}
												className={`rep-daily-row${b.beforeJoin ? ' rep-daily-row--before-join' : ''}`}
											>
												<div
													className={`rep-daily-row__title${b.dateTone ? ` rep-date-color--${b.dateTone}` : ''}`}
												>
													{b.label}
												</div>
												<div
													className={`rep-daily-row__body${
														(b.isVacationDay && b.text === '— 휴가 —') ||
														(b.isPublicHoliday && b.text === `— ${b.holidayLabel} —`)
															? ' rep-date-color--holiday'
															: ''
													}`}
												>
													{b.beforeJoin ? '입사일 이전 날짜입니다.' : b.text}
												</div>
											</div>
										))}
									</div>
								</div>
								<div className="rep-split__col rep-split__col--monthly-form">
									<h3 className="rep-split__col-title">월간 요약 · 제출</h3>
									<textarea
										className="rep-textarea rep-textarea--monthly"
										value={monthSummaryDraft}
										disabled={savingMonthly}
										onChange={(e) => setMonthSummaryDraft(e.target.value)}
										placeholder="해당 월 업무를 요약해 주세요. (일일·주간 보고를 바탕으로 정리)"
									/>
									<button
										type="button"
										className="rep-btn-primary"
										disabled={savingMonthly}
										onClick={handleSubmitMonthly}
									>
										{savingMonthly ? '저장 중…' : '월간 보고 저장'}
									</button>
								</div>
							</div>
						)}
					</>
				)}
			</div>

			<SideDrawer
				open={drawerOpen && hasHireDate && !reportsBlockedNoHireDate}
				onClose={requestCloseDailyDrawer}
				overlayClassName="rep-drawer-overlay"
				panelClassName="rep-drawer-panel dynamic-enter"
			>
				<div className="rep-drawer-head">
					<h2 className="rep-drawer-title">일일 보고 — {drawerDate}</h2>
					<button type="button" className="rep-drawer-close" onClick={requestCloseDailyDrawer} aria-label="닫기">
						×
					</button>
				</div>
				<div className="rep-drawer-body">
					{canShowAttendanceReference(drawerAttendance) ? (
						<div className="rep-drawer-attendance-ref" role="region" aria-label="출퇴근 참고">
							<div className="rep-drawer-attendance-ref__head">
								<span className="rep-drawer-attendance-ref__badge">출퇴근 기록 (참고)</span>
								{drawerAttendanceSessions.some(
									(s) =>
										normalizeStatus(s?.status).includes('LATE') ||
										normalizeStatus(s?.status).includes('지각')
								) ? (
									<span className="rep-drawer-attendance-ref__hint">지각 처리된 날일 수 있습니다.</span>
								) : null}
							</div>
							{drawerAttendance?.summary ? (
								<div className="rep-drawer-attendance-ref__summary">
									<span>
										합계 근무 {drawerAttendance.summary.total_work_minutes ?? 0}분 · 야간{' '}
										{drawerAttendance.summary.total_night_minutes ?? 0}분 · 연장{' '}
										{drawerAttendance.summary.overtime_minutes ?? 0}분
									</span>
								</div>
							) : null}
							<dl className="rep-drawer-attendance-ref__times">
								{drawerAttendanceSessions.map((s, idx) => (
									<div key={s.id ?? idx} className="rep-drawer-attendance-ref__session">
										{drawerAttendanceSessions.length > 1 ? (
											<div className="rep-drawer-attendance-ref__session-label">세션 {idx + 1}</div>
										) : null}
										<div className="rep-drawer-attendance-ref__row">
											<dt>출근</dt>
											<dd>{formatDt(s.clock_in_time)}</dd>
										</div>
										<div className="rep-drawer-attendance-ref__row">
											<dt>퇴근</dt>
											<dd>{formatDt(s.clock_out_time)}</dd>
										</div>
										{s.night_work_minutes > 0 ? (
											<div className="rep-drawer-attendance-ref__row">
												<dt>야간</dt>
												<dd>{s.night_work_minutes}분</dd>
											</div>
										) : null}
									</div>
								))}
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
					<button
						type="button"
						className="rep-btn-primary"
						disabled={savingDaily}
						onClick={() => void handleSaveDrawer()}
					>
						{savingDaily ? '저장 중…' : '저장'}
					</button>
				</div>
			</SideDrawer>

			<AppModal isOpen={confirmOpen} onClose={closeConfirmModal} contentClassName="rep-confirm-modal">
				<h3 className="rep-confirm-modal__title">출근 기록 확인</h3>
				<p className="rep-confirm-modal__message">{confirmMessage}</p>
				<div className="rep-confirm-modal__actions">
					<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={closeConfirmModal}>
						취소
					</button>
					<button type="button" className="rep-btn-primary" disabled={pageBusy} onClick={proceedConfirmOpen}>
						진행
					</button>
				</div>
			</AppModal>

			<AppModal
				isOpen={Boolean(dailyUnsavedModal)}
				onClose={() => setDailyUnsavedModal(null)}
				contentClassName="rep-confirm-modal"
			>
				<h3 className="rep-confirm-modal__title">저장되지 않은 내용</h3>
				<p className="rep-confirm-modal__message">
					{dailyUnsavedModal?.intent === 'openOther'
						? '입력 중인 일일 보고가 있습니다. 다른 날짜로 이동하면 지금 입력한 내용이 사라집니다.'
						: '입력 중인 일일 보고가 있습니다. 창을 닫으면 지금 입력한 내용이 사라집니다.'}
				</p>
				<div className="rep-confirm-modal__actions rep-confirm-modal__actions--stack">
					<button type="button" className="rep-btn-primary" disabled={pageBusy} onClick={() => void handleSaveDrawer(
						dailyUnsavedModal?.intent === 'openOther' && dailyUnsavedModal.pendingYmd
							? { afterSuccess: { kind: 'openOther', ymd: dailyUnsavedModal.pendingYmd } }
							: undefined
					)}>
						저장
					</button>
					<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={discardDailyDraftAndProceed}>
						저장하지 않고 {dailyUnsavedModal?.intent === 'openOther' ? '이동' : '닫기'}
					</button>
					<button type="button" className="rep-nav-btn" disabled={pageBusy} onClick={() => setDailyUnsavedModal(null)}>
						취소
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
