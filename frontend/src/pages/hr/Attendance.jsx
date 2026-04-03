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
	const [locationName, setLocationName] = useState('본사');
	const [loading, setLoading] = useState(false);
	const lastActionAtRef = useRef(0);

	const LOCATION_OPTIONS = [
		{ label: '🏢 본사', value: '본사' },
		{ label: '🏠 재택', value: '재택' },
		{ label: '💼 출장', value: '출장' },
		{ label: '🚗 외근', value: '외근' },
	];

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
			const [attRes, ctxRes] = await Promise.all([
				attendanceApi.getTodayAttendance(),
				attendanceApi.getClockContext(),
			]);
			setTodayRecord(attRes.data);
			setClockCtx(ctxRes.data);
			if (attRes.data?.clock_in_location) {
				setLocationName(attRes.data.clock_in_location);
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
	const disabledReason = isJoinDateMissing ? '입사일이 등록되지 않은 계정입니다.' : '';

	return (
		<div className="attendance-container">
			<div className="attendance-card">
				<div className="attendance-header">
					<p className="today-date">
						{currentTime.toLocaleDateString('ko-KR', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							weekday: 'short',
						})}
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
							disabled={isClockedIn && !isClockedOut}
						>
							{LOCATION_OPTIONS.map((opt) => (
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
							disabled={isClockedIn || loading || isJoinDateMissing}
							title={disabledReason || ''}
						>
							{loading && !isClockedIn ? '확인 중...' : isClockedIn ? '✅ 출근 완료' : '출근하기'}
						</button>
						<button
							type="button"
							className={`btn-clock-out ${!isClockedIn || isClockedOut ? 'disabled' : ''}`}
							onClick={handleClockOut}
							disabled={!isClockedIn || isClockedOut || loading || isJoinDateMissing}
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
