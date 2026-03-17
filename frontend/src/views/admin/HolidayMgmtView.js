import React, { useState, useEffect, useCallback } from 'react';
import { holidayService } from '../../services/holidayService';
import '../../assets/css/admin.css';

const HolidayMgmtView = () => {
    const [holidays, setHolidays] = useState([]);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString()); 
    const [isSyncing, setIsSyncing] = useState(false); 
    
    const [newHoliday, setNewHoliday] = useState({
        holiday_date: '', holiday_name: '', is_official: 'true', description: ''
    });

    const fetchHolidays = useCallback(async () => {
        try {
            const res = await holidayService.getHolidays(yearFilter);
            setHolidays(res.data || []);
        } catch (err) { console.error("공휴일 로드 실패:", err); }
    }, [yearFilter]); 

    useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

    const handleSync = async () => {
        if (!window.confirm(`정말 ${yearFilter}년도 공휴일을 공공데이터에서 가져오시겠습니까?\n(이미 등록된 휴일은 건너뜁니다)`)) return;
        setIsSyncing(true);
        try {
            const res = await holidayService.syncHolidays(yearFilter);
            alert(res.data?.message || "동기화가 완료되었습니다.");
            fetchHolidays(); 
        } catch (err) {
            alert(err || "공휴일 연동에 실패했습니다.");
        } finally { setIsSyncing(false); }
    };

    const handleCreate = async () => {
        if (!newHoliday.holiday_date || !newHoliday.holiday_name) return alert("날짜와 휴일명을 모두 입력해 주세요.");
        try {
            const payload = { ...newHoliday, is_official: newHoliday.is_official === 'true' };
            await holidayService.createHoliday(payload);
            setNewHoliday({ holiday_date: '', holiday_name: '', is_official: 'true', description: '' });
            fetchHolidays();
        } catch (err) { alert(err.response?.data?.detail || "등록 실패"); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`[${name}] 휴일을 정말 삭제하시겠습니까?`)) return;
        try {
            await holidayService.deleteHoliday(id);
            fetchHolidays();
        } catch (err) { alert("삭제 실패"); }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>🏖️ <span>공휴일</span> 관리</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* 상단으로 끌어올린 연도 필터 및 동기화 버튼 */}
                    <select className="bq-select" style={{ width: '120px', margin: 0 }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                        <option value="2026">2026년</option>
                        <option value="2027">2027년</option>
                        <option value="2028">2028년</option>
                    </select>
                    <button className="btn-primary" style={{ backgroundColor: '#4A90E2' }} onClick={handleSync} disabled={isSyncing}>
                        {isSyncing ? "⏳ 처리중..." : "🌐 공공데이터 연동"}
                    </button>
                </div>
            </div>

            {/* 깔끔한 신규 등록 박스 */}
            <div className="category-add-box" style={{ flexWrap: 'nowrap' }}>
                <input type="date" className="cat-input" value={newHoliday.holiday_date} onChange={e => setNewHoliday({...newHoliday, holiday_date: e.target.value})} />
                <select className="cat-input" value={newHoliday.is_official} onChange={e => setNewHoliday({...newHoliday, is_official: e.target.value})}>
                    <option value="true">🔴 법정 공휴일</option>
                    <option value="false">🟢 회사 휴무일</option>
                </select>
                <input type="text" className="cat-input" placeholder="휴일명 (예: 대체공휴일)" value={newHoliday.holiday_name} onChange={e => setNewHoliday({...newHoliday, holiday_name: e.target.value})} />
                <input type="text" className="cat-input" placeholder="비고 (선택)" value={newHoliday.description} onChange={e => setNewHoliday({...newHoliday, description: e.target.value})} />
                <button className="btn-save" onClick={handleCreate} style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}>추가하기</button>
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
                        {holidays.length > 0 ? holidays.map((holiday) => (
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
                        )) : (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>해당 연도에 등록된 휴일이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HolidayMgmtView;