/**
 * 앱 내 라우트 경로 (Link to / navigate / window.location 등).
 * 경로 변경 시 이 파일만 수정하면 됩니다.
 */

const MY = '/my';
const ADMIN = '/admin';
const CAREERS = '/careers';

export const PATHS = {
	HOME: '/',
	LOGIN: '/login',
	SIGNUP: '/signup',
	OAUTH_CALLBACK: '/oauth/callback',
	MY_TODOS: `${MY}/todos`,
	MY_ATTENDANCE: `${MY}/attendance`,
	MY_MESSAGES: `${MY}/messages`,
	CAREERS,
	CAREERS_LOGIN: `${CAREERS}/login`,
	CAREERS_SIGNUP: `${CAREERS}/signup`,
	CAREERS_MY_APPLICATIONS: `${CAREERS}/my-applications`,
	ADMIN_DASHBOARD: `${ADMIN}/dashboard`,
	ADMIN_TODOS: `${ADMIN}/todos`,
	ADMIN_CATEGORIES: `${ADMIN}/categories`,
	ADMIN_HOLIDAYS: `${ADMIN}/holidays`,
	ADMIN_ATTENDANCE: `${ADMIN}/attendance`,
	ADMIN_USERS: `${ADMIN}/users`,
	ADMIN_RECRUITMENT: `${ADMIN}/recruitment`,
	ADMIN_APPLICANTS: `${ADMIN}/applicants`,
	ADMIN_MESSAGES: `${ADMIN}/messages`,
};

/** `startsWith` / 경로 prefix 검사용 */
export const PATH_PREFIX = {
	MY,
	ADMIN,
	CAREERS,
};

/**
 * 채용 공고 상세/지원 URL (동적 id).
 * @param {string|number} jobId
 */
export function pathCareersJob(jobId) {
	return `${PATHS.CAREERS}/${jobId}`;
}

/**
 * @param {string|number} jobId
 */
export function pathCareersJobApply(jobId) {
	return `${PATHS.CAREERS}/${jobId}/apply`;
}

const stripCareers = (fullPath) => fullPath.slice(PATHS.CAREERS.length + 1);

/**
 * React Router v6 중첩 라우트용 — 부모 `Route path={PATHS.CAREERS}` 아래 자식 `path` 값.
 */
export const ROUTE_SEGMENTS = {
	CAREERS: {
		LOGIN: stripCareers(PATHS.CAREERS_LOGIN),
		SIGNUP: stripCareers(PATHS.CAREERS_SIGNUP),
		MY_APPLICATIONS: stripCareers(PATHS.CAREERS_MY_APPLICATIONS),
		JOB_ID: ':jobId',
		JOB_APPLY: ':jobId/apply',
	},
	ADMIN: {
		DASHBOARD: PATHS.ADMIN_DASHBOARD.slice(ADMIN.length + 1),
		TODOS: PATHS.ADMIN_TODOS.slice(ADMIN.length + 1),
		CATEGORIES: PATHS.ADMIN_CATEGORIES.slice(ADMIN.length + 1),
		HOLIDAYS: PATHS.ADMIN_HOLIDAYS.slice(ADMIN.length + 1),
		ATTENDANCE: PATHS.ADMIN_ATTENDANCE.slice(ADMIN.length + 1),
		USERS: PATHS.ADMIN_USERS.slice(ADMIN.length + 1),
		RECRUITMENT: PATHS.ADMIN_RECRUITMENT.slice(ADMIN.length + 1),
		APPLICANTS: PATHS.ADMIN_APPLICANTS.slice(ADMIN.length + 1),
		MESSAGES: PATHS.ADMIN_MESSAGES.slice(ADMIN.length + 1),
	},
	MY: {
		TODOS: PATHS.MY_TODOS.slice(MY.length + 1),
		ATTENDANCE: PATHS.MY_ATTENDANCE.slice(MY.length + 1),
		MESSAGES: PATHS.MY_MESSAGES.slice(MY.length + 1),
	},
};
