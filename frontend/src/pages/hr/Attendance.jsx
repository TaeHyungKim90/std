import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { attendanceApi } from 'api/attendanceApi';
import 'assets/css/attendance.css';

const AttendanceView = () => {
	// 상태 관리
	const [todayRecord, setTodayRecord] = useState(null); // 오늘 출퇴근 데이터
	const [currentTime, setCurrentTime] = useState(new Date()); // 실시간 시계
	const [locationName, setLocationName] = useState('본사'); // 선택된 장소
	const [loading, setLoading] = useState(false); // 로딩 상태

	// 장소 옵션 (나중에 마스터 테이블 연동 가능)
	const LOCATION_OPTIONS = [
		{ label: '🏢 본사', value: '본사' },
		{ label: '🏠 재택', value: '재택' },
		{ label: '💼 출장', value: '출장' },
		{ label: '🚗 외근', value: '외근' }
	];

	useEffect(() => {
		// 1. 초기 데이터 로드 (오늘 기록이 있는지 확인)
		fetchTodayStatus();

		// 2. 1초마다 시계 업데이트
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	// 오늘 상태 가져오기
	const fetchTodayStatus = async () => {
		Notify.toastPromise(attendanceApi.getTodayAttendance(), {
			loading: '오늘 출퇴근 기록을 확인하는 중입니다...',
			success: '출퇴근 기록을 확인했습니다.',
			error: '출퇴근 기록을 불러오지 못했습니다.'
		}).then((res) => {
			setTodayRecord(res.data);
			if (res.data?.clock_in_location) {
				setLocationName(res.data.clock_in_location);
			}
		}).catch((err) => {
			console.error("출퇴근 기록 로드 실패", err);
		});
	};

	// 출근 처리
	const handleClockIn = async () => {
		if (!window.confirm(`${locationName}에서 출근 처리하시겠습니까?`)) return;

		setLoading(true);
		const clockInTask = async () => {
			const coords = await attendanceApi.getCurrentLocation();
			const data = {
				location_name: locationName,
				latitude: coords.latitude,
				longitude: coords.longitude,
				note: ""
			};
			return await attendanceApi.clockIn(data);
		};
		Notify.toastPromise(
			clockInTask(),
			{
				loading: '위치를 확인하고 출근 처리 중입니다... 📍',
				success: '정상적으로 출근 처리되었습니다. 🏢',
				error: (err) => err.message || "출근 처리 중 오류가 발생했습니다. 위치 권한을 확인해주세요."
			}
		).then(() => {
			fetchTodayStatus();
			setLoading(false);
		}).catch((err) => {
			console.error("출근 처리 실패", err);
			setLoading(false);
		});
	};

	// 퇴근 처리
	const handleClockOut = async () => {
		if (!window.confirm(`${locationName}에서 퇴근 처리하시겠습니까?`)) return;

		setLoading(true);
		const clockOutTask = async () => {
			const coords = await attendanceApi.getCurrentLocation();
			const data = {
				location_name: locationName,
				latitude: coords.latitude,
				longitude: coords.longitude,
				note: ""
			};
			return await attendanceApi.clockOut(data);
		};

		Notify.toastPromise(
			clockOutTask(),
			{
				loading: '위치를 확인하고 퇴근 처리 중입니다... 📍',
				success: '오늘 하루도 고생하셨습니다! 🏃‍♂️',
				error: (err) => err.message || "퇴근 처리 중 오류가 발생했습니다."
			}
		).then(() => {
			fetchTodayStatus();
			setLoading(false);
		}).catch((err) => {
			console.error("퇴근 처리 실패", err);
			setLoading(false);
		});
	};

	// 근무 시간 포맷팅 (HH:mm:ss)
	const formatTime = (dateStr) => {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleTimeString('ko-KR', { hour12: false });
	};

	// 현재 출퇴근 상태 판별
	const isClockedIn = !!todayRecord?.clock_in_time;
	const isClockedOut = !!todayRecord?.clock_out_time;

	return (
		<div className="attendance-container">
			<div className="attendance-card">
				{/* 상단 헤더: 날짜와 시계 */}
				<div className="attendance-header">
					<p className="today-date">{currentTime.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</p>
					<h1 className="digital-clock">{currentTime.toLocaleTimeString('ko-KR', { hour12: false })}</h1>
				</div>

				{/* 메인 설정 영역 */}
				<div className="attendance-body">
					<div className="input-group">
						<label>📍 현재 근무 장소</label>
						<select
							className="bq-select"
							value={locationName}
							onChange={(e) => setLocationName(e.target.value)}
							disabled={isClockedIn && !isClockedOut} // 출근 중일 때는 퇴근 장소를 선택해야 하므로 활성화
						>
							{LOCATION_OPTIONS.map(opt => (
								<option key={opt.value} value={opt.value}>{opt.label}</option>
							))}
						</select>
					</div>

					<div className="button-group">
						<button
							className={`btn-clock-in ${isClockedIn ? 'disabled' : ''}`}
							onClick={handleClockIn}
							disabled={isClockedIn || loading}
						>
							{isClockedIn ? '✅ 출근 완료' : '출근하기'}
						</button>
						<button
							className={`btn-clock-out ${(!isClockedIn || isClockedOut) ? 'disabled' : ''}`}
							onClick={handleClockOut}
							disabled={!isClockedIn || isClockedOut || loading}
						>
							{isClockedOut ? '✅ 퇴근 완료' : '퇴근하기'}
						</button>
					</div>
				</div>

				{/* 하단 상세 정보 */}
				<div className="attendance-footer">
					<div className="status-item">
						<span className="label">출근 시간</span>
						<span className="value">{formatTime(todayRecord?.clock_in_time)} {todayRecord?.clock_in_location && <small>({todayRecord.clock_in_location})</small>}</span>
					</div>
					<div className="status-item">
						<span className="label">퇴근 시간</span>
						<span className="value">{formatTime(todayRecord?.clock_out_time)} {todayRecord?.clock_out_location && <small>({todayRecord.clock_out_location})</small>}</span>
					</div>
					<div className="status-item total-work">
						<span className="label">총 근무 시간</span>
						<span className="value">{todayRecord?.work_minutes ? `${Math.floor(todayRecord.work_minutes / 60)}시간 ${todayRecord.work_minutes % 60}분` : '-'}</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AttendanceView;