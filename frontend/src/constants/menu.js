/** 테넌트별 메뉴 경로 — paths는 pathsForTenant(slug) 결과 */
export function menuItemsFor(paths) {
	return [
		{ id: 'calendar', label: '캘린더', path: paths.MY_TODOS, adminOnly: false },
		{ id: 'my-reports', label: '내 보고서', path: paths.MY_REPORTS, adminOnly: false },
		{ id: 'commute', label: '출퇴근', path: paths.MY_ATTENDANCE, adminOnly: false },
		{ id: 'messages', label: '내 수신함', path: paths.MY_MESSAGES, adminOnly: false },
		{ id: 'my-profile', label: '내 정보', path: paths.MY_PROFILE, adminOnly: false },
		{ id: 'admin', label: '관리모드', path: paths.ADMIN_DASHBOARD, adminOnly: true },
	];
}

export function adminSubMenuFor(paths) {
	return {
		HR: {
			title: '인사관리',
			items: [
				{ id: 'admin-users', label: '사용자 관리', path: paths.ADMIN_USERS },
				{ id: 'admin-attendance', label: '출퇴근 기록', path: paths.ADMIN_ATTENDANCE },
				{
					id: 'admin-attendance-rewards',
					label: '출퇴근 가산점',
					path: paths.ADMIN_ATTENDANCE_REWARDS,
				},
				{ id: 'admin-todos', label: '일정 로그', path: paths.ADMIN_TODOS },
				{ id: 'admin-reports', label: '보고서 모니터링', path: paths.ADMIN_REPORTS },
				{ id: 'admin-messages', label: '메시지 관리', path: paths.ADMIN_MESSAGES },
			],
		},
		RECRUITMENT: {
			title: '채용관리',
			items: [
				{ id: 'admin-recruitment', label: '채용 공고 관리', path: paths.ADMIN_RECRUITMENT },
				{
					id: 'admin-resume-templates',
					label: '이력서 템플릿',
					path: paths.ADMIN_RESUME_TEMPLATES,
				},
				{ id: 'admin-applicants', label: '지원 현황 관리', path: paths.ADMIN_APPLICANTS },
			],
		},
		MGMT: {
			title: '시스템관리',
			items: [
				{ id: 'admin-categories', label: '카테고리 관리', path: paths.ADMIN_CATEGORIES },
				{ id: 'admin-departments', label: '부서 관리', path: paths.ADMIN_DEPARTMENTS },
				{ id: 'admin-positions', label: '직급 관리', path: paths.ADMIN_POSITIONS },
				{
					id: 'admin-work-locations',
					label: '근무장소 관리',
					path: paths.ADMIN_WORK_LOCATIONS,
				},
				{ id: 'admin-holidays', label: '공휴일 관리', path: paths.ADMIN_HOLIDAYS },
			],
		},
	};
}
