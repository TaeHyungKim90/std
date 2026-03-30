import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { holidayApi } from 'api/holidayApi';
import 'assets/css/admin.css';

/** 현재 연도 기준 −1 ~ +3 (총 5개 연도) */
const getYearSelectOptions = () => {
	const y = new Date().getFullYear();
	return Array.from({ length: 5 }, (_, i) => String(y - 1 + i));
};

const HolidayMgmt = () => {
	const { showLoading, hideLoading } = useLoading();
	const yearOptions = useMemo(() => getYearSelectOptions(), []);
	const defaultYear = useMemo(() => String(new Date().getFullYear()), []);

	const [holidays, setHolidays] = useState([]);
	const [yearFilter, setYearFilter] = useState(defaultYear);
	const [isSyncing, setIsSyncing] = useState(false);

	const [newHoliday, setNewHoliday] = useState({
		holiday_date: '', holiday_name: '', is_official: 'true', description: ''
	});

	const newHolidayDateYear = useMemo(() => {
		if (!newHoliday.holiday_date || newHoliday.holiday_date.length < 4) return null;
		const y = newHoliday.holiday_date.slice(0, 4);
		return /^\d{4}$/.test(y) ? y : null;
	}, [newHoliday.holiday_date]);

	const isDateYearMismatch =
		newHolidayDateYear !== null && newHolidayDateYear !== yearFilter;

	const fetchListForYear = useCallback(async (year) => {
		const res = await holidayApi.getHolidays(year);
		return res.data || [];
	}, []);

	const loadHolidaysList = useCallback(async () => {
		const data = await fetchListForYear(yearFilter);
		setHolidays(data);
	}, [yearFilter, fetchListForYear]);

	const refreshHolidaysList = useCallback(() => {
		return loadHolidaysList().catch((err) => {
			console.error("공휴일 로드 실패:", err);
			Notify.toastError("공휴일 목록을 새로고침하지 못했습니다.");
		});
	}, [loadHolidaysList]);

	useEffect(() => {
		let cancelled = false;
		showLoading("공휴일 목록을 불러오는 중입니다... ⏳");
		(async () => {
			try {
				const data = await fetchListForYear(yearFilter);
				if (!cancelled) setHolidays(data);
			} catch (err) {
				if (!cancelled) {
					console.error("공휴일 로드 실패:", err);
					Notify.toastError("공휴일 목록 로드에 실패했습니다.");
				}
			} finally {
				if (!cancelled) hideLoading();
			}
		})();
		return () => {
			cancelled = true;
			// 이전 요청이 끝나기 전 연도 변경/언마운트 시 finally에서 hideLoading이 스킵되므로 여기서 반드시 끔
			hideLoading();
		};
	}, [yearFilter, fetchListForYear, showLoading, hideLoading]);

	const handleSync = async () => {
		if (!window.confirm(`정말 ${yearFilter}년도 공휴일을 공공데이터에서 가져오시겠습니까?\n(이미 등록된 휴일은 건너뜁니다)`)) return;
		setIsSyncing(true);
		Notify.toastPromise(holidayApi.syncHolidays(yearFilter), {
			loading: '공공데이터 공휴일을 동기화하는 중입니다...',
			success: '공휴일 동기화가 완료되었습니다.',
			error: '공휴일 연동에 실패했습니다.'
		}).then((res) => {
			if (res.data?.message) {
				Notify.toastInfo(res.data.message);
			}
			refreshHolidaysList();
		}).catch((err) => {
			console.error("공휴일 연동 실패:", err);
		}).finally(() => {
			setIsSyncing(false);
		});
	};

	const handleCreate = async () => {
		if (!newHoliday.holiday_date || !newHoliday.holiday_name) return Notify.toastWarn("날짜와 휴일명을 모두 입력해 주세요.");
		if (isDateYearMismatch) {
			return Notify.toastWarn(
				`날짜는 ${newHolidayDateYear}년인데, 아래 목록은 ${yearFilter}년만 보여 줍니다. 상단 연도를 ${newHolidayDateYear}년으로 바꾸거나 날짜를 ${yearFilter}년으로 맞춰 주세요.`
			);
		}
		const createTask = async () => {
			const payload = { ...newHoliday, is_official: newHoliday.is_official === 'true' };
			return holidayApi.createHoliday(payload);
		};
		Notify.toastPromise(createTask(), {
			loading: '휴일을 등록하는 중입니다...',
			success: '휴일이 등록되었습니다.',
			error: '휴일 등록에 실패했습니다.'
		}).then(() => {
			setNewHoliday({ holiday_date: '', holiday_name: '', is_official: 'true', description: '' });
			refreshHolidaysList();
		}).catch((err) => {
			console.error("휴일 등록 실패:", err);
		});
	};

	const handleDelete = async (id, name) => {
		if (!window.confirm(`[${name}] 휴일을 정말 삭제하시겠습니까?`)) return;
		Notify.toastPromise(holidayApi.deleteHoliday(id), {
			loading: '휴일을 삭제하는 중입니다...',
			success: '휴일이 삭제되었습니다.',
			error: '휴일 삭제에 실패했습니다.'
		}).then(() => {
			refreshHolidaysList();
		}).catch((err) => {
			console.error("휴일 삭제 실패:", err);
		});
	};

	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>🏖️ <span>공휴일</span> 관리</h2>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					{/* 상단으로 끌어올린 연도 필터 및 동기화 버튼 */}
					<select className="bq-select" style={{ width: '120px', margin: 0 }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
						{yearOptions.map((y) => (
							<option key={y} value={y}>{y}년</option>
						))}
					</select>
					<button className="btn-primary" style={{ backgroundColor: '#4A90E2' }} onClick={handleSync} disabled={isSyncing}>
						{isSyncing ? "⏳ 처리중..." : "🌐 공공데이터 연동"}
					</button>
				</div>
			</div>

			{/* 깔끔한 신규 등록 박스 */}
			<div style={{ marginBottom: '8px' }}>
				<div className="category-add-box" style={{ flexWrap: 'nowrap' }}>
					<input type="date" className="cat-input" value={newHoliday.holiday_date} onChange={e => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })} aria-invalid={isDateYearMismatch} />
					<select className="cat-input" value={newHoliday.is_official} onChange={e => setNewHoliday({ ...newHoliday, is_official: e.target.value })}>
						<option value="true">🔴 법정 공휴일</option>
						<option value="false">🟢 회사 휴무일</option>
					</select>
					<input type="text" className="cat-input" placeholder="휴일명 (예: 대체공휴일)" value={newHoliday.holiday_name} onChange={e => setNewHoliday({ ...newHoliday, holiday_name: e.target.value })} />
					<input type="text" className="cat-input" placeholder="비고 (선택)" value={newHoliday.description} onChange={e => setNewHoliday({ ...newHoliday, description: e.target.value })} />
					<button className="btn-save" onClick={handleCreate} style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}>추가하기</button>
				</div>
				<p style={{ fontSize: '0.82rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.45 }}>
					목록은 상단에서 고른 <strong>{yearFilter}년</strong> 휴일만 표시됩니다. 다른 연도를 넣으려면 먼저 연도를 바꾼 뒤 등록하세요.
				</p>
				{isDateYearMismatch && (
					<p
						role="status"
						style={{
							fontSize: '0.88rem',
							color: '#c2410c',
							margin: '8px 0 0',
							fontWeight: 600,
							lineHeight: 1.45
						}}
					>
						선택한 날짜는 {newHolidayDateYear}년입니다. 지금 목록은 {yearFilter}년만 보여 주므로, 등록 후에도 여기서는 보이지 않습니다. 연도를 {newHolidayDateYear}년으로 바꾸거나 날짜를 {yearFilter}년으로 맞춰 주세요.
					</p>
				)}
			</div>

			<div className="admin-table-wrapper">
				<table className="admin-table">
					<thead>
						<tr>
							<th style={{ width: '20%' }}>날짜</th>
							<th style={{ width: '15%' }}>구분</th>
							<th style={{ width: '30%' }}>휴일명</th>
							<th style={{ width: '20%' }}>비고</th>
							<th style={{ width: '15%' }}>관리</th>
						</tr>
					</thead>
					<tbody>
						{holidays.length > 0 ? holidays.map((holiday) => (
							<tr key={holiday.id}>
								<td><strong>{holiday.holiday_date}</strong></td>
								<td>
									{holiday.is_official ? (
										<span className="role-badge admin">법정공휴일</span>
									) : (
										<span className="role-badge user" style={{ background: '#e8f5e9', color: '#2e7d32' }}>회사지정</span>
									)}
								</td>
								<td style={{ fontWeight: '600', color: '#141414' }}>{holiday.holiday_name}</td>
								<td style={{ color: '#888' }}>{holiday.description || '-'}</td>
								<td><button className="btn-delete-small" onClick={() => handleDelete(holiday.id, holiday.holiday_name)}>삭제</button></td>
							</tr>
						)) : (
							<tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>해당 연도에 등록된 휴일이 없습니다.</td></tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default HolidayMgmt;