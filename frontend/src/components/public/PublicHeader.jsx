import 'assets/css/publicHeader.css';

import { recruitmentApi } from 'api/recruitmentApi';
import { PATHS } from 'constants/paths';
import { useApplicantSession } from 'hooks/useApplicantSession';
import React, { useState } from 'react';
import { Link, useLocation,useNavigate } from 'react-router-dom';
import * as Notify from 'utils/toastUtils';

import ApplicantProfileModal from './ApplicantProfileModal';

const PublicHeader = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { user: loggedInUser, setUser, clearSession } = useApplicantSession(location.pathname);

	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

	const handleLogout = () => {
		Notify.toastPromise(
			recruitmentApi.logoutApplicant(),
			{
				loading: '로그아웃 중입니다...',
				success: '로그아웃 되었습니다.',
				error: '로그아웃에 실패했습니다.',
			}
		).finally(() => {
			clearSession();
			navigate(PATHS.CAREERS);
		});
	};

	return (
		<>
			<header className="public-header">
				<div className="public-header__inner">
					<div className="public-header__brand-nav">
					<Link to={PATHS.CAREERS} className="public-header__logo-link">
						가치플레이 채용
					</Link>

					<nav className="public-header__nav">
						<Link to={PATHS.CAREERS} className="public-header__nav-link">채용 공고</Link>
						{loggedInUser && (
							<>
								<Link to={PATHS.CAREERS_MY_APPLICATIONS} className="public-header__nav-link">내 지원 내역</Link>
							</>
						)}
					</nav>
				</div>

					<div className="public-header__actions-wrap">
						{loggedInUser ? (
							<div className="public-header__actions">
								<button
									type="button"
									onClick={() => setIsProfileModalOpen(true)}
									className="public-header__profile-btn"
								>
									<span className="public-header__user-name">{loggedInUser.name}님</span>
									<span className="public-header__gear" aria-hidden>
										⚙️
									</span>
								</button>

								<button type="button" onClick={handleLogout} className="public-header__btn-logout">
									로그아웃
								</button>
							</div>
						) : (
							<button type="button" onClick={() => navigate(PATHS.CAREERS_LOGIN)} className="public-header__btn-login">
								지원자 로그인
							</button>
						)}
					</div>
				</div>
			</header>
			<ApplicantProfileModal
				isOpen={isProfileModalOpen}
				onClose={() => setIsProfileModalOpen(false)}
				loggedInUser={loggedInUser}
				onUpdateSuccess={setUser}
			/>
		</>
	);
};

export default PublicHeader;
