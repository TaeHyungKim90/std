import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import '../../assets/css/admin.css'; // 이미지의 css 경로 반영

const AdminUserView = () => {
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        user_login_id: '', user_password: '', user_name: '', user_nickname: '', role: 'user'
    });

    const loadUsers = async () => {
        try {
            const res = await adminService.getUsers();
            setUsers(res.data);
        } catch (err) { console.error("유저 로드 실패", err); }
    };

    useEffect(() => { loadUsers(); }, []);

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({ ...user, user_password: '' }); // 비밀번호는 수정 시에만 입력
        } else {
            setEditingUser(null);
            setFormData({ user_login_id: '', user_password: '', user_name: '', user_nickname: '', role: 'user' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // 수정 시 아이디는 보낼 수 없음
                const { user_login_id, ...updateData } = formData;
                await adminService.updateUser(editingUser.id, updateData);
            } else {
                await adminService.createUser(formData);
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (err) { alert(err.response?.data?.detail || "저장 실패"); }
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
                <button className="btn-primary" onClick={() => openModal()}>신규 등록</button>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>아이디</th><th>성명</th><th>닉네임</th><th>권한</th><th>가입일</th><th>작업</th>
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
                                <td>
                                    <button className="btn-edit" onClick={() => openModal(u)}>수정</button>
                                    <button className="btn-delete" onClick={() => handleDelete(u.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{editingUser ? "정보 수정" : "사용자 등록"}</h3>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label>아이디</label>
                                <input 
                                    value={formData.user_login_id} 
                                    disabled={!!editingUser} // 아이디 수정 불가
                                    onChange={e => setFormData({...formData, user_login_id: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>{editingUser ? "비밀번호 (변경 시에만 입력)" : "비밀번호"}</label>
                                <input 
                                    type="password" 
                                    value={formData.user_password} 
                                    onChange={e => setFormData({...formData, user_password: e.target.value})}
                                    required={!editingUser} 
                                />
                            </div>
                            <div className="form-group">
                                <label>성명</label>
                                <input 
                                    value={formData.user_name} 
                                    onChange={e => setFormData({...formData, user_name: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>닉네임</label>
                                <input 
                                    value={formData.user_nickname || ''} 
                                    onChange={e => setFormData({...formData, user_nickname: e.target.value})}
                                    placeholder="닉네임을 입력하세요"
                                />
                            </div>
                            <div className="form-group">
                                <label>권한</label>
                                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                    <option value="user">사용자</option>
                                    <option value="admin">관리자</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn-save">저장</button>
                                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>닫기</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUserView;