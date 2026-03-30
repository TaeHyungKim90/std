import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ApplicantProfileModal from './ApplicantProfileModal';

const PublicHeader = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [loggedInUser, setLoggedInUser] = useState(null);

	// 모달 열림/닫힘 상태만 관리
	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

	useEffect(() => {
		const user = sessionStorage.getItem('applicant_user');
		if (user) setLoggedInUser(JSON.parse(user));
		else setLoggedInUser(null);
	}, [location.pathname]);

	const handleLogout = () => {
		sessionStorage.removeItem('applicant_user');
		setLoggedInUser(null);
		Notify.toastSuccess("로그아웃 되었습니다.");
		navigate('/careers');
	};

	return (
		<>
			<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', borderBottom: '1px solid #eaeaea', background: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
					{/* 1. 로고 */}
					<Link to="/careers" style={{ textDecoration: 'none', color: '#111', fontSize: '1.5rem', fontWeight: '900' }}>
						가치플레이 채용
					</Link>

					{/* 2. 공통/권한별 메뉴 */}
					<nav style={{ display: 'flex', gap: '20px', fontWeight: '600' }}>
						<Link to="/careers" style={{ textDecoration: 'none', color: '#333' }}>채용 공고</Link>
						{loggedInUser && (
							<>
								<Link to="/careers/my-applications" style={{ textDecoration: 'none', color: '#333' }}>내 지원 내역</Link>
								{/* <Link to="/careers/resume" style={{ textDecoration: 'none', color: '#333' }}>지원서 관리</Link> */}
							</>
						)}
					</nav>
				</div>

				{/* 3. 로그인 / 로그아웃 버튼 */}
				<div>
					{loggedInUser ? (
						<div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
							{/* 🌟 톱니바퀴 버튼 (클릭 시 모달 상태 true) */}
							<button 
								onClick={() => setIsProfileModalOpen(true)} 
								style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '4px' }}
								onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
								onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
							>
								<span style={{ color: '#4A90E2', fontWeight: 'bold', fontSize: '1.05rem' }}>{loggedInUser.name}님</span>
								<span style={{ fontSize: '1rem' }}>⚙️</span>
							</button>
							
							<button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: '500' }}>로그아웃</button>
						</div>
					) : (
						<button onClick={() => navigate('/careers/login')} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', background: '#111', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
							지원자 로그인
						</button>
					)}
				</div>
			</header>
			{/* 🌟 분리된 모달 컴포넌트를 부착 (Props로 상태와 함수를 넘겨줌) */}
			<ApplicantProfileModal 
				isOpen={isProfileModalOpen} 
				onClose={() => setIsProfileModalOpen(false)} 
				loggedInUser={loggedInUser}
				onUpdateSuccess={setLoggedInUser} // 모달에서 수정 성공 시 헤더의 이름도 즉시 바뀌게 됨
			/>
		</>
	);
};

export default PublicHeader;