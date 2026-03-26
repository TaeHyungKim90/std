export const MENU_ITEMS = [
    { id: 'calendar', label: '캘린더', path: '/my/todos', adminOnly: false },
    { id: 'commute', label: '출퇴근', path: '/my/attendance', adminOnly: false },
    { id: 'messages', label: '내 수신함', path: '/my/messages', adminOnly: false },
    { id: 'admin', label: '관리모드', path: '/admin/dashboard', adminOnly: true }
  ];
  
  export const ADMIN_SUB_MENU = {
      HR: {
          title: '인사관리',
          items: [
              { id: 'admin-users', label: '사용자 관리', path: '/admin/users' },
              { id: 'admin-attendance', label: '출퇴근 기록', path: '/admin/attendance' },
              { id: 'admin-todos', label: '일정 로그', path: '/admin/todos' },
              { id: 'admin-messages', label: '메시지 관리', path: '/admin/messages' }, 
          ]
      },
      RECRUITMENT: {
          title: '채용관리',
          items: [
              { id: 'admin-recruitment', label: '채용 공고 관리', path: '/admin/recruitment' },
              { id: 'admin-applicants', label: '지원 현황 관리', path: '/admin/applicants' },
              // 나중에 지원자 통합 검색이나 통계 페이지를 추가할 수 있습니다.
          ]
      },
      MGMT: {
          title: '시스템관리',
          items: [           
              { id: 'admin-categories', label: '카테고리 관리', path: '/admin/categories' },
              // 뒷부분 생략된 기존 메뉴들 (holidays 등) 그대로 유지하시면 됩니다!
          ]
      }
  };