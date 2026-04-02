import 'assets/css/sidebar.css'; // 새로운 사이드바 CSS 연결

import { ADMIN_SUB_MENU } from 'constants/menu';
import { PATH_PREFIX } from 'constants/paths';
import React from 'react';
import { useLocation,useNavigate } from 'react-router-dom';

const Sidebar = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const currentPath = location.pathname;

	// 관리자 경로(/admin)가 아닐 때는 사이드바를 숨김 (화면 넓게 쓰기)
	if (!currentPath.startsWith(PATH_PREFIX.ADMIN)) return null;

	// 메뉴 렌더링을 위한 헬퍼 함수
	const renderMenuGroup = (group) => (
		<div className="sidebar-group" key={group.title}>
			<div className="sidebar-group-title">{group.title}</div>
			<div className="sidebar-group-items">
				{group.items.map(item => (
					<div 
						key={item.id}
						className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
						onClick={() => navigate(item.path)}
					>
						{item.label}
					</div>
				))}
			</div>
		</div>
	);

	return (
		<aside className="admin-sidebar">
			<div className="sidebar-inner">
				{renderMenuGroup(ADMIN_SUB_MENU.HR)}
				<div className="sidebar-divider"></div>
				{renderMenuGroup(ADMIN_SUB_MENU.RECRUITMENT)}
				<div className="sidebar-divider"></div>
				{renderMenuGroup(ADMIN_SUB_MENU.MGMT)}
			</div>
		</aside>
	);
};

export default Sidebar;