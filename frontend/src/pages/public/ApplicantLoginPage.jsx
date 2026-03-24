import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { recruitmentApi } from '../../api/recruitmentApi'; 

const ApplicantLoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loginForm, setLoginForm] = useState({ email_id: '', password: '' });

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await recruitmentApi.loginApplicant(loginForm);
            sessionStorage.setItem('applicant_user', JSON.stringify(res.data));
            alert(`${res.data.name}님 환영합니다!`);

            const returnUrl = location.state?.returnUrl || '/careers';
            navigate(returnUrl, { replace: true, state: location.state });
        } catch (error) {
            alert(error.response?.data?.detail || "이메일 또는 비밀번호가 일치하지 않습니다.");
        }
    };

    return (
        <div className="careers-content-wrapper auth-center-wrapper"> 
            <div className="glass-box auth-glass-box">
                <h2>Gachi 지원자 로그인</h2>
                
                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="email" 
                        placeholder="이메일 입력" 
                        required 
                        value={loginForm.email_id} 
                        onChange={(e) => setLoginForm({...loginForm, email_id: e.target.value})} 
                        style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', fontSize: '1rem', background: 'rgba(255,255,255,0.9)' }}
                    />
                    <input 
                        type="password" 
                        placeholder="비밀번호" 
                        required 
                        value={loginForm.password} 
                        onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} 
                        style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', fontSize: '1rem', background: 'rgba(255,255,255,0.9)' }} 
                    />
                    
                    <button type="submit" style={{ padding: '15px', background: '#3FAF7A', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'all 0.2s' }}>
                        로그인
                    </button>
                </form>
                
                <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.95rem', color: '#444' }}>
                    아직 계정이 없으신가요? &nbsp;
                    <Link to="/careers/signup" style={{ color: '#3FAF7A', textDecoration: 'none', fontWeight: 'bold' }}>회원가입</Link>
                </div>
            </div>
        </div>
    );
};

export default ApplicantLoginPage;