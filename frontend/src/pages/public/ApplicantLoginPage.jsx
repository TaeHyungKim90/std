import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { recruitmentApi } from '../../api/recruitmentApi'; // 🚨 마스터님의 새 api 폴더 구조 반영

const ApplicantLoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loginForm, setLoginForm] = useState({ email_id: '', password: '' });

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await recruitmentApi.loginApplicant(loginForm);
            
            // 로그인 성공 시 세션스토리지에 저장
            sessionStorage.setItem('applicant_user', JSON.stringify(res.data));
            alert(`${res.data.name}님 환영합니다!`);

            // 🌟 이전 페이지(예: 지원하기 버튼 누른 공고)가 있으면 거기로 돌아가고, 없으면 메인으로 이동
            const returnUrl = location.state?.returnUrl || '/careers';
            navigate(returnUrl, { replace: true, state: location.state });
            
        } catch (error) {
            alert(error.response?.data?.detail || "이메일 또는 비밀번호가 일치하지 않습니다.");
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '80px auto', padding: '40px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eaeaea' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#111' }}>지원자 로그인</h2>
            
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                    type="email" 
                    placeholder="이메일 (아이디)" 
                    required 
                    value={loginForm.email_id} 
                    onChange={(e) => setLoginForm({...loginForm, email_id: e.target.value})} 
                    style={{ padding: '14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }} 
                />
                <input 
                    type="password" 
                    placeholder="비밀번호" 
                    required 
                    value={loginForm.password} 
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} 
                    style={{ padding: '14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }} 
                />
                
                <button type="submit" style={{ padding: '15px', background: '#111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'background 0.2s' }}>
                    로그인
                </button>
            </form>
            
            <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.95rem', color: '#666' }}>
                아직 계정이 없으신가요? &nbsp;
                <Link to="/careers/signup" style={{ color: '#4A90E2', textDecoration: 'none', fontWeight: 'bold' }}>회원가입</Link>
            </div>
        </div>
    );
};

export default ApplicantLoginPage;