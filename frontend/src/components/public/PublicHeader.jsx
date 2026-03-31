import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ApplicantProfileModal from './ApplicantProfileModal';
import 'assets/css/publicHeader.css';
import { PATHS } from 'constants/paths';

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
		navigate(PATHS.CAREERS);
	};

	return (
		<>
			<header className="public-header">
				<div className="public-header__brand-nav">
					{/* 1. 로고 */}
					<Link to={PATHS.CAREERS} className="public-header__logo-link">
						가치플레이 채용
					</Link>

					{/* 2. 공통/권한별 메뉴 */}
					<nav className="public-header__nav">
						<Link to={PATHS.CAREERS} className="public-header__nav-link">채용 공고</Link>
						{loggedInUser && (
							<>
								<Link to={PATHS.CAREERS_MY_APPLICATIONS} className="public-header__nav-link">내 지원 내역</Link>
								{/* <Link to="/careers/resume" className="public-header__nav-link">지원서 관리</Link> */}
							</>
						)}
					</nav>
				</div>

				{/* 3. 로그인 / 로그아웃 버튼 */}
				<div>
					{loggedInUser ? (
						<div className="public-header__actions">
							{/* 🌟 톱니바퀴 버튼 (클릭 시 모달 상태 true) */}
							<button 
								type="button"
								onClick={() => setIsProfileModalOpen(true)} 
								className="public-header__profile-btn"
							>
								<span className="public-header__user-name">{loggedInUser.name}님</span>
								<span className="public-header__gear" aria-hidden>⚙️</span>
							</button>
							
							<button type="button" onClick={handleLogout} className="public-header__btn-logout">로그아웃</button>
						</div>
					) : (
						<button type="button" onClick={() => navigate(PATHS.CAREERS_LOGIN)} className="public-header__btn-login">
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