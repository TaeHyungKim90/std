import 'assets/css/admin-user-profile-extra.css';

import { adminApi } from 'api/adminApi';
import UserModal from 'components/admin/UserModal';
import IdCopyChip from 'components/common/IdCopyChip';
import UserAvatar from 'components/common/UserAvatar';
import { useLoading } from 'context/LoadingContext';
import React, { useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';
const AdminUser = () => {
    const { showLoading, hideLoading } = useLoading();
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState(''); // ✅ 검색어 상태 추가
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const loadUsers = async () => {
        const res = await adminApi.getUsers();
        setUsers(res.data);
    };

    const refreshUsers = () =>
        loadUsers().catch((err) => {
            Notify.toastApiFailure(err, "사용자 목록을 불러오지 못했습니다.");
        });

    useEffect(() => {
        showLoading("사용자 목록을 불러오는 중입니다... ⏳");
        loadUsers()
            .catch((err) => {
                Notify.toastApiFailure(err, "사용자 목록을 불러오지 못했습니다.");
            })
            .finally(() => hideLoading());
    }, [showLoading, hideLoading]);

    const openModal = (user = null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (userId) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            Notify.toastPromise(adminApi.deleteUser(userId), {
                loading: '사용자를 삭제하는 중입니다...',
                success: '사용자가 삭제되었습니다.',
                error: '삭제에 실패했습니다.'
            }).then(() => {
                loadUsers();
            }).catch((err) => {
                console.error("삭제 실패", err);
            });
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
                <div className="admin-user__header-toolbar">
                    {/* ✅ 실시간 검색창 추가 */}
                    <input 
                        type="text" 
                        placeholder="이름 또는 아이디 검색..." 
                        className="bq-input admin-user__search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button 
                        className="btn-primary btn-primary--sync-blue" 
                        onClick={async () => {
                            if(!window.confirm("현재 날짜를 기준으로 모든 직원의 연차를 정산하시겠습니까?")) return;
                            Notify.toastPromise(adminApi.syncVacations(), {
                                loading: '연차를 일괄 정산하는 중입니다...',
                                success: '연차 정산이 완료되었습니다.',
                                error: '정산에 실패했습니다.'
                            }).then((res) => {
                                if (res.data?.message) {
                                    Notify.toastInfo(res.data.message);
                                }
                                refreshUsers();
                            }).catch((err) => {
                                console.error("정산 실패", err);
                            });
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
                        {filteredUsers.length > 0 ? filteredUsers.map((u, index) => {
                            const isResigned = !!u.resignation_date; // ✅ 퇴사자 여부 확인
                            
                            return (
                                // ✅ 퇴사자는 투명도를 주고 배경색을 어둡게 처리
                                <tr
                                    key={u.id}
                                    className={`stagger-item admin-user__row${isResigned ? ' admin-user__row--resigned' : ''}`}
                                    style={{ animationDelay: `${index * 0.04}s` }}
                                >
                                    <td className="admin-table__cell-login">
										<IdCopyChip value={u.user_login_id} compact />
									</td>
                                    <td className="admin-user__name-cell">
										<div className="admin-user__name-wrap">
											<UserAvatar
												imageUrl={u.user_profile_image_url || null}
												nickname={u.user_nickname || null}
												name={u.user_name || null}
												size={34}
											/>
											<div>
												<div>
													{u.user_name}
													{isResigned && <span className="admin-user__resigned-tag">(퇴사)</span>}
												</div>
												<div className="admin-user__deptpos">
													{u.user_department || '-'} · {u.user_position || '-'}
												</div>
											</div>
										</div>
                                    </td>
                                    <td>{u.user_nickname || '-'}</td>
                                    <td>{u.user_phone_number || '-'}</td>
                                    <td>
                                        <span className={`role-badge ${u.role}`}>{u.role}</span>
                                    </td>
                                    <td>{u.created_at?.split('T')[0]}</td>
                                    <td>
                                        <div className="admin-user__join-date">{u.join_date?.split('T')[0] || '-'}</div>
                                        {isResigned && <div className="admin-user__resign-date">~ {u.resignation_date?.split('T')[0]}</div>}
                                    </td>
                                    <td>
                                        <span className="admin-user__vac-remain">{u.vacation?.remaining_days || 0}일</span>
                                        <span className="admin-user__vac-total"> / {u.vacation?.total_days || 0}일</span>
                                    </td>
                                    <td>
                                        <button className="btn-edit" onClick={() => openModal(u)}>수정</button>
                                        <button className="btn-delete" onClick={() => handleDelete(u.id)}>삭제</button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan={9} className="admin-table__empty">검색 결과가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onRefresh={refreshUsers} editingUser={editingUser} />
        </div>
    );
};

export default AdminUser;