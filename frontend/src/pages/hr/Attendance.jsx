import { attendanceApi } from 'api/attendanceApi';
import { useAuth } from 'context/AuthContext';
import React, { useEffect, useRef, useState } from 'react';
import { formatTimeHms } from 'utils/dateUtils';
import * as Notify from 'utils/toastUtils';

const ACTION_DEBOUNCE_MS = 800;

const AttendanceView = () => {
	const { joinDate, loading: authLoading } = useAuth();
	const [todayRecord, setTodayRecord] = useState(null);
	const [clockCtx, setClockCtx] = useState(null);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [locationName, setLocationName] = useState('');
	const [locationOptions, setLocationOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const lastActionAtRef = useRef(0);

	useEffect(() => {
		fetchTodayStatus();
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	const fetchTodayStatus = async () => {
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
			setClockCtx(ctxRes.data);
			const activeLocations = Array.isArray(workLocationRes?.data)
				? workLocationRes.data.filter((row) => row?.is_active !== false && row?.location_value)
				: [];
			const savedLocation = attRes.data?.clock_in_location || '';
			const nextOptions = activeLocations.map((row) => ({
				label: row.location_value,
				value: row.location_value,
			}));
			if (savedLocation && !nextOptions.some((opt) => opt.value === savedLocation)) {
				nextOptions.unshift({ label: savedLocation, value: savedLocation });
			}
			setLocationOptions(nextOptions);
			if (savedLocation) {
				setLocationName(savedLocation);
			} else if (nextOptions.length > 0) {
				setLocationName((prev) => (nextOptions.some((opt) => opt.value === prev) ? prev : nextOptions[0].value));
			} else {
				setLocationName('');
			}
		} catch (err) {
			console.error('출퇴근 기록 로드 실패', err);
			Notify.toastApiFailure(err, '출퇴근 기록을 불러오지 못했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const guardDebounce = () => {
		const t = Date.now();
		if (t - lastActionAtRef.current < ACTION_DEBOUNCE_MS) {
			return false;
		}
		lastActionAtRef.current = t;
		return true;
	};

	const handleClockIn = async () => {
		if (!guardDebounce()) return;
		if (!locationName) {
			Notify.toastWarn('등록된 근무장소가 없습니다. 시스템 관리에서 근무장소를 먼저 등록해 주세요.');
			return;
		}

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
		if (!window.confirm(`${locationName}에서 출근 처리하시겠습니까?`)) return;

		setLoading(true);
		const clockInTask = async () => {
			const coords = await attendanceApi.getCurrentLocation();
			const data = {
				location_name: locationName,
				latitude: coords.latitude,
				longitude: coords.longitude,
				note: '',
				confirm_full_day_vacation: confirmFullDayVacation,
				confirm_official_leave: confirmOfficialLeave,
			};
			return await attendanceApi.clockIn(data);
		};
		try {
			await Notify.toastPromise(clockInTask(), {
				loading: '위치를 확인하고 출근 처리 중입니다... 📍',
				success: '정상적으로 출근 처리되었습니다. 🏢',
				error: (err) => err.message || '출근 처리 중 오류가 발생했습니다. 위치 권한을 확인해주세요.',
			});
			await fetchTodayStatus();
		} catch (err) {
			console.error('출근 처리 실패', err);
		} finally {
			setLoading(false);
		}
	};

	const handleClockOut = async () => {
		if (!guardDebounce()) return;
		if (!locationName) {
			Notify.toastWarn('퇴근 처리할 근무장소를 선택해 주세요.');
			return;
		}

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
		if (!window.confirm(`${locationName}에서 퇴근 처리하시겠습니까?`)) return;

		setLoading(true);
		const clockOutTask = async () => {
			const coords = await attendanceApi.getCurrentLocation();
			const data = {
				location_name: locationName,
				latitude: coords.latitude,
				longitude: coords.longitude,
				note: '',
			};
			return await attendanceApi.clockOut(data);
		};
		try {
			await Notify.toastPromise(clockOutTask(), {
				loading: '위치를 확인하고 퇴근 처리 중입니다... 📍',
				success: '오늘 하루도 고생하셨습니다! 🏃‍♂️',
				error: (err) => err.message || '퇴근 처리 중 오류가 발생했습니다.',
			});
			await fetchTodayStatus();
		} catch (err) {
			console.error('퇴근 처리 실패', err);
		} finally {
			setLoading(false);
		}
	};

	const isClockedIn = !!todayRecord?.clock_in_time;
	const isClockedOut = !!todayRecord?.clock_out_time;

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
					<h1 className="digital-clock">{currentTime.toLocaleTimeString('ko-KR', { hour12: false })}</h1>
				</div>

				<div className="attendance-body">
					<div className="input-group">
						<label>📍 현재 근무 장소</label>
						<select
							className="bq-select"
							value={locationName}
							onChange={(e) => setLocationName(e.target.value)}
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
							disabled={!isClockedIn || isClockedOut || loading || isJoinDateMissing || !locationName}
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
							{todayRecord?.clock_in_location && <small>({todayRecord.clock_in_location})</small>}
						</span>
					</div>
					<div className="status-item">
						<span className="label">퇴근 시간</span>
						<span className="value">
							{formatTimeHms(todayRecord?.clock_out_time)}{' '}
							{todayRecord?.clock_out_location && <small>({todayRecord.clock_out_location})</small>}
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
				</div>
			</div>
		</div>
	);
};

export default AttendanceView;
