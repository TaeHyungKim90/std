import React, { useEffect, useState, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { adminApi } from 'api/adminApi';
import PaginationBar from 'components/common/PaginationBar';
const PAGE_SIZE = 20;

const AdminAttendance = () => {
	const { showLoading, hideLoading } = useLoading();
	const [attendanceList, setAttendanceList] = useState([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);

	const fetchAttendanceData = useCallback(async () => {
		showLoading('출퇴근 기록을 불러오는 중입니다... ⏳');
		try {
			const skip = (page - 1) * PAGE_SIZE;
			const res = await adminApi.getAllAttendance({ skip, limit: PAGE_SIZE });
			const body = res.data;
			setAttendanceList(Array.isArray(body?.items) ? body.items : []);
			setTotal(typeof body?.total === 'number' ? body.total : 0);
		} catch (err) {
			console.error('데이터 로드 실패:', err);
			Notify.toastError('출퇴근 기록을 불러오지 못했습니다.');
		} finally {
			hideLoading();
			setLoading(false);
		}
	}, [page, showLoading, hideLoading]);

	useEffect(() => {
		fetchAttendanceData();
	}, [fetchAttendanceData]);

	const formatTime = (timeStr) => {
		if (!timeStr) return '-';
		return timeStr.replace('T', ' ').split('.')[0];
	};

	const formatWorkTime = (minutes) => {
		if (!minutes) return '-';
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return `${h}시간 ${m}분`;
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>⏰ 전체 출퇴근 기록 조회</h2>
				<p>모든 임직원의 출퇴근 내역을 확인하고 관리합니다.</p>
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
									attendanceList.map((record) => (
										<tr key={record.id}>
											<td>
												<div style={{ fontWeight: '600' }}>{record.user_name}</div>
												<div style={{ fontSize: '0.8rem', color: '#888' }}>
													({record.user_id})
												</div>
											</td>
											<td>{record.work_date}</td>
											<td>{formatTime(record.clock_in_time) || '-'}</td>
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
					<PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
				</>
			)}
		</div>
	);
};

export default AdminAttendance;
