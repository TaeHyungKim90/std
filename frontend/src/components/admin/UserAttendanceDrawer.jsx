import React, { useCallback, useEffect, useMemo, useState } from 'react';
import 'assets/css/attendance.css';
import * as Notify from 'utils/toastUtils';
import { adminApi } from 'api/adminApi';
import {
	addDays,
	addMonths,
	formatDt,
	formatWorkMinutes,
	formatYmdToMd,
	formatYmdToWeekKo,
	getIsoMonthAndWeek,
	isWeekendYmd,
	normalizeStatus,
	normalizeToMidnight,
	pad2,
	startOfWeekMonday,
	toTimeInputValue,
	toYmd,
} from 'utils/dateUtils';

const STATUS_OPTIONS = [
	{ value: 'NORMAL', label: '정상출근' },
	{ value: 'LATE', label: '지각' },
	{ value: 'ABSENT', label: '결근' },
	{ value: 'VACATION', label: '휴가' },
	{ value: 'SICK', label: '병가' },
];

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
		const counts = { normal: 0, late: 0, absent: 0, vacation: 0 };
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
			console.error(err);
			Notify.toastError(err.message || '근태 목록을 불러오지 못했습니다.');
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
			clock_in_time: toTimeInputValue(row.clock_in_time),
			clock_out_time: toTimeInputValue(row.clock_out_time),
			status: row.status || 'NORMAL',
		});
	};

	const cancelEdit = () => setEditingId(null);

	const saveRow = async (recordId) => {
		setSavingId(recordId);
		try {
			const payload = {
				clock_in_time: draft.clock_in_time || null,
				clock_out_time: draft.clock_out_time || null,
				status: draft.status,
			};
			await adminApi.updateAttendance(recordId, payload);
			Notify.toastSuccess('저장되었습니다.');
			setEditingId(null);
			await loadRange();
		} catch (err) {
			console.error(err);
			Notify.toastError(err.message || '저장에 실패했습니다.');
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
		<>
			<button type="button" aria-label="닫기" onClick={onClose} className="uta-drawer-overlay" />

			<aside role="dialog" aria-modal="true" className="uta-drawer-panel dynamic-enter">
				<div className="uta-header-top">
					<div className="uta-title-block">
						<div className="uta-title-row">
							<div className="uta-title">{userName ? userName : userId}</div>
							{!loading ? (
								<div
									className="uta-header-summary"
									role="status"
									aria-label={`이번 기간 근태 요약: 정상 ${statusSummary.normal}, 지각 ${statusSummary.late}, 결근 ${statusSummary.absent}, 휴가 ${statusSummary.vacation}`}
								>
									{[
										{ key: 'normal', label: '정상', count: statusSummary.normal, mod: 'uta-summary-normal' },
										{ key: 'late', label: '지각', count: statusSummary.late, mod: 'uta-summary-late' },
										{ key: 'absent', label: '결근', count: statusSummary.absent, mod: 'uta-summary-absent' },
										{ key: 'vacation', label: '휴가', count: statusSummary.vacation, mod: 'uta-summary-vacation' },
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
							<thead>
								<tr>
									<th>일자</th>
									<th>요일</th>
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
									const badge = getStatusBadge(row.status);

									return (
										<tr
											key={row.id}
											className={`stagger-item${weekend ? ' uta-tr-weekend' : ''}`}
											style={{ animationDelay: `${index * 0.04}s` }}
										>
											<td className="uta-td-date">{formatYmdToMd(row.work_date)}</td>
											<td className="uta-td-dow">{formatYmdToWeekKo(row.work_date)}</td>

											<td className="uta-td-time">
												{editingId === row.id ? (
													<input
														type="time"
														value={draft.clock_in_time}
														onChange={(e) => setDraft((d) => ({ ...d, clock_in_time: e.target.value }))}
														className="uta-time-input"
													/>
												) : (
													<span className="uta-time-text">{formatDt(row.clock_in_time)}</span>
												)}
											</td>

											<td className="uta-td-time">
												{editingId === row.id ? (
													<input
														type="time"
														value={draft.clock_out_time}
														onChange={(e) => setDraft((d) => ({ ...d, clock_out_time: e.target.value }))}
														className="uta-time-input"
													/>
												) : (
													<span className="uta-time-text">{formatDt(row.clock_out_time)}</span>
												)}
											</td>

											<td className="uta-td-status">
												{editingId === row.id ? (
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
												{editingId === row.id ? (
													<div className="uta-edit-actions">
														<button
															type="button"
															disabled={savingId === row.id}
															onClick={() => saveRow(row.id)}
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
			</aside>
		</>
	);
};

export default UserAttendanceDrawer;

