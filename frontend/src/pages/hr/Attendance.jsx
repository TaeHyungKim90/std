import 'assets/css/attendance.css';

import { attendanceApi } from 'api/attendanceApi';
import { useAuth } from 'context/AuthContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	resolvePreferredAgainstOptions,
	writePreferredWorkLocation,
} from 'utils/attendanceLocationPreference';
import { formatLocalTimeHms, formatTimeHms } from 'utils/dateUtils';
import * as Notify from 'utils/toastUtils';

const ACTION_DEBOUNCE_MS = 800;

/** 기본 근무장소: 시드 `location_key=company` (없으면 목록 첫 항목). */
const DEFAULT_WORK_LOCATION_KEY = 'company';

/** 브라우저 로컬 달력 기준 YYYY-MM-DD (야근 시 근무일 배너용) */
function formatLocalCalendarYmd(d) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

const AttendanceView = () => {
	const { joinDate, loading: authLoading, userId, refreshAuth } = useAuth();
	const [todayRecord, setTodayRecord] = useState(null);
	const [daySessions, setDaySessions] = useState([]);
	const [daySummary, setDaySummary] = useState(null);
	const [clockCtx, setClockCtx] = useState(null);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [workLocationKey, setWorkLocationKey] = useState('');
	const [locationOptions, setLocationOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const lastActionAtRef = useRef(0);
	/** 서버·셀렉트와 무관하게 최신 key→표시명 (확인창은 state보다 먼저 갱신되도록 ref 사용) */
	const workLocationKeyToLabelRef = useRef(new Map());

	const getWorkLocationDisplayLabel = useCallback((keyOrLegacy) => {
		const k = String(keyOrLegacy || '').trim();
		if (!k) return '';
		const fromRef = workLocationKeyToLabelRef.current.get(k);
		if (fromRef) return fromRef;
		const byKey = locationOptions.find((o) => o.value === k);
		if (byKey) return byKey.label;
		const byLabel = locationOptions.find((o) => o.label === k);
		if (byLabel) return byLabel.label;
		return k;
	}, [locationOptions]);

	const fetchTodayStatus = useCallback(async () => {
		setLoading(true);
		try {
			const workLocationReq = attendanceApi.getWorkLocations().catch((err) => {
				console.error('근무장소 목록 로드 실패', err);
				Notify.toastApiFailure(err, '근무장소 목록을 불러오지 못했습니다.');
				return null;
			});
			const [attRes, ctxRes, workLocationRes] = await Promise.all([
				attendanceApi.getTodayAttendance(),
				attendanceApi.getClockContext(),
				workLocationReq,
			]);
			setTodayRecord(attRes.data);
			const wd = attRes.data?.work_date || formatLocalCalendarYmd(new Date());
			try {
				const sRes = await attendanceApi.getAttendanceDaySessions(wd);
				setDaySessions(Array.isArray(sRes.data?.items) ? sRes.data.items : []);
				setDaySummary(sRes.data?.summary ?? null);
			} catch (sessErr) {
				console.error('당일 세션 로드 실패', sessErr);
				setDaySessions([]);
				setDaySummary(null);
			}
			setClockCtx(ctxRes.data);
			const activeLocations = Array.isArray(workLocationRes?.data)
				? workLocationRes.data.filter((row) => row?.is_active !== false && row?.location_value)
				: [];
			const keyToLabel = new Map();
			for (const row of activeLocations) {
				const lk = String(row.location_key || '').trim();
				const lv = String(row.location_value || '').trim();
				if (lk && lv) keyToLabel.set(lk, lv);
			}
			workLocationKeyToLabelRef.current = keyToLabel;

			const labelToKey = Object.fromEntries(
				activeLocations.map((row) => [String(row.location_value).trim(), String(row.location_key).trim()]),
			);
			const savedRaw = String(attRes.data?.clock_in_location || '').trim();
			const matchSaved = activeLocations.find(
				(row) =>
					String(row.location_key || '').trim() === savedRaw ||
					String(row.location_value || '').trim() === savedRaw,
			);
			const savedLocationKey = matchSaved ? String(matchSaved.location_key).trim() : savedRaw;
			const nextOptions = activeLocations.map((row) => ({
				label: row.location_value,
				value: String(row.location_key).trim(),
			}));
			if (
				savedLocationKey &&
				!nextOptions.some((opt) => opt.value === savedLocationKey || opt.label === savedLocationKey)
			) {
				const orphanLabel =
					keyToLabel.get(savedLocationKey) ||
					(matchSaved ? String(matchSaved.location_value || '').trim() : '') ||
					String(savedRaw || '').trim() ||
					savedLocationKey;
				nextOptions.unshift({ label: orphanLabel, value: savedLocationKey });
			}
			setLocationOptions(nextOptions);
			const optionKeys = nextOptions.map((o) => o.value);
			const ctxData = ctxRes.data || {};
			const serverPreferred = (ctxData.preferred_work_location || '').trim();
			const fromServerPreferred =
				!savedLocationKey && serverPreferred && nextOptions.some((opt) => opt.value === serverPreferred)
					? serverPreferred
					: null;
			const fromLocalPreference =
				!savedLocationKey && !fromServerPreferred && userId
					? resolvePreferredAgainstOptions(userId, optionKeys, labelToKey)
					: null;

			let nextLocationKey = '';
			if (savedLocationKey) {
				nextLocationKey = savedLocationKey;
			} else if (fromServerPreferred) {
				nextLocationKey = fromServerPreferred;
			} else if (fromLocalPreference) {
				nextLocationKey = fromLocalPreference;
			} else if (nextOptions.length > 0) {
				const byCompanyKey = nextOptions.find((o) => o.value === DEFAULT_WORK_LOCATION_KEY);
				nextLocationKey = (byCompanyKey || nextOptions[0]).value;
			}
			setWorkLocationKey(nextLocationKey);
		} catch (err) {
			console.error('출퇴근 기록 로드 실패', err);
			Notify.toastApiFailure(err, '출퇴근 기록을 불러오지 못했습니다.');
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		fetchTodayStatus();
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);
		return () => clearInterval(timer);
	}, [fetchTodayStatus]);

	const persistPreferredLocationToServer = useCallback(async (value) => {
		if (!userId || !value) return;
		try {
			await attendanceApi.patchPreferredWorkLocation({ location_name: value });
		} catch (err) {
			Notify.toastApiFailure(err, '선호 근무장소를 서버에 저장하지 못했습니다.');
		}
	}, [userId]);

	const guardDebounce = () => {
		const t = Date.now();
		if (t - lastActionAtRef.current < ACTION_DEBOUNCE_MS) {
			return false;
		}
		lastActionAtRef.current = t;
		return true;
	};

	const ensureActiveSession = useCallback(async () => {
		setLoading(true);
		try {
			return await refreshAuth();
		} finally {
			setLoading(false);
		}
	}, [refreshAuth]);

	const handleClockIn = async () => {
		if (!guardDebounce()) return;
		if (!workLocationKey) {
			Notify.toastWarn('등록된 근무장소가 없습니다. 시스템 관리에서 근무장소를 먼저 등록해 주세요.');
			return;
		}
		if (!(await ensureActiveSession())) return;

		/* iOS: 세션 확인 직후 위치 요청을 시작해 확인창 전에 권한 팝업·GPS를 먼저 동작시킴 */
		const locationPromise = attendanceApi.getCurrentLocation();

		let confirmFullDayVacation = false;
		let confirmOfficialLeave = false;

		if (clockCtx?.requires_official_leave_confirm) {
			if (!window.confirm('공가 일정이 있습니다. 출근 기록을 등록하시겠습니까?')) return;
			confirmOfficialLeave = true;
		}
		if (clockCtx?.requires_full_day_vacation_confirm) {
			if (!window.confirm('종일 연차(휴가) 일정이 있습니다. 출근 처리하시겠습니까?')) return;
			confirmFullDayVacation = true;
		}
		if (clockCtx?.is_public_holiday) {
			const label = clockCtx.holiday_name ? `공휴일(${clockCtx.holiday_name})` : '공휴일';
			if (!window.confirm(`${label}입니다. 출근 처리하시겠습니까?`)) return;
		}
		if (clockCtx?.is_weekend) {
			if (!window.confirm('주말입니다. 출근 처리하시겠습니까?')) return;
		}
		if (!window.confirm(`${getWorkLocationDisplayLabel(workLocationKey)}에서 출근 처리하시겠습니까?`)) return;

		setLoading(true);
		try {
			const coords = await locationPromise;
			const data = {
				location_name: workLocationKey,
				latitude: coords.latitude,
				longitude: coords.longitude,
				note: '',
				confirm_full_day_vacation: confirmFullDayVacation,
				confirm_official_leave: confirmOfficialLeave,
			};
			await Notify.toastPromise(attendanceApi.clockIn(data), {
				loading: '위치를 확인하고 출근 처리 중입니다... 📍',
				success: '정상적으로 출근 처리되었습니다. 🏢',
				error: (err) => err.message || '출근 처리 중 오류가 발생했습니다. 위치 권한을 확인해주세요.',
			});
			writePreferredWorkLocation(userId, workLocationKey);
			await fetchTodayStatus();
		} catch (err) {
			console.error('출근 처리 실패', err);
			const msg = err?.message || '출근 처리 중 오류가 발생했습니다.';
			if (msg) Notify.toastError(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleClockOut = async () => {
		if (!guardDebounce()) return;
		if (!workLocationKey) {
			Notify.toastWarn('퇴근 처리할 근무장소를 선택해 주세요.');
			return;
		}
		if (!(await ensureActiveSession())) return;

		const locationPromise = attendanceApi.getCurrentLocation();

		if (clockCtx?.requires_official_leave_confirm) {
			if (!window.confirm('공가 일정이 있습니다. 퇴근 기록을 등록하시겠습니까?')) return;
		}
		if (clockCtx?.is_public_holiday) {
			const label = clockCtx.holiday_name ? `공휴일(${clockCtx.holiday_name})` : '공휴일';
			if (!window.confirm(`${label}입니다. 퇴근 처리하시겠습니까?`)) return;
		}
		if (clockCtx?.is_weekend) {
			if (!window.confirm('주말입니다. 퇴근 처리하시겠습니까?')) return;
		}
		if (!window.confirm(`${getWorkLocationDisplayLabel(workLocationKey)}에서 퇴근 처리하시겠습니까?`)) return;

		setLoading(true);
		try {
			const coords = await locationPromise;
			const data = {
				location_name: workLocationKey,
				latitude: coords.latitude,
				longitude: coords.longitude,
				note: '',
			};
			await Notify.toastPromise(attendanceApi.clockOut(data), {
				loading: '위치를 확인하고 퇴근 처리 중입니다... 📍',
				success: '오늘 하루도 고생하셨습니다! 🏃‍♂️',
				error: (err) => err.message || '퇴근 처리 중 오류가 발생했습니다.',
			});
			writePreferredWorkLocation(userId, workLocationKey);
			await fetchTodayStatus();
		} catch (err) {
			console.error('퇴근 처리 실패', err);
			const msg = err?.message || '퇴근 처리 중 오류가 발생했습니다.';
			if (msg) Notify.toastError(msg);
		} finally {
			setLoading(false);
		}
	};

	const isClockedIn = !!todayRecord?.clock_in_time;
	const isClockedOut = !!todayRecord?.clock_out_time;

	const localCalendarYmd = formatLocalCalendarYmd(currentTime);
	const workDateStr = todayRecord?.work_date;
	const showShiftWorkDateHint =
		Boolean(workDateStr) &&
		workDateStr !== localCalendarYmd &&
		isClockedIn &&
		!isClockedOut;

	const isJoinDateMissing = !authLoading && joinDate == null;
	const isWorkLocationMissing = !loading && locationOptions.length === 0;
	const disabledReason = isJoinDateMissing
		? '입사일이 등록되지 않은 계정입니다.'
		: isWorkLocationMissing
			? '등록된 근무장소가 없습니다. 관리자에게 근무장소 등록을 요청해 주세요.'
			: '';

	return (
		<div className="attendance-container">
			<div className="attendance-card">
				<div className="attendance-header">
					<p className="today-date">
						{`${currentTime.toLocaleDateString('ko-KR', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						})} (${currentTime.toLocaleDateString('ko-KR', { weekday: 'short' })})`}
					</p>
					<h1 className="digital-clock">{formatLocalTimeHms(currentTime)}</h1>
					{showShiftWorkDateHint ? (
						<p className="attendance-work-date-hint">
							표시 중인 근무일: {workDateStr}
							{' · '}
							미종료 근무(야근)입니다. 퇴근 시 전일 기준으로 처리됩니다.
						</p>
					) : null}
				</div>

				<div className="attendance-body">
					<div className="input-group">
						<label>📍 현재 근무 장소</label>
						<select
							className="bq-select"
							value={workLocationKey}
							onChange={(e) => {
								const v = e.target.value;
								setWorkLocationKey(v);
								writePreferredWorkLocation(userId, v);
								void persistPreferredLocationToServer(v);
							}}
							disabled={(isClockedIn && !isClockedOut) || locationOptions.length === 0}
						>
							{locationOptions.length === 0 ? <option value="">등록된 근무장소 없음</option> : null}
							{locationOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div className="button-group">
						<button
							type="button"
							className={`btn-clock-in ${isClockedIn ? 'disabled' : ''}`}
							onClick={handleClockIn}
							disabled={isClockedIn || loading || isJoinDateMissing || isWorkLocationMissing}
							title={disabledReason || ''}
						>
							{loading && !isClockedIn ? '확인 중...' : isClockedIn ? '✅ 출근 완료' : '출근하기'}
						</button>
						<button
							type="button"
							className={`btn-clock-out ${!isClockedIn || isClockedOut ? 'disabled' : ''}`}
							onClick={handleClockOut}
							disabled={!isClockedIn || isClockedOut || loading || isJoinDateMissing || !workLocationKey}
							title={disabledReason || ''}
						>
							{loading && isClockedIn && !isClockedOut ? '확인 중..' : isClockedOut ? '✅ 퇴근 완료' : '퇴근하기'}
						</button>
					</div>

					{disabledReason ? <div className="attendance-hr__disabled-banner">{disabledReason}</div> : null}
				</div>

				<div className="attendance-footer">
					<div className="status-item">
						<span className="label">출근 시간</span>
						<span className="value">
							{formatTimeHms(todayRecord?.clock_in_time)}{' '}
							{todayRecord?.clock_in_location && (
								<small>({getWorkLocationDisplayLabel(todayRecord.clock_in_location)})</small>
							)}
						</span>
					</div>
					<div className="status-item">
						<span className="label">퇴근 시간</span>
						<span className="value">
							{formatTimeHms(todayRecord?.clock_out_time)}{' '}
							{todayRecord?.clock_out_location && (
								<small>({getWorkLocationDisplayLabel(todayRecord.clock_out_location)})</small>
							)}
						</span>
					</div>
					<div className="status-item total-work">
						<span className="label">총 근무 시간</span>
						<span className="value">
							{todayRecord?.work_minutes
								? `${Math.floor(todayRecord.work_minutes / 60)}시간 ${todayRecord.work_minutes % 60}분`
								: '-'}
						</span>
					</div>
					<div className="status-item">
						<span className="label">야간 근로(현재 세션)</span>
						<span className="value">{todayRecord?.night_work_minutes ?? 0}분</span>
					</div>
					{daySummary ? (
						<div className="status-item attendance-day-totals">
							<span className="label">일 합계</span>
							<span className="value">
								근무 {daySummary.total_work_minutes ?? 0}분 · 야간 {daySummary.total_night_minutes ?? 0}분 · 연장{' '}
								{daySummary.overtime_minutes ?? 0}분
							</span>
						</div>
					) : null}
					{daySessions.length > 1 ? (
						<div className="attendance-day-sessions">
							<div className="attendance-day-sessions__title">당일 세션</div>
							<ul className="attendance-day-sessions__list">
								{daySessions.map((s, idx) => (
									<li key={s.id ?? idx} className="attendance-day-sessions__item">
										<span className="attendance-day-sessions__badge">
											{s.shift_status === 'CLOSED' ? '종료' : '진행'}
										</span>
										<span className="attendance-day-sessions__times">
											{formatTimeHms(s.clock_in_time)} — {formatTimeHms(s.clock_out_time)}
										</span>
										{s.night_work_minutes > 0 ? (
											<span className="attendance-day-sessions__night">야간 {s.night_work_minutes}분</span>
										) : null}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
};

export default AttendanceView;
