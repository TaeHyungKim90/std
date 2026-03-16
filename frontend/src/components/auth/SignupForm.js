import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService'
import SocialButtons from './SocialButtons';

const SignupForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    user_login_id: '',
    user_password: '',
    password_confirm: '',
    user_name: '',
    user_nickname: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // ✅ 아이디 중복 확인 상태 (null: 확인 전, 'available': 사용 가능, 'duplicate': 중복)
  const [idStatus, setIdStatus] = useState(null); 

  const handleNoKoreanChange = (e) => {
    const { name, value } = e.target;
    const filteredValue = value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
    setFormData({ ...formData, [name]: filteredValue });
    
    // 아이디를 다시 수정하면 중복 확인 상태를 초기화
    if (name === 'user_login_id') setIdStatus(null); 
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // ✅ 아이디 중복 확인 요청
  const handleCheckId = async () => {
    if (!formData.user_login_id) {
        return alert('아이디를 먼저 입력해 주세요.');
    }
    
    try {
        // 백엔드 중복 확인 API (주소는 백엔드 설계에 맞게 수정 필요)
        const res = await authService.checkId(formData.user_login_id);
        
        if (res.data.available) {
            setIdStatus('available');
        } else {
            setIdStatus('duplicate');
        }
    } catch (err) {
        // 백엔드가 아직 없거나 에러 시 임시 처리 (테스트용)
        console.warn("중복 확인 API 연동 필요:", err);
        // 임시로 성공 처리 (백엔드 연결 시 아래 두 줄 삭제)
        alert('백엔드 연동 전 임시 성공 처리');
        setIdStatus('available');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (idStatus !== 'available') {
        return setError('아이디 중복 확인을 진행해 주세요.');
    }

    if (formData.user_password !== formData.password_confirm) {
      return setError('비밀번호가 일치하지 않습니다.');
    }

    try {
      setLoading(true);
      const { password_confirm, ...submitData } = formData;
      await authService.signup(submitData); 
      
      alert('가치플레이 회원이 되신 것을 환영합니다! 로그인을 진행해 주세요.');
      navigate('/login'); 
    } catch (err) {
      setError(err.response?.data?.detail || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };


  // 비밀번호 실시간 일치 여부 체크
  const isPasswordMatching = formData.user_password && formData.password_confirm && formData.user_password === formData.password_confirm;

  return (
    <div className="login-container">
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="login-title">SIGN UP</h2>
        
        {error && <p className="error-message">{error}</p>}
        
        {/* ✅ 아이디 입력 및 중복 확인 그룹 */}
        <div className="input-group">
            <input 
                type="text" 
                name="user_login_id" 
                placeholder="아이디 (영문/숫자)" 
                value={formData.user_login_id} 
                onChange={handleNoKoreanChange} 
                className="login-input" 
                required 
            />
            <button type="button" onClick={handleCheckId} className="btn-check-id">중복 확인</button>
        </div>
        
        {/* 아이디 중복 확인 메시지 */}
        {idStatus === 'available' && <div className="status-message" style={{ color: '#3DAF7A' }}>✅ 사용 가능한 아이디입니다.</div>}
        {idStatus === 'duplicate' && <div className="status-message" style={{ color: '#FF6A3D' }}>❌ 이미 사용 중인 아이디입니다.</div>}

        <input type="password" name="user_password" placeholder="비밀번호" value={formData.user_password} onChange={handleNoKoreanChange} className="login-input" required />
        <input type="password" name="password_confirm" placeholder="비밀번호 확인" value={formData.password_confirm} onChange={handleNoKoreanChange} className="login-input" required style={{ marginBottom: isPasswordMatching ? '5px' : '15px' }} />
        
        {/* 비밀번호 일치 메시지 */}
        {isPasswordMatching && <div className="status-message" style={{ color: '#3DAF7A' }}>✅ 비밀번호가 일치합니다.</div>}

        <input type="text" name="user_name" placeholder="이름 (실명)" value={formData.user_name} onChange={handleChange} className="login-input" required />
        <input type="text" name="user_nickname" placeholder="닉네임" value={formData.user_nickname} onChange={handleChange} className="login-input" required/>
        
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? '가입 처리 중...' : '가입하기'}
        </button>
        <SocialButtons />

        <div className="signup-prompt">
          이미 계정이 있으신가요? 
          <button type="button" onClick={() => navigate('/login')} className="signup-link-btn">
            로그인하기
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignupForm;