import React, { useEffect, useState, useCallback, useMemo } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { adminApi } from 'api/adminApi';
import { holidayApi } from 'api/holidayApi';
import PaginationBar from 'components/common/PaginationBar';
import { usePaginationSearchParams } from 'hooks/usePaginationSearchParams';
import { useSearchParams } from 'react-router-dom';
const PAGE_SIZE = 20;
const SUMMARY_PAGE_SIZE = 100; // backend limit <= 100

const getTodayYmd = () => {
	// local time 기준 YYYY-MM-DD
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
};

const parseYmdParam = (val) => {
	if (typeof val !== 'string') return null;
	return /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : null;
};

const normalizeStatus = (status) => (status ?? '').toString().trim().toUpperCase();

const isVacation = (record) => {
	const st = normalizeStatus(record?.status);
	if (!st) return false;
	// 데이터에 어떤 값이 들어오는지 불명확할 수 있으므로 넓게 매칭
	return (
		st.includes('VAC') ||
		st.includes('SICK') ||
		st.includes('LEAVE') ||
		st.includes('휴가') ||
		st.includes('병가')
	);
};

const AdminAttendance = () => {
	const { showLoading, hideLoading } = useLoading();
	const [attendanceList, setAttendanceList] = useState([]);
	const [total, setTotal] = useState(null);
	const [page, setPage] = usePaginationSearchParams({ pageSize: PAGE_SIZE, total });
	const [loading, setLoading] = useState(true);

	const [searchParams, setSearchParams] = useSearchParams();
	const urlSelectedDate = parseYmdParam(searchParams.get('date'));

	const todayYmd = useMemo(() => getTodayYmd(), []);
	const [selectedDate, setSelectedDate] = useState(urlSelectedDate || getTodayYmd());
	const [isWeekend, setIsWeekend] = useState(false);
	const [isPublicHoliday, setIsPublicHoliday] = useState(false);
	const [vacationTodoUserIds, setVacationTodoUserIds] = useState([]);

	const [summaryLoading, setSummaryLoading] = useState(true);
	const [summary, setSummary] = useState({
		totalEmployees: 0,
		attendedCompleted: 0,
		vacationCount: 0,
		absentCount: 0,
	});

	const fetchAttendanceData = useCallback(async () => {
		showLoading('출퇴근 기록을 불러오는 중입니다... ⏳');
		try {
			const skip = (page - 1) * PAGE_SIZE;
			// backend 쿼리 파라미터명은 `work_date` (프론트 요청사항의 date에 해당)
			const res = await adminApi.getAllAttendance({
				skip,
				limit: PAGE_SIZE,
				date: selectedDate, // rule 용도: 실제 backend는 work_date를 사용
				work_date: selectedDate,
			});
			const body = res.data;
			setAttendanceList(Array.isArray(body?.items) ? body.items : []);
			setTotal(typeof body?.total === 'number' ? body.total : 0);
		} catch (err) {
			console.error('데이터 로드 실패:', err);
			Notify.toastError(err.message || '출퇴근 기록을 불러오지 못했습니다.');
		} finally {
			hideLoading();
			setLoading(false);
		}
	}, [page, selectedDate, showLoading, hideLoading]);

	useEffect(() => {
		fetchAttendanceData();
	}, [fetchAttendanceData]);

	// URL에서 date가 바뀐 경우(뒤로가기/앞으로가기 등) 화면 상태 동기화
	useEffect(() => {
		if (urlSelectedDate && urlSelectedDate !== selectedDate) {
			setSelectedDate(urlSelectedDate);
		}
	}, [urlSelectedDate, selectedDate]);

	const fetchAttendanceSummary = useCallback(async () => {
		setSummaryLoading(true);
		try {
			// 캘린더 휴가(공휴일/휴무일) 여부를 먼저 판단
			// 주말(토/일)도 "휴일"로 취급
			const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
			const isWeekendLocal =
				selectedDateObj.toString() !== 'Invalid Date' &&
				(selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6);

			const selectedYear = parseInt(String(selectedDate).slice(0, 4), 10);
			const holidayRes = await holidayApi.getHolidays(Number.isFinite(selectedYear) ? selectedYear : '');
			const isHoliday = Array.isArray(holidayRes.data)
				? holidayRes.data.some((h) => String(h.holiday_date) === selectedDate)
				: false;
			// isHoliday는 "공휴일" 테이블 기준
			setIsWeekend(!!isWeekendLocal);
			setIsPublicHoliday(!!isHoliday);

			// 해당 날짜에 걸친 직원별 연차/휴가(HR todos) 목록 조회
			let vacationTodoUserIdList = [];
			if (typeof adminApi.getVacationTodosForDate !== 'function') {
				console.warn('adminApi.getVacationTodosForDate is not a function');
				vacationTodoUserIdList = [];
			} else {
				const todoRes = await adminApi.getVacationTodosForDate(selectedDate);
				vacationTodoUserIdList = Array.isArray(todoRes?.data)
					? todoRes.data.map((t) => t.user_id).filter(Boolean)
					: [];
			}
			setVacationTodoUserIds(vacationTodoUserIdList);
			// 요약 계산은 state 업데이트 타이밍과 무관하게 로컬 변수로 즉시 set 구성
			const vacationTodoUserIdSetLocal = new Set(vacationTodoUserIdList);

			let skip = 0;
			let totalEmployees = 0;
			let allItems = [];

			// backend: limit <= 100 이므로, 같은 work_date에 대해 페이지를 돌며 전부 수집
			while (true) {
				const res = await adminApi.getAllAttendance({
					skip,
					limit: SUMMARY_PAGE_SIZE,
					date: selectedDate, // rule 용도: 실제 backend는 work_date를 사용
					work_date: selectedDate,
				});

				const body = res.data;
				if (typeof body?.total === 'number' && totalEmployees === 0) {
					totalEmployees = body.total;
				}

				const items = Array.isArray(body?.items) ? body.items : [];
				allItems = allItems.concat(items);

				skip += SUMMARY_PAGE_SIZE;
				if (!totalEmployees || skip >= totalEmployees || items.length === 0) break;
			}

			const counts = allItems.reduce(
				(acc, record) => {
					// 분배 규칙:
					// 1) clock_in_time 있으면 출근(완료)
					// 2) clock_in_time 없으면 (캘린더 휴가 OR 상태의 휴가 키워드 OR HR todos 휴가) => 휴가
					// 3) 그 외 => 미출근
					if (record?.clock_in_time) acc.attendedCompleted += 1;
					else if (
						isWeekendLocal ||
						isHoliday ||
						isVacation(record) ||
						vacationTodoUserIdSetLocal.has(record.user_id)
					)
						acc.vacationCount += 1;
					else acc.absentCount += 1;
					return acc;
				},
				{ attendedCompleted: 0, vacationCount: 0, absentCount: 0 }
			);

			// totalEmployees는 User 기준(중복 없는 재직자 수)로 오기 때문에
			// 반드시 합이 totalEmployees가 되도록 absentCount를 최종 보정
			const absentCount = Math.max(
				0,
				(totalEmployees || 0) - counts.attendedCompleted - counts.vacationCount
			);

			setSummary({
				totalEmployees: totalEmployees || 0,
				attendedCompleted: counts.attendedCompleted,
				vacationCount: counts.vacationCount,
				absentCount,
			});
		} catch (err) {
			console.error('대시보드 요약 로드 실패:', err);
			Notify.toastError(err.message || '요약 정보를 불러오지 못했습니다.');
		} finally {
			setSummaryLoading(false);
		}
	}, [selectedDate]);

	const vacationTodoUserIdSet = useMemo(
		() => new Set(vacationTodoUserIds),
		[vacationTodoUserIds]
	);

	useEffect(() => {
		// 날짜 변경 시 테이블 페이지를 1로 되돌려 UX를 안정화
		setTotal(null);
		fetchAttendanceSummary();
	}, [selectedDate, fetchAttendanceSummary]);

	const handleChangeDate = useCallback(
		(nextDate) => {
			const safe = parseYmdParam(nextDate) || getTodayYmd();
			setSelectedDate(safe);
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				next.set('date', safe);
				next.set('page', '1');
				return next;
			});
		},
		[setSearchParams]
	);

	const formatTime = (timeStr) => {
		if (!timeStr) return '-';
		return timeStr.replace('T', ' ').split('.')[0];
	};

	const formatWorkTime = (minutes) => {
		if (minutes === null || minutes === undefined) return '-';
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return `${h}시간 ${m}분`;
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>⏰ 일일 근태 현황 대시보드</h2>
				<p>선택한 날짜의 출근/휴가/미출근 현황을 한눈에 확인하세요.</p>

				<div
					style={{
						marginTop: 12,
						display: 'flex',
						alignItems: 'center',
						gap: 12,
						flexWrap: 'wrap',
					}}
				>
					<label style={{ fontWeight: 700, color: '#222' }}>
						날짜
						<input
							type="date"
							value={selectedDate}
							onChange={(e) => handleChangeDate(e.target.value)}
							style={{
								marginLeft: 10,
								padding: '8px 10px',
								borderRadius: 8,
								border: '1px solid #d9d9d9',
								background: '#fff',
								fontWeight: 600,
							}}
						/>
						<button
							type="button"
							onClick={() => handleChangeDate(todayYmd)}
							style={{
								marginLeft: 10,
								padding: '8px 12px',
								borderRadius: 8,
								border: '1px solid #d9d9d9',
								background: '#fff',
								fontWeight: 700,
								cursor: 'pointer',
							}}
						>
							오늘
						</button>
					</label>
				</div>
			</div>

			{/* 상단 요약 카운터 */}
			<div
				style={{
					marginTop: 16,
					display: 'grid',
					gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
					gap: 12,
				}}
			>
				<div
					style={{
						border: '1px solid #e8e8e8',
						borderRadius: 12,
						padding: 14,
						background: '#fff',
					}}
				>
					<div style={{ color: '#666', fontWeight: 600, fontSize: 13 }}>
						전체 직원 수
					</div>
					<div style={{ fontSize: 22, fontWeight: 900, color: '#111', marginTop: 6 }}>
						{summaryLoading ? '...' : summary.totalEmployees}
					</div>
				</div>
				<div
					style={{
						border: '1px solid #d8f3ea',
						borderRadius: 12,
						padding: 14,
						background: '#f3fffb',
					}}
				>
					<div style={{ color: '#1f7a5a', fontWeight: 700, fontSize: 13 }}>
						출근 완료
					</div>
					<div style={{ fontSize: 22, fontWeight: 900, color: '#0f5d46', marginTop: 6 }}>
						{summaryLoading ? '...' : summary.attendedCompleted}
					</div>
				</div>
				<div
					style={{
						border: '1px solid #e9e2ff',
						borderRadius: 12,
						padding: 14,
						background: '#f7f4ff',
					}}
				>
					<div style={{ color: '#5a2bb8', fontWeight: 700, fontSize: 13 }}>
						{isPublicHoliday ? '공휴일' : isWeekend ? '휴일' : '휴가'}
					</div>
					<div style={{ fontSize: 22, fontWeight: 900, color: '#4a1f9a', marginTop: 6 }}>
						{summaryLoading ? '...' : summary.vacationCount}
					</div>
				</div>
				<div
					style={{
						border: '1px solid #ffe1e1',
						borderRadius: 12,
						padding: 14,
						background: '#fff5f5',
					}}
				>
					<div style={{ color: '#b42318', fontWeight: 700, fontSize: 13 }}>
						미출근(지각/결근 등)
					</div>
					<div style={{ fontSize: 22, fontWeight: 900, color: '#9f1c14', marginTop: 6 }}>
						{summaryLoading ? '...' : summary.absentCount}
					</div>
				</div>
			</div>

			{loading ? (
				<div style={{ textAlign: 'center', padding: '50px' }}>데이터를 불러오는 중...</div>
			) : (
				<>
					<div className="admin-table-wrapper">
						<table className="admin-table">
							<thead>
								<tr>
									<th>이름(아이디)</th>
									<th>날짜</th>
									<th>출근 시간</th>
									<th>퇴근 시간</th>
									<th>근무 장소</th>
									<th>총 근무시간</th>
								</tr>
							</thead>
							<tbody>
								{attendanceList.length > 0 ? (
									attendanceList.map((record, index) => (
										<tr key={record.user_id || record.id || index}>
											<td>
												<div style={{ fontWeight: '600' }}>{record.user_name}</div>
												<div style={{ fontSize: '0.8rem', color: '#888' }}>
													({record.user_id || '아이디 미상'})
												</div>
											</td>
											<td>{record.work_date ? record.work_date : selectedDate}</td>
											<td>
												{record.clock_in_time ? (
													formatTime(record.clock_in_time)
												) : (
													<span
														className="badge"
														style={{
															backgroundColor:
																!record.clock_in_time &&
																(isPublicHoliday ||
																	isWeekend ||
																	isVacation(record) ||
																	vacationTodoUserIdSet.has(record.user_id))
																	? '#e9e2ff'
																	: '#ffe1e1',
															color:
																isPublicHoliday || isWeekend
																	? '#5a2bb8'
																	: isVacation(record) ||
																	  vacationTodoUserIdSet.has(record.user_id)
																		? '#5a2bb8'
																		: '#9f1c14',
															fontWeight: 800,
														}}
													>
														{isPublicHoliday
															? '공휴일'
															: isWeekend
																? '휴일'
																: isVacation(record) ||
																  vacationTodoUserIdSet.has(record.user_id)
																	? '휴가'
																	: '미출근'}
													</span>
												)}
											</td>
											<td>{formatTime(record.clock_out_time) || '-'}</td>
											<td>
												<span
													className="badge"
													style={{ backgroundColor: '#f1f3f5', color: '#666' }}
												>
													{record.clock_in_location || '미지정'}
												</span>
											</td>
											<td style={{ color: '#4a90e2', fontWeight: 'bold' }}>
												{formatWorkTime(record.work_minutes)}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td
											colSpan="6"
											style={{ textAlign: 'center', padding: '30px', color: '#999' }}
										>
											기록된 출퇴근 내역이 없습니다.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<PaginationBar page={page} pageSize={PAGE_SIZE} total={total ?? 0} onPageChange={setPage} />
				</>
			)}
		</div>
	);
};

export default AdminAttendance;
