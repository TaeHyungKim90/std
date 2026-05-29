import 'assets/css/attendance.css';

import { adminApi } from 'api/adminApi';
import SideDrawer from 'components/common/SideDrawer';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	addDays,
	addMonths,
	formatWorkMinutes,
	formatYmdToMd,
	formatYmdToWeekKo,
	getIsoMonthAndWeek,
	isWeekendYmd,
	normalizeStatus,
	normalizeToMidnight,
	pad2,
	splitYmdHm,
	startOfWeekMonday,
	toDatetimeLocalInputValue,
	toYmd,
} from 'utils/dateUtils';
import * as Notify from 'utils/toastUtils';

const STATUS_OPTIONS = [
	{ value: 'NORMAL', label: '정상출근' },
	{ value: 'LATE', label: '지각' },
	{ value: 'ABSENT', label: '결근' },
	{ value: 'VACATION', label: '휴가' },
	{ value: 'SICK', label: '병가' },
];

/** 출근·퇴근 셀: 날짜 / 시간 2줄 */
const UtaDateTimeCell = ({ iso }) => {
	const p = splitYmdHm(iso);
	if (!p) {
		return <span className="uta-datetime-stack uta-datetime-stack--empty">—</span>;
	}
	return (
		<span className="uta-datetime-stack">
			<span className="uta-datetime-stack__date">{p.date}</span>
			<span className="uta-datetime-stack__time">{p.time}</span>
		</span>
	);
};

const fmtCaptionTs = (iso) => {
	const p = splitYmdHm(iso);
	return p ? `${p.date} ${p.time}` : '—';
};

/** 출퇴근 시각 없을 때 수정 입력 기본값: 해당 근무일 + 기본 시각 */
const defaultDatetimeLocalForWorkDate = (workDateYmd, kind) => {
	const ymd = String(workDateYmd || '').slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
	if (kind === 'out') return `${ymd}T18:00`;
	return `${ymd}T09:00`;
};

const datetimeLocalForEdit = (iso, workDateYmd, kind) => {
	const existing = toDatetimeLocalInputValue(iso);
	if (existing) return existing;
	return defaultDatetimeLocalForWorkDate(workDateYmd, kind);
};

/** API work_date → YYYY-MM-DD */
const workDateToYmd = (v) => {
	if (v == null || v === '') return '';
	const s = typeof v === 'string' ? v : String(v);
	return s.length >= 10 ? s.slice(0, 10) : s;
};

const getStatusBadge = (status) => {
	const st = normalizeStatus(status);
	if (!st) return { className: 'badge-red', label: '—' };

	// 정상출근
	if (st.includes('NORMAL')) return { className: 'badge-normal', label: '정상출근' };

	// 휴일
	if (st.includes('HOLIDAY') || st.includes('휴일') || st.includes('공휴')) {
		return { className: 'badge-holiday', label: '휴일' };
	}

	// 휴가/연차
	if (
		st.includes('VACATION') ||
		st.includes('LEAVE') ||
		st.includes('ANNUAL') ||
		st.includes('휴가') ||
		st.includes('연차')
	) {
		return { className: 'badge-vacation', label: '휴가' };
	}

	// 병가도 같은 파란색 톤으로 처리(데이터 범위 확장 대비)
	if (st.includes('SICK') || st.includes('병가')) {
		return { className: 'badge-vacation', label: '휴가' };
	}

	// 미출근/지각
	if (st.includes('LATE') || st.includes('MISSED') || st.includes('지각')) {
		return { className: 'badge-missed', label: '미출근' };
	}

	// 결근
	if (st.includes('ABSENT') || st.includes('결근')) {
		return { className: 'badge-absent', label: '결근' };
	}

	if (st.includes('MISSING') || st.includes('소명')) {
		return { className: 'badge-missed', label: '기록 누락(소명 요망)' };
	}

	// 기본: 안전하게 빨간 배지
	return { className: 'badge-red', label: status };
};

