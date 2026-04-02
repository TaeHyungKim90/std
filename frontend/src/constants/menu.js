import { PATHS } from 'constants/paths';

export const MENU_ITEMS = [
	{ id: 'calendar', label: '캘린더', path: PATHS.MY_TODOS, adminOnly: false },
	{ id: 'my-reports', label: '내 보고서', path: PATHS.MY_REPORTS, adminOnly: false },
	{ id: 'commute', label: '출퇴근', path: PATHS.MY_ATTENDANCE, adminOnly: false },
	{ id: 'messages', label: '내 수신함', path: PATHS.MY_MESSAGES, adminOnly: false },
	{ id: 'my-profile', label: '내 정보', path: PATHS.MY_PROFILE, adminOnly: false },
	{ id: 'admin', label: '관리모드', path: PATHS.ADMIN_DASHBOARD, adminOnly: true }
  ];
  
  export const ADMIN_SUB_MENU = {
	  HR: {
		  title: '인사관리',
		  items: [
			  { id: 'admin-users', label: '사용자 관리', path: PATHS.ADMIN_USERS },
			  { id: 'admin-attendance', label: '출퇴근 기록', path: PATHS.ADMIN_ATTENDANCE },
			  { id: 'admin-todos', label: '일정 로그', path: PATHS.ADMIN_TODOS },
			  { id: 'admin-reports', label: '보고서 모니터링', path: PATHS.ADMIN_REPORTS },
			  { id: 'admin-messages', label: '메시지 관리', path: PATHS.ADMIN_MESSAGES }, 
		  ]
	  },
	  RECRUITMENT: {
		  title: '채용관리',
		  items: [
			  { id: 'admin-recruitment', label: '채용 공고 관리', path: PATHS.ADMIN_RECRUITMENT },
			  { id: 'admin-applicants', label: '지원 현황 관리', path: PATHS.ADMIN_APPLICANTS },
			  // 나중에 지원자 통합 검색이나 통계 페이지를 추가할 수 있습니다.
		  ]
	  },
	  MGMT: {
		  title: '시스템관리',
		  items: [		   
			  { id: 'admin-categories', label: '카테고리 관리', path: PATHS.ADMIN_CATEGORIES },
			  { id: 'admin-departments', label: '부서 관리', path: PATHS.ADMIN_DEPARTMENTS },
			  { id: 'admin-positions', label: '직급 관리', path: PATHS.ADMIN_POSITIONS },
			  { id: 'admin-holidays', label: '공휴일 관리', path: PATHS.ADMIN_HOLIDAYS },
			  // 뒷부분 생략된 기존 메뉴들 (holidays 등) 그대로 유지하시면 됩니다!
		  ]
	  }
  };