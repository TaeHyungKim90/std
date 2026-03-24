import React, { useState, useEffect } from 'react';
import { recruitmentApi } from 'api/recruitmentApi';

const ApplicantProfileModal = ({ isOpen, onClose, loggedInUser, onUpdateSuccess }) => {
    // 내부 폼 상태
    const [profileForm, setProfileForm] = useState({ name: '', phone: '', password: '' });

    // 모달이 열릴 때마다 로그인된 유저의 최신 정보를 폼에 세팅
    useEffect(() => {
        if (isOpen && loggedInUser) {
            setProfileForm({
                name: loggedInUser.name || '',
                phone: loggedInUser.phone || '',
                password: '' // 비밀번호는 보안상 항상 빈 칸으로 시작
            });
        }
    }, [isOpen, loggedInUser]);

    // 모달이 닫혀있거나 유저 정보가 없으면 안 그림(렌더링 X)
    if (!isOpen || !loggedInUser) return null;

    // 정보 수정 제출 로직
    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await recruitmentApi.updateApplicant(loggedInUser.id, profileForm);
            
            // 성공 시 세션 업데이트
            sessionStorage.setItem('applicant_user', JSON.stringify(res.data));
            
            // 헤더(부모)에게 갱신된 유저 정보 전달
            onUpdateSuccess(res.data);
            //  "정보가 변경되었다"는 커스텀 이벤트를 브라우저에 방송합니다!
            window.dispatchEvent(new Event('applicantProfileUpdated'));
            alert("회원 정보가 성공적으로 변경되었습니다.");
            onClose(); // 모달 닫기
        } catch (error) {
            alert(error.response?.data?.detail || "정보 수정에 실패했습니다.");
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '30px 40px', borderRadius: '12px', width: '380px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginTop: 0, marginBottom: '25px', textAlign: 'center', color: '#111' }}>내 정보 수정</h2>
                
                <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>이메일 (아이디)</label>
                        <input type="email" value={loggedInUser.email_id} disabled style={{ width: '100%', padding: '12px', border: '1px solid #eee', borderRadius: '6px', background: '#f9fafb', color: '#999', boxSizing: 'border-box' }} />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>이름</label>
                        <input type="text" value={profileForm.name} required onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>연락처</label>
                        <input type="tel" value={profileForm.phone} required onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>새 비밀번호 (변경 시에만 입력)</label>
                        <input type="password" placeholder="변경할 비밀번호 입력" value={profileForm.password} onChange={(e) => setProfileForm({...profileForm, password: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '14px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
                        <button type="submit" style={{ flex: 1, padding: '14px', background: '#4A90E2', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>저장하기</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApplicantProfileModal;