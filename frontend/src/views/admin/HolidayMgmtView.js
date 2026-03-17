// src/components/admin/HolidayMgmtView.js
import React, { useState, useEffect,useCallback } from 'react';
import { holidayService } from '../../services/holidayService';
import '../../assets/css/admin.css';

const HolidayMgmtView = () => {
    const [holidays, setHolidays] = useState([]);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString()); 
    const [isSyncing, setIsSyncing] = useState(false); // ✅ API 로딩 상태 관리
    
    const [newHoliday, setNewHoliday] = useState({
        holiday_date: '', holiday_name: '', is_official: 'true', description: ''
    });

    const fetchHolidays = useCallback(async () => {
        try {
            const res = await holidayService.getHolidays(yearFilter);
            setHolidays(res.data || []);
        } catch (err) {
            console.error("공휴일 로드 실패:", err);
        }
    }, [yearFilter]); // 👈 yearFilter가 바뀔 때만 함수를 새로 만듦

    // 3. useEffect 배열 안에 fetchHolidays를 넣어줍니다.
    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    // ✅ 공공데이터 동기화 핸들러 추가
    const handleSync = async () => {
        if (!window.confirm(`정말 ${yearFilter}년도 공휴일을 공공데이터에서 가져오시겠습니까?\n(이미 등록된 휴일은 건너뜁니다)`)) return;
        
        setIsSyncing(true);
        try {
            const res = await holidayService.syncHolidays(yearFilter);
            alert(res.data.message || "동기화가 완료되었습니다.");
            fetchHolidays(); // 성공 후 목록 새로고침
        } catch (err) {
            const errMsg = err || "공휴일 연동에 실패했습니다. (API 키 오류 또는 서버 문제)";
            alert(errMsg);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCreate = async () => {
        if (!newHoliday.holiday_date || !newHoliday.holiday_name) {
            return alert("날짜와 휴일명을 모두 입력해 주세요.");
        }
        try {
            const payload = { ...newHoliday, is_official: newHoliday.is_official === 'true' };
            await holidayService.createHoliday(payload);
            setNewHoliday({ holiday_date: '', holiday_name: '', is_official: 'true', description: '' });
            fetchHolidays();
            alert("공휴일이 성공적으로 등록되었습니다.");
        } catch (err) {
            alert(err.response?.data?.detail || "공휴일 등록에 실패했습니다.");
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`[${name}] 휴일을 정말 삭제하시겠습니까?`)) return;
        try {
            await holidayService.deleteHoliday(id);
            fetchHolidays();
        } catch (err) {
            alert("삭제에 실패했습니다.");
        }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>🏖️ <span>공휴일</span> 관리</h2>
                <p>법정/임시 공휴일 및 회사 지정 휴무일을 설정하고 관리합니다.</p>
            </div>

            {/* 통계 및 필터 카드 영역 */}
            <div className="admin-stats-row">
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span className="label">조회 연도</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select 
                            className="cat-input" 
                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', flex: 1 }}
                            value={yearFilter} 
                            onChange={(e) => setYearFilter(e.target.value)}
                        >
                            <option value="2025">2025년</option>
                            <option value="2026">2026년</option>
                            <option value="2027">2027년</option>
                            <option value="2028">2028년</option>
                        </select>
                        {/* ✅ 연동 버튼 추가 */}
                        <button 
                            className="btn-primary" 
                            style={{ padding: '8px 12px', whiteSpace: 'nowrap', opacity: isSyncing ? 0.7 : 1 }}
                            onClick={handleSync}
                            disabled={isSyncing}
                        >
                            {isSyncing ? "⏳ 처리중..." : "🌐 연동하기"}
                        </button>
                    </div>
                </div>
                <div className="stat-card">
                    <span className="label">해당 연도 총 휴일 수</span>
                    <span className="value">{holidays.length}일</span>
                </div>
                <div className="stat-card">
                    <span className="label">회사 지정 휴무일</span>
                    <span className="value" style={{ color: '#FF6A3D' }}>
                        {holidays.filter(h => h.is_official === false).length}일
                    </span>
                </div>
            </div>

            {/* 신규 등록 폼 및 테이블 영역은 기존 코드와 동일합니다. */}
            {/* ... (생략 없이 기존 코드를 그대로 두시면 됩니다) ... */}
            
            <div className="mgmt-section">
                <div className="category-add-box" style={{ flexWrap: 'nowrap' }}>
                    <input type="date" className="cat-input" value={newHoliday.holiday_date} onChange={e => setNewHoliday({...newHoliday, holiday_date: e.target.value})} />
                    <select className="cat-input" value={newHoliday.is_official} onChange={e => setNewHoliday({...newHoliday, is_official: e.target.value})}>
                        <option value="true">🔴 법정/임시 공휴일</option>
                        <option value="false">🟢 회사 지정 휴무일</option>
                    </select>
                    <input type="text" className="cat-input" placeholder="휴일명 (예: 대체공휴일)" value={newHoliday.holiday_name} onChange={e => setNewHoliday({...newHoliday, holiday_name: e.target.value})} />
                    <input type="text" className="cat-input" placeholder="비고 (선택)" value={newHoliday.description} onChange={e => setNewHoliday({...newHoliday, description: e.target.value})} />
                    <button className="btn-primary" onClick={handleCreate} style={{ whiteSpace: 'nowrap' }}>추가하기</button>
                </div>

                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{width: '20%'}}>날짜</th>
                                <th style={{width: '15%'}}>구분</th>
                                <th style={{width: '30%'}}>휴일명</th>
                                <th style={{width: '20%'}}>비고</th>
                                <th style={{width: '15%'}}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holidays.length > 0 ? (
                                holidays.map((holiday) => (
                                    <tr key={holiday.id}>
                                        <td><strong>{holiday.holiday_date}</strong></td>
                                        <td>
                                            {holiday.is_official ? (
                                                <span className="role-badge admin">법정공휴일</span>
                                            ) : (
                                                <span className="role-badge user" style={{background: '#e8f5e9', color: '#2e7d32'}}>회사지정</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: '600', color: '#141414' }}>{holiday.holiday_name}</td>
                                        <td style={{ color: '#888' }}>{holiday.description || '-'}</td>
                                        <td><button className="btn-delete-small" onClick={() => handleDelete(holiday.id, holiday.holiday_name)}>삭제</button></td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>해당 연도에 등록된 휴일이 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HolidayMgmtView;