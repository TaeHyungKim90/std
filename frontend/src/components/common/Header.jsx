// src/components/layout/Header.js
import UserAvatar from 'components/common/UserAvatar';
import { menuItemsFor } from 'constants/menu';
import { DEFAULT_BRANDING_LOGO_SRC } from 'constants/tenantBranding';
import { AuthContext } from 'context/AuthContext';
import { useTenant } from 'context/TenantContext';
import React, { useContext, useEffect, useState } from 'react';
import { Link,useLocation, useNavigate } from 'react-router-dom';
import * as Notify from 'utils/toastUtils';

const Header = () => {
	const { paths, tenantName, logoUrl } = useTenant();
	const menuItems = menuItemsFor(paths);
	const { isLoggedIn, logout, userNickname, userRole, userName, userProfileImageUrl, userProfileImageCacheBust, userAvatarAdjust } = useContext(AuthContext);
	const navigate = useNavigate();
	const location = useLocation();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const isAdmin = userRole === 'admin';

	const currentPath = location.pathname;
	const isAdminMode = currentPath.startsWith(paths.PATH_PREFIX.ADMIN);
	const mobileMenuItems = menuItems.filter((item) => !item.adminOnly || isAdmin);
	const quickActions = [
		{ id: 'quick-attendance', label: '출퇴근', icon: '⏱', path: paths.MY_ATTENDANCE },
		{ id: 'quick-report', label: '보고서', icon: '📝', path: paths.MY_REPORTS },
		{ id: 'quick-todos', label: '일정', icon: '📅', path: paths.MY_TODOS },
	];

	useEffect(() => {
		setIsMobileMenuOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		if (!isMobileMenuOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key === 'Escape') setIsMobileMenuOpen(false);
		};

		document.addEventListener('keydown', handleEscape);
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', handleEscape);
			document.body.style.overflow = '';
		};
	}, [isMobileMenuOpen]);

	const handleLogout = async () => {
		if (isLoggingOut) return;
		if (!window.confirm("로그아웃 하시겠습니까?")) return;

		setIsMobileMenuOpen(false);
		setIsLoggingOut(true);
		logout()
			.then(() => {
				navigate(paths.LOGIN);
			})
			.catch((err) => {
				Notify.toastApiFailure(err, "로그아웃 실패");
			})
			.finally(() => {
				setIsLoggingOut(false);
			});
	};

	if (!isLoggedIn) return null;

	return (
		<header className="modern-header-wrapper">
			<div className="modern-gnb">
					<div className="gnb-left">
						<div onClick={() => navigate(paths.MY_TODOS)} className="bq-logo">
							<img
								src={logoUrl}
								alt={`${tenantName} 로고`}
								className="bq-logo-img"
								onError={(e) => {
									e.currentTarget.onerror = null;
									e.currentTarget.src = DEFAULT_BRANDING_LOGO_SRC;
								}}
							/>
							<div className="bq-logo-text-group">
								<span className="bq-logo-main">{tenantName}</span>
								<span className="bq-logo-sub">HR</span>
							</div>
						</div>

						<nav className="gnb-nav">
							{menuItems.map((item) => {
								if (item.adminOnly && !isAdmin) return null;
								const isActive = item.id === 'admin' ? isAdminMode : currentPath.startsWith(item.path);

								return (
									<Link key={item.id} to={item.path} className={`gnb-item ${isActive ? 'active' : ''}`}>
										{item.label}
									</Link>
								);
							})}
						</nav>
					</div>

					<div className="gnb-right">
						<div className="bq-user-info">
							{userProfileImageUrl ? (
								<UserAvatar
									imageUrl={userProfileImageUrl}
									nickname={userNickname}
									name={userName}
									size={24}
									className="bq-user-avatar"
									avatarAdjust={userAvatarAdjust}
									imageCacheBust={userProfileImageCacheBust > 0 ? userProfileImageCacheBust : undefined}
								/>
							) : (
								<div className="bq-status-dot"></div>
							)}
							<span className="user-name-text">
								{userNickname || userName}
								{userNickname && userName && userNickname !== userName ? `(${userName})` : ''} 님
							</span>
						</div>
						<button onClick={handleLogout} className="bq-btn-logout" disabled={isLoggingOut}>
							{isLoggingOut ? '처리중...' : '로그아웃'}
						</button>
						<button
							type="button"
							className={`bq-mobile-menu-trigger ${isMobileMenuOpen ? 'is-open' : ''}`}
							aria-label="모바일 메뉴 열기"
							aria-expanded={isMobileMenuOpen}
							onClick={() => setIsMobileMenuOpen((prev) => !prev)}
						>
							<span />
							<span />
							<span />
						</button>
					</div>
			</div>
			<div
				className={`bq-mobile-drawer-overlay ${isMobileMenuOpen ? 'is-open' : ''}`}
				onClick={() => setIsMobileMenuOpen(false)}
				role="presentation"
			>
				<aside
					className={`bq-mobile-drawer ${isMobileMenuOpen ? 'is-open' : ''}`}
					role="dialog"
					aria-modal="true"
					aria-label="모바일 네비게이션"
					onClick={(event) => event.stopPropagation()}
				>
					<div className="bq-mobile-drawer-header">
						<div className="bq-mobile-drawer-user">
							{userProfileImageUrl ? (
								<UserAvatar
									imageUrl={userProfileImageUrl}
									nickname={userNickname}
									name={userName}
									size={28}
									className="bq-user-avatar"
									avatarAdjust={userAvatarAdjust}
									imageCacheBust={userProfileImageCacheBust > 0 ? userProfileImageCacheBust : undefined}
								/>
							) : (
								<div className="bq-status-dot" />
							)}
							<div className="bq-mobile-drawer-user-text">
								<span>{userNickname || userName}</span>
								{userNickname && userName && userNickname !== userName ? (
									<small>{userName}</small>
								) : null}
							</div>
						</div>
						<div className="bq-mobile-drawer-header-actions">
							<button type="button" className="bq-mobile-drawer-header-logout" disabled={isLoggingOut} onClick={handleLogout}>
								{isLoggingOut ? '처리중…' : '로그아웃'}
							</button>
							<button
								type="button"
								className="bq-mobile-drawer-close"
								aria-label="모바일 메뉴 닫기"
								onClick={() => setIsMobileMenuOpen(false)}
							>
								닫기
							</button>
						</div>
					</div>
					<div className="bq-mobile-drawer-body">
						<nav className="bq-mobile-drawer-nav">
							{mobileMenuItems.map((item) => {
								const isActive = item.id === 'admin' ? isAdminMode : currentPath.startsWith(item.path);
								return (
									<Link
										key={item.id}
										to={item.path}
										className={`bq-mobile-drawer-item ${isActive ? 'active' : ''}`}
									>
										{item.label}
									</Link>
								);
							})}
						</nav>
						<div className="bq-mobile-quick-actions">
							<div className="bq-mobile-quick-actions-title">빠른 액션</div>
							<div className="bq-mobile-quick-actions-grid">
								{quickActions.map((action) => (
									<Link key={action.id} to={action.path} className="bq-mobile-quick-action-btn">
										<span className="bq-mobile-quick-action-icon" aria-hidden="true">
											{action.icon}
										</span>
										{action.label}
									</Link>
								))}
							</div>
						</div>
					</div>
				</aside>
			</div>
		</header>
	);
};

export default Header;