/** @param {string | undefined | null} status */
const classifyAttendanceSummaryBucket = (status) => {
	const st = normalizeStatus(status);
	if (!st) return null;

	if (st.includes('NORMAL')) return 'normal';

	if (st.includes('HOLIDAY') || st.includes('휴일') || st.includes('공휴')) return null;

	if (
		st.includes('VACATION') ||
		st.includes('LEAVE') ||
		st.includes('ANNUAL') ||
		st.includes('휴가') ||
		st.includes('연차')
	) {
		return 'vacation';
	}

	if (st.includes('SICK') || st.includes('병가')) return 'vacation';

	if (st.includes('LATE') || st.includes('MISSED') || st.includes('지각')) return 'late';

	if (st.includes('ABSENT') || st.includes('결근')) return 'absent';

	if (st.includes('MISSING') || st.includes('소명')) return 'pending';

	return null;
};

/**
 * @param {{ userId: string; userName?: string; onClose: () => void }} props
 */
const UserAttendanceDrawer = ({ userId, userName, onClose }) => {
	const [baseDate, setBaseDate] = useState(() => new Date());
	const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'

	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [draft, setDraft] = useState({ clock_in_time: '', clock_out_time: '', status: 'NORMAL' });
	const [savingId, setSavingId] = useState(null);

	const range = useMemo(() => {
		if (viewMode === 'month') {
			const b = normalizeToMidnight(baseDate);
			const start = new Date(b.getFullYear(), b.getMonth(), 1);
			const end = new Date(b.getFullYear(), b.getMonth() + 1, 0);
			return {
				startDate: toYmd(start),
				endDate: toYmd(end),
				navLabel: `${b.getFullYear()}년 ${b.getMonth() + 1}월`,
			};
		}

		const weekStart = startOfWeekMonday(baseDate);
		const weekEnd = addDays(weekStart, 6);
		const { month, weekIndex } = getIsoMonthAndWeek(baseDate);

		const labelStart = `${pad2(weekStart.getMonth() + 1)}.${pad2(weekStart.getDate())}`;
		const labelEnd = `${pad2(weekEnd.getMonth() + 1)}.${pad2(weekEnd.getDate())}`;

		return {
			startDate: toYmd(weekStart),
			endDate: toYmd(weekEnd),
			navLabel: `${month}월 ${weekIndex}주차 (${labelStart} ~ ${labelEnd})`,
		};
	}, [baseDate, viewMode]);

	const statusSummary = useMemo(() => {
		const counts = { normal: 0, late: 0, absent: 0, vacation: 0, pending: 0 };
		if (!Array.isArray(items)) return counts;
		for (const row of items) {
			const bucket = classifyAttendanceSummaryBucket(row?.status);
			if (bucket) counts[bucket] += 1;
		}
		return counts;
	}, [items]);

	const loadRange = useCallback(async () => {
		if (!userId) return;
		if (!range.startDate || !range.endDate) return;

		setLoading(true);
		try {
			const res = await adminApi.getUserAttendanceRange(userId, range.startDate, range.endDate);
			const list = Array.isArray(res.data?.items) ? res.data.items : [];
			setItems(list);
		} catch (err) {
			Notify.toastApiFailure(err, '근태 목록을 불러오지 못했습니다.');
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [userId, range.startDate, range.endDate]);

	useEffect(() => {
		setEditingId(null);
		loadRange();
	}, [loadRange]);

	const openEdit = (row) => {
		setEditingId(row.id);
		setDraft({
			clock_in_time: datetimeLocalForEdit(row.clock_in_time, row.work_date, 'in'),
			clock_out_time: datetimeLocalForEdit(row.clock_out_time, row.work_date, 'out'),
			status: row.status || 'NORMAL',
		});
	};

	const cancelEdit = () => setEditingId(null);

	const saveRow = async (row) => {
		setSavingId(row.id);
		try {
			const cin = String(draft.clock_in_time || '').trim();
			const cout = String(draft.clock_out_time || '').trim();
			const payload = {
				clock_in_time: cin || null,
				clock_out_time: cout || null,
				status: draft.status,
			};
			const isVirtualAbsent =
				typeof row.id === 'number' &&
				row.id < 0 &&
				String(row.status || '').toUpperCase().includes('ABSENT');
			if (isVirtualAbsent) {
				await adminApi.createAttendance({
					user_login_id: userId,
					work_date: workDateToYmd(row.work_date),
					...payload,
				});
			} else {
				await adminApi.updateAttendance(row.id, payload);
			}
			Notify.toastSuccess('저장되었습니다.');
			setEditingId(null);
			await loadRange();
		} catch (err) {
			Notify.toastApiFailure(err, '저장에 실패했습니다.');
		} finally {
			setSavingId(null);
		}
	};

	const shift = (dir) => {
		if (viewMode === 'month') {
			setBaseDate((prev) => addMonths(prev, dir * 1));
		} else {
			setBaseDate((prev) => addDays(prev, dir * 7));
		}
	};

	if (!userId) return null;

	return (
		<SideDrawer
			open
			onClose={onClose}
			overlayClassName="uta-drawer-overlay"
			panelClassName="uta-drawer-panel dynamic-enter"
		>
				<div className="uta-header-top">
					<div className="uta-title-block">
						<div className="uta-title-row">
							<div className="uta-title">{userName ? userName : userId}</div>
							{!loading ? (
								<div
									className="uta-header-summary"
									role="status"
									aria-label={`이번 기간 근태 요약: 정상 ${statusSummary.normal}, 지각 ${statusSummary.late}, 결근 ${statusSummary.absent}, 휴가 ${statusSummary.vacation}, 소명요망 ${statusSummary.pending}`}
								>
									{[
										{ key: 'normal', label: '정상', count: statusSummary.normal, mod: 'uta-summary-normal' },
										{ key: 'late', label: '지각', count: statusSummary.late, mod: 'uta-summary-late' },
										{ key: 'absent', label: '결근', count: statusSummary.absent, mod: 'uta-summary-absent' },
										{ key: 'vacation', label: '휴가', count: statusSummary.vacation, mod: 'uta-summary-vacation' },
										{ key: 'pending', label: '소명', count: statusSummary.pending, mod: 'uta-summary-late' },
									].map((b, i) => (
										<span
											key={b.key}
											className={`uta-summary-badge ${b.mod}`}
											style={{ animationDelay: `${0.06 + i * 0.045}s` }}
										>
											{b.label} {b.count}
										</span>
									))}
								</div>
							) : null}
						</div>
						<div className="uta-subtitle">
							근태 상세
						</div>
					</div>

					<button type="button" onClick={onClose} className="uta-close-btn">
						✕
					</button>
				</div>

				<div className="uta-header-nav">
					<div className="uta-nav-row">
						<select
							className="uta-view-select"
							value={viewMode}
							onChange={(e) => setViewMode(e.target.value)}
							aria-label="주간/월간 선택"
						>
							<option value="week">주간</option>
							<option value="month">월간</option>
						</select>

						<button type="button" className="uta-nav-btn" onClick={() => shift(-1)} aria-label="이전">
							&lt;
						</button>

						<div className="uta-period-text">
							{range.startDate} ~ {range.endDate}
						</div>

						<button type="button" className="uta-nav-btn" onClick={() => shift(1)} aria-label="다음">
							&gt;
						</button>
					</div>
					<div className="uta-nav-helper">{range.navLabel}</div>
				</div>

				<div className="uta-table-wrap">
					{loading ? (
						<div className="uta-empty uta-loading">불러오는 중…</div>
					) : items.length === 0 ? (
						<div className="uta-empty">선택한 기간에 등록된 근태 기록이 없습니다.</div>
					) : (
						<table className="uta-table">
							<colgroup>
								<col className="uta-col-date" />
								<col className="uta-col-dow" />
								<col className="uta-col-schedule" />
								<col className="uta-col-time" />
								<col className="uta-col-time" />
								<col className="uta-col-status" />
								<col className="uta-col-work" />
								<col className="uta-col-manage" />
							</colgroup>
							<thead>
								<tr>
									<th>일자</th>
									<th>요일</th>
									<th>휴가·일정</th>
									<th>출근시간</th>
									<th>퇴근시간</th>
									<th>상태</th>
									<th>근무시간</th>
									<th>관리</th>
								</tr>
							</thead>
							<tbody>
								{items.map((row, index) => {
									const weekend = isWeekendYmd(row.work_date);
									const holiday = row.is_public_holiday;
									const badge = getStatusBadge(row.status);
									const isSynthetic = typeof row.id === 'number' && row.id < 0;
									const isSyntheticMissing = isSynthetic && row.status === 'MISSING_EXPLANATION';
									const scheduleLine = [
										row.vacation_todo_summary,
										holiday ? row.holiday_name || '공휴일' : null,
									]
										.filter(Boolean)
										.join(' · ');
									const reviewLabels = {
										HALF_DAY_NO_ATTENDANCE: '반차일·출퇴근 없음',
										HALF_DAY_OK: '반차 구간 대체로 일치',
										HALF_DAY_NEEDS_REVIEW: '반차·시각 검토',
										HALF_DAY_BOTH_NO_ATTENDANCE: '전일반차·출퇴근 없음',
										HALF_DAY_BOTH_NEEDS_REVIEW: '전일반차·시각 수동 검토',
									};

									const vacationClockCaption = () => {
										const s = row.vacation_todo_summary;
										if (!s) return null;
										const cin = row.clock_in_time;
										const cout = row.clock_out_time;
										if (cin && cout) {
											return `[${s}] ${fmtCaptionTs(cin)} 출근 · ${fmtCaptionTs(cout)} 퇴근`;
										}
										if (cin) {
											return `[${s}] ${fmtCaptionTs(cin)} 출근`;
										}
										return `[${s}]`;
									};
									const vacCap = vacationClockCaption();

									const isEditingRow = editingId === row.id;

									return (
										<tr
											key={row.id}
											className={`stagger-item${weekend || holiday ? ' uta-tr-weekend' : ''}${
												isEditingRow ? ' uta-tr--editing' : ''
											}`}
											style={{ animationDelay: `${index * 0.04}s` }}
										>
											<td className="uta-td-date">{formatYmdToMd(row.work_date)}</td>
											<td className="uta-td-dow">{formatYmdToWeekKo(row.work_date)}</td>
											<td className="uta-td-schedule">
												{scheduleLine ? (
													<span className="uta-schedule-text">{scheduleLine}</span>
												) : (
													<span className="uta-schedule-empty">—</span>
												)}
												{row.review_hint && reviewLabels[row.review_hint] ? (
													<div className="uta-review-hint">{reviewLabels[row.review_hint]}</div>
												) : null}
											</td>

											<td className="uta-td-time">
												{isEditingRow ? (
													<div className="uta-datetime-edit">
														<label className="uta-sr-only" htmlFor={`uta-cin-${row.id}`}>
															출근 일시
														</label>
														<input
															id={`uta-cin-${row.id}`}
															type="datetime-local"
															step={60}
															value={draft.clock_in_time}
															onChange={(e) =>
																setDraft((d) => ({ ...d, clock_in_time: e.target.value }))
															}
															className="uta-datetime-local-input"
														/>
													</div>
												) : (
													<span className="uta-time-cell">
														<UtaDateTimeCell iso={row.clock_in_time} />
														{vacCap ? <div className="uta-vacation-caption">{vacCap}</div> : null}
													</span>
												)}
											</td>

											<td className="uta-td-time">
												{isEditingRow ? (
													<div className="uta-datetime-edit">
														<label className="uta-sr-only" htmlFor={`uta-cout-${row.id}`}>
															퇴근 일시
														</label>
														<input
															id={`uta-cout-${row.id}`}
															type="datetime-local"
															step={60}
															value={draft.clock_out_time}
															onChange={(e) =>
																setDraft((d) => ({ ...d, clock_out_time: e.target.value }))
															}
															className="uta-datetime-local-input"
														/>
													</div>
												) : (
													<span className="uta-time-cell">
														<UtaDateTimeCell iso={row.clock_out_time} />
													</span>
												)}
											</td>

											<td className="uta-td-status">
												{isEditingRow ? (
													<select
														value={draft.status}
														onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
														className="uta-status-select"
													>
														{STATUS_OPTIONS.map((o) => (
															<option key={o.value} value={o.value}>
																{o.label}
															</option>
														))}
													</select>
												) : (
													<span className={`status-badge ${badge.className}`}>{badge.label}</span>
												)}
											</td>

											<td className="uta-td-workminutes">{formatWorkMinutes(row.work_minutes)}</td>

											<td className="uta-td-manage">
												{isSyntheticMissing ? (
													<span className="rep-empty rep-empty--table">소명 요망</span>
												) : isEditingRow ? (
													<div className="uta-edit-actions">
														<button
															type="button"
															disabled={savingId === row.id}
															onClick={() => saveRow(row)}
															className="uta-btn-save"
														>
															{savingId === row.id ? '저장…' : '저장'}
														</button>
														<button type="button" onClick={cancelEdit} className="uta-btn-cancel">
															취소
														</button>
													</div>
												) : (
													<button type="button" onClick={() => openEdit(row)} className="uta-btn-edit">
														수정
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</div>
		</SideDrawer>
	);
};

export default UserAttendanceDrawer;

