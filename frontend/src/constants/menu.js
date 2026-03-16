export const MENU_ITEMS = [
  { id: 'calendar', label: '캘린더', path: '/my/todos', adminOnly: false },
  { id: 'commute', label: '출퇴근', path: '/my/attendance', adminOnly: false },
  { id: 'admin', label: '관리모드', path: '/admin/dashboard', adminOnly: true }
];

export const ADMIN_SUB_MENU = {
    HR: {
        title: '인사관리',
        items: [
            { id: 'admin-attendance', label: '출퇴근 기록', path: '/admin/attendance' },
            { id: 'admin-todos', label: '일정 로그', path: '/admin/todos' },
        ]
    },
    MGMT: {
        title: '시스템관리',
        items: [
            { id: 'admin-users', label: '사용자 관리', path: '/admin/users' },
            { id: 'admin-categories', label: '카테고리 관리', path: '/admin/categories' },
            { id: 'admin-holidays', label: '공휴일 관리', path: '/admin/holidays' },
        ]
    }
};