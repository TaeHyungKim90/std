import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi'; 

const ApplicantSignupPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email_id: '', password: '', name: '', phone: '' });
    const [agreed, setAgreed] = useState(false); 

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!agreed) return alert("개인정보 수집 및 이용에 동의하셔야 가입이 가능합니다.");

        try {
            await recruitmentApi.signupApplicant(form); 
            alert("회원가입이 완료되었습니다! 로그인해 주세요.");
            navigate('/careers/login');
        } catch (error) {
            alert("회원가입 실패: " + (error.response?.data?.detail || "오류 발생"));
        }
    };

    return (
        <div className="careers-content-wrapper auth-center-wrapper">
            <div className="glass-box auth-glass-box" style={{ maxWidth: '500px' }}>
                <h2>지원자 회원가입</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input type="text" name="name" placeholder="이름" required onChange={handleChange} style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', background: 'rgba(255,255,255,0.9)' }} />
                    <input type="email" name="email_id" placeholder="이메일" required onChange={handleChange} style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', background: 'rgba(255,255,255,0.9)' }} />
                    <input type="password" name="password" placeholder="비밀번호" required onChange={handleChange} style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', background: 'rgba(255,255,255,0.9)' }} />
                    <input type="tel" name="phone" placeholder="연락처 (010-0000-0000)" required onChange={handleChange} style={{ padding: '14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', background: 'rgba(255,255,255,0.9)' }} />
                    
                    <div style={{ background: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '10px', fontSize: '0.85rem', color: '#444', marginTop: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '2px' }} />
                            <span>
                                <strong>[필수] 개인정보 수집 및 이용 동의</strong><br/>
                                입사 지원 서비스 제공을 위해 귀하의 개인정보를 수집하며, 수집된 정보는 <b>가입일로부터 2년간 보관</b> 후 지체 없이 파기됩니다.
                            </span>
                        </label>
                    </div>

                    <button type="submit" style={{ padding: '15px', background: '#3FAF7A', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'all 0.2s' }}>
                        동의하고 가입하기
                    </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.95rem', color: '#444' }}>
                    이미 계정이 있으신가요? <Link to="/careers/login" style={{ color: '#3FAF7A', textDecoration: 'none', fontWeight: 'bold' }}>로그인하기</Link>
                </div>
            </div>
        </div>
    );
};

export default ApplicantSignupPage;