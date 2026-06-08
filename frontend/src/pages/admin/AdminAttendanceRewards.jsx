import { adminApi } from 'api/adminApi';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notify from 'utils/toastUtils';

function currentMonthValue() {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

function parseMonthValue(value) {
	const [yearRaw, monthRaw] = String(value || '').split('-');
	const year = Number(yearRaw);
	const month = Number(monthRaw);
	if (!Number.isInteger(year) || !Number.isInteger(month)) {
		const fallback = currentMonthValue();
		return parseMonthValue(fallback);
	}
	return { year, month };
}

const AdminAttendanceRewards = () => {
	const [monthValue, setMonthValue] = useState(currentMonthValue);
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState(null);

	const { year, month } = useMemo(() => parseMonthValue(monthValue), [monthValue]);

	const fetchRewards = useCallback(async () => {
		setLoading(true);
		try {
			const res = await adminApi.getMonthlyAttendanceRewards({ year, month });
			setData(res.data);
		} catch (err) {
			Notify.toastApiFailure(err, '월간 출퇴근 가산점을 불러오지 못했습니다.');
		} finally {
			setLoading(false);
		}
	}, [year, month]);

	useEffect(() => {
		fetchRewards();
	}, [fetchRewards]);

	const items = Array.isArray(data?.items) ? data.items : [];
	const winner = data?.winner || null;
	const policy = data?.points_policy || {};

	return (
		<div className="bq-admin-view attendance-rewards">
			<div className="admin-header">
				<div>
					<h2>출퇴근 가산점</h2>
					<p>월별 출근·퇴근 도장과 휴가 도장을 기준으로 쿠폰 대상자를 선정합니다.</p>
				</div>
				<div className="attendance-rewards__toolbar">
					<label className="attendance-rewards__month-label">
						월 선택
						<input
							type="month"
							value={monthValue}
							onChange={(e) => setMonthValue(e.target.value || currentMonthValue())}
							className="attendance-rewards__month-input"
						/>
					</label>
					<button type="button" className="btn-primary" onClick={fetchRewards} disabled={loading}>
						새로고침
					</button>
				</div>
			</div>

			<div className="attendance-rewards__summary-grid">
				<div className="attendance-rewards__winner-card">
					<div className="attendance-rewards__eyebrow">이번 달 쿠폰 대상자</div>
					{winner ? (
						<>
							<div className="attendance-rewards__winner-name">{winner.user_name}</div>
							<div className="attendance-rewards__winner-meta">
								{winner.user_id} · {winner.score}점 · 출퇴근 완료 {winner.attendance_completed_days}일
							</div>
						</>
					) : (
						<div className="attendance-rewards__empty-winner">
							아직 선정 가능한 가산점 기록이 없습니다.
						</div>
					)}
				</div>
				<div className="attendance-rewards__policy-card">
					<div className="attendance-rewards__eyebrow">가산점 기준</div>
					<div className="attendance-rewards__policy-list">
						<span>출퇴근 완료 +{policy.attendance_complete ?? 0}</span>
						<span>휴가 인정 +{policy.vacation ?? 0}</span>
					</div>
					<p>미출근·미퇴근은 감점 없이 해당 가산점만 부여하지 않습니다.</p>
				</div>
			</div>

			<div className="admin-table-wrapper attendance-rewards__table-wrap">
				<table className="admin-table">
					<thead>
						<tr>
							<th>순위</th>
							<th>직원</th>
							<th>총점</th>
							<th>출퇴근 완료</th>
							<th>휴가 인정</th>
							<th>최장 연속</th>
							<th>대상일</th>
							<th>쿠폰</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr>
								<td colSpan="8" className="admin-table__empty">가산점 데이터를 불러오는 중입니다.</td>
							</tr>
						) : items.length > 0 ? (
							items.map((row) => (
								<tr key={row.user_id} className={row.coupon_target ? 'attendance-rewards__winner-row' : ''}>
									<td>{row.rank}</td>
									<td>
										<div className="attendance-rewards__user-name">{row.user_name}</div>
										<div className="attendance-rewards__user-id">{row.user_id}</div>
									</td>
									<td className="attendance-rewards__score">{row.score}점</td>
									<td>{row.attendance_completed_days}일</td>
									<td>{row.vacation_days}일</td>
									<td>{row.longest_streak_days}일</td>
									<td>{row.eligible_days}일</td>
									<td>{row.coupon_target ? <span className="role-badge admin">대상</span> : '-'}</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan="8" className="admin-table__empty">표시할 직원이 없습니다.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default AdminAttendanceRewards;
