import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import UserModal from '../../components/admin/UserModal';
import '../../assets/css/admin.css';

const AdminUserView = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState(''); // ✅ 검색어 상태 추가
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const loadUsers = async () => {
        try {
            const res = await adminApi.getUsers();
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
                await adminApi.deleteUser(userId);
                loadUsers();
            } catch (err) { alert("삭제 실패"); }
        }
    };

    // ✅ 검색 필터링 로직 (이름 또는 아이디로 검색)
    const filteredUsers = users.filter(u => 
        u.user_name.includes(searchTerm) || u.user_login_id.includes(searchTerm)
    );

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>👥 사용자 관리</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* ✅ 실시간 검색창 추가 */}
                    <input 
                        type="text" 
                        placeholder="이름 또는 아이디 검색..." 
                        className="bq-input"
                        style={{ width: '250px', margin: 0, padding: '10px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button 
                        className="btn-primary" 
                        style={{ backgroundColor: '#4A90E2' }} 
                        onClick={async () => {
                            if(!window.confirm("현재 날짜를 기준으로 모든 직원의 연차를 정산하시겠습니까?")) return;
                            try {
                                const res = await adminApi.syncVacations(); 
                                alert(res.data?.message || "연차 정산이 완료되었습니다.");
                                loadUsers(); 
                            } catch (err) { alert("정산 실패"); }
                        }}
                    >
                        🔄 연차 일괄 정산
                    </button>
                    <button className="btn-primary" onClick={() => openModal()}>신규 등록</button>
                </div>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    {/* ... (thead 동일 유지) ... */}
                    <thead>
                        <tr>
                            <th>아이디</th>
                            <th>성명</th>
                            <th>닉네임</th>
                            <th>연락처</th>
                            <th>상태/권한</th> {/* ✅ 상태 추가 */}
                            <th>가입일</th>
                            <th>입사/퇴사일</th> {/* ✅ 통합 */}
                            <th>잔여/총 연차</th> {/* ✅ 보기 좋게 통합 */}
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length > 0 ? filteredUsers.map(u => {
                            const isResigned = !!u.resignation_date; // ✅ 퇴사자 여부 확인
                            
                            return (
                                // ✅ 퇴사자는 투명도를 주고 배경색을 어둡게 처리
                                <tr key={u.id} style={{ opacity: isResigned ? 0.6 : 1, backgroundColor: isResigned ? '#fafafa' : 'transparent' }}>
                                    <td>{u.user_login_id}</td>
                                    <td style={{ fontWeight: 'bold' }}>
                                        {u.user_name} 
                                        {isResigned && <span style={{fontSize:'0.75rem', color:'#FF6A3D', marginLeft:'5px'}}>(퇴사)</span>}
                                    </td>
                                    <td>{u.user_nickname || '-'}</td>
                                    <td>{u.user_phone_number || '-'}</td>
                                    <td>
                                        <span className={`role-badge ${u.role}`}>{u.role}</span>
                                    </td>
                                    <td>{u.created_at?.split('T')[0]}</td>
                                    <td>
                                        <div style={{ fontSize: '0.9rem' }}>{u.join_date?.split('T')[0] || '-'}</div>
                                        {isResigned && <div style={{ fontSize: '0.8rem', color: '#FF6A3D' }}>~ {u.resignation_date?.split('T')[0]}</div>}
                                    </td>
                                    <td>
                                        <span style={{ color: '#3FAF7A', fontWeight: 'bold' }}>{u.vacation?.remaining_days || 0}일</span>
                                        <span style={{ color: '#888', fontSize: '0.85rem' }}> / {u.vacation?.total_days || 0}일</span>
                                    </td>
                                    <td>
                                        <button className="btn-edit" onClick={() => openModal(u)}>수정</button>
                                        <button className="btn-delete" onClick={() => handleDelete(u.id)}>삭제</button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>검색 결과가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onRefresh={loadUsers} editingUser={editingUser} />
        </div>
    );
};

export default AdminUserView;