// src/components/auth/LoginForm.jsx (수정된 소스)
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService'
import { AuthContext } from '../../context/AuthContext';
import SocialButtons from './SocialButtons';

const LoginForm = () => {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [showKoreanWarning, setShowKoreanWarning] = useState(false);
  const { isLoggedIn, loading, setIsLoggedIn, setUserRole, setUserName, setUserNickname } = useContext(AuthContext);
  const navigate = useNavigate();
  useEffect(() => {
    // 로딩이 끝났고(false), 로그인 상태(true)라면 '/' (또는 '/my/todos') 로 강제 이동
    if (!loading && isLoggedIn) {
      navigate('/'); 
    }
  }, [isLoggedIn, loading, navigate]);
  // ✅ 한글 입력 차단 핸들러
  const handleInputChange = (setter) => (e) => {
    const { value } = e.target;
    // 영문, 숫자, 특수문자만 남기고 한글은 제거
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(value)) {
      setShowKoreanWarning(true);
      
      // 2초 뒤에 경고 메시지 자동으로 숨기기
      setTimeout(() => setShowKoreanWarning(false), 2000);
    }
    const filteredValue = value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
    setter(filteredValue);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await authService.login(id, pw);
      const { success, access_token, userId, userNickname,role, userName } = res.data;
      if (success) {
        localStorage.setItem('accessToken', access_token);
        localStorage.setItem('userId', userId);

        setIsLoggedIn(true);
        setUserNickname(userNickname);
        setUserRole(role);
        setUserName(userName);
        navigate('/my/todos'); 
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || '로그인 중 오류가 발생했습니다.';
      setError(errMsg);
    }
  };

  return (
    // ✅ login-wrapper를 제거하고 login-container만 남깁니다.
    // 기존의 login-wrapper에 있던 배경색과 꽉 찬 높이가 제거되어 부모의 배경 이미지가 보입니다.
    <div className="login-container">
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="login-title">LOGIN</h2>
        {error && <p className="error-message">{error}</p>}
        {showKoreanWarning && (
          <p className="korean-warning" style={{ 
            color: '#ff4d4f', 
            fontSize: '12px', 
            marginBottom: '5px',
            textAlign: 'center',
            fontWeight: 'bold',
            animation: 'shake 0.2s ease-in-out' // 흔들리는 효과(CSS 필요)
          }}>
            ⚠️ 영문 및 숫자만 입력 가능합니다.
          </p>
        )}
        <input
          type="text"              // 브라우저에게 영문 입력을 강력하게 제안
          inputmode="url"         // 모바일 영문 키보드 강제 유도
          spellcheck="false"      // 빨간 밑줄 방지
          autoCapitalize="none"   // 첫 글자 대문자 자동 전환 방지
          placeholder="아이디 (Admin ID)"
          value={id}
          onChange={handleInputChange(setId)} // ✅ 한글 차단 적용
          className="login-input"
          required
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="비밀번호 (Password)"
          value={pw}
          onChange={handleInputChange(setPw)} // ✅ 한글 차단 적용
          className="login-input"
          required
          autoComplete="current-password"
        />
        <button type="submit" className="login-button">로그인</button>
        <SocialButtons />
        <div className="signup-prompt">
          계정이 없으신가요? 
          <button type="button" onClick={() => navigate('/signup')} className="signup-link-btn">
            회원가입
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;