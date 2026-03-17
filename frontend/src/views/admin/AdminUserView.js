import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import UserModal from './UserModal'; // 분리한 모달 임포트
import '../../assets/css/admin.css';

const AdminUserView = () => {
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const loadUsers = async () => {
        try {
            const res = await adminService.getUsers();
            console.log(res.data);
            setUsers(res.data);
        } catch (err) { console.error("유저 로드 실패", err); }
    };

    useEffect(() => { loadUsers(); }, []);

    const openModal = (user = null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (userId) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            try {
                await adminService.deleteUser(userId);
                loadUsers();
            } catch (err) { alert("삭제 실패"); }
        }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>👥 사용자 관리</h2>
                <button 
                    className="btn-primary" 
                    style={{ backgroundColor: '#4A90E2' }} // 파란색으로 구분
                    onClick={async () => {
                        if(!window.confirm("현재 날짜를 기준으로 모든 직원의 연차를 정산하시겠습니까?")) return;
                        try {
                            // (axios 인스턴스에 맞게 경로 수정)
                            const res = await adminService.syncVacations(); // 백엔드 호출
                            alert(res.data.message || "연차 정산이 완료되었습니다.");
                            loadUsers(); // 테이블 새로고침
                        } catch (err) { alert("정산 실패"); }
                    }}
                >
                    🔄 연차 일괄 정산
                </button>
                <button className="btn-primary" onClick={() => openModal()}>신규 등록</button>

            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>아이디</th>
                            <th>성명</th>
                            <th>닉네임</th>
                            <th>권한</th>
                            <th>가입일</th>
                            <th>입사일</th>
                            <th>총 연차</th>
                            <th>사용</th>
                            <th>잔여</th>
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td>{u.user_login_id}</td>
                                <td>{u.user_name}</td>
                                <td>{u.user_nickname || '-'}</td>
                                <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                                <td>{u.created_at?.split('T')[0]}</td>
                                <td>{u.join_date?.split('T')[0]}</td>
                                <td style={{ fontWeight: 'bold' }}>{u.vacation?.total_days || 0}일</td>
                                <td style={{ color: '#FF4B4B' }}>{u.vacation?.used_days || 0}일</td>
                                <td style={{ color: '#3FAF7A', fontWeight: 'bold' }}>{u.vacation?.remaining_days || 0}일</td>
                                <td>
                                    <button className="btn-edit" onClick={() => openModal(u)}>수정</button>
                                    <button className="btn-delete" onClick={() => handleDelete(u.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 분리된 모달 사용 */}
            <UserModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onRefresh={loadUsers} 
                editingUser={editingUser}
            />
        </div>
    );
};

export default AdminUserView;