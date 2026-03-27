import React, { useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { adminApi } from 'api/adminApi';
import 'assets/css/admin.css';

const AdminAttendance = () => {
    const [attendanceList, setAttendanceList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAttendanceData = async () => {
            Notify.toastPromise(adminApi.getAllAttendance(), {
                loading: '출퇴근 기록을 불러오는 중입니다...',
                success: '출퇴근 기록을 불러왔습니다.',
                error: '출퇴근 기록을 불러오지 못했습니다.'
            }).then((res) => {
                setAttendanceList(res.data);
            }).catch((err) => {
                console.error("데이터 로드 실패:", err);
            }).finally(() => {
                setLoading(false);
            });
        };
        fetchAttendanceData();
    }, []);
    const formatTime = (timeStr) => {
        if (!timeStr) return '-';
        // 'T'를 공백으로 바꾸고, '.' 뒤의 마이크로초를 제거
        return timeStr.replace('T', ' ').split('.')[0];
    };
    // 총 근무 시간 포맷팅 함수 (분 -> 시간/분)
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
                /* 테이블 가로 스크롤을 위해 wrapper로 감쌈 */
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
                               [...attendanceList]
                               .sort((a, b) => new Date(b.work_date) - new Date(a.work_date))
                               .map((record) => (
                                    <tr key={record.id}>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>{record.user_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>({record.user_id})</div>
                                        </td>
                                        <td>{record.work_date}</td>
                                        <td>{formatTime(record.clock_in_time) || '-'}</td>
                                        <td>{formatTime(record.clock_out_time) || '-'}</td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: '#f1f3f5', color: '#666' }}>
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
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                                        기록된 출퇴근 내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminAttendance;