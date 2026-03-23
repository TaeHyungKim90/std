import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
//import { recruitmentApi } from '../../api/recruitmentApi'; // API는 백엔드 만들 때 추가

const ApplicantSignupPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email_id: '', password: '', name: '', phone: '' });
    const [agreed, setAgreed] = useState(false); // 🚨 개인정보 동의 상태

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!agreed) return alert("개인정보 수집 및 이용에 동의하셔야 가입이 가능합니다.");

        try {
            // await recruitmentApi.signupApplicant(form); (백엔드 API 연결 시 주석 해제)
            alert("회원가입이 완료되었습니다! 로그인해 주세요.");
            navigate('/careers/login');
        } catch (error) {
            alert("회원가입 실패: " + (error.response?.data?.detail || "오류 발생"));
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '80px auto', padding: '40px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eaeaea' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>지원자 회원가입</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="email" name="email_id" placeholder="이메일 (아이디)" required onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
                <input type="password" name="password" placeholder="비밀번호" required onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
                <input type="text" name="name" placeholder="이름" required onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
                <input type="tel" name="phone" placeholder="연락처 (010-0000-0000)" required onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
                
                {/* 🚨 핵심: 개인정보 동의 체크박스 */}
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '6px', fontSize: '0.85rem', color: '#555', marginTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '2px' }} />
                        <span>
                            <strong>[필수] 개인정보 수집 및 이용 동의</strong><br/>
                            입사 지원 서비스 제공을 위해 귀하의 개인정보를 수집하며, 수집된 정보는 <b>가입일로부터 2년간 보관</b> 후 지체 없이 파기됩니다.
                        </span>
                    </label>
                </div>

                <button type="submit" style={{ padding: '14px', background: '#4A90E2', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                    동의하고 가입하기
                </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' }}>
                이미 계정이 있으신가요? <Link to="/careers/login" style={{ color: '#4A90E2', textDecoration: 'none', fontWeight: 'bold' }}>로그인</Link>
            </div>
        </div>
    );
};

export default ApplicantSignupPage;