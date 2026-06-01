/**
 * 앱 내 라우트 경로 — 멀티테넌트: /{tenantSlug}/my/...
 * 경로 변경 시 이 파일만 수정하면 됩니다.
 */

export const TENANT_PARAM = ':tenantSlug';

export const DEFAULT_TENANT_SLUG =
	process.env.REACT_APP_DEFAULT_TENANT_SLUG || 'valuesplay';

const MY = '/my';
const ADMIN = '/admin';
const CAREERS = '/careers';

/** 테넌트 slug 기준 전체 경로 객체 */
export function pathsForTenant(tenantSlug) {
	const root = `/${tenantSlug}`;
	const my = `${root}${MY}`;
	const admin = `${root}${ADMIN}`;
	const careers = `${root}${CAREERS}`;

	return {
		HOME: `${root}/`,
		LOGIN: `${root}/login`,
		SIGNUP: `${root}/signup`,
		OAUTH_CALLBACK: `${root}/oauth/callback`,
		MY_TODOS: `${my}/todos`,
		MY_ATTENDANCE: `${my}/attendance`,
		MY_MESSAGES: `${my}/messages`,
		MY_REPORTS: `${my}/reports`,
		MY_PROFILE: `${my}/profile`,
		CAREERS: careers,
		CAREERS_LOGIN: `${careers}/login`,
		CAREERS_SIGNUP: `${careers}/signup`,
		CAREERS_MY_APPLICATIONS: `${careers}/my-applications`,
		ADMIN_DASHBOARD: `${admin}/dashboard`,
		ADMIN_TODOS: `${admin}/todos`,
		ADMIN_CATEGORIES: `${admin}/categories`,
		ADMIN_DEPARTMENTS: `${admin}/departments`,
		ADMIN_HOLIDAYS: `${admin}/holidays`,
		ADMIN_POSITIONS: `${admin}/positions`,
		ADMIN_WORK_LOCATIONS: `${admin}/work-locations`,
		ADMIN_ATTENDANCE: `${admin}/attendance`,
		ADMIN_ATTENDANCE_REWARDS: `${admin}/attendance-rewards`,
		ADMIN_USERS: `${admin}/users`,
		ADMIN_RECRUITMENT: `${admin}/recruitment`,
		ADMIN_RESUME_TEMPLATES: `${admin}/resume-templates`,
		ADMIN_APPLICANTS: `${admin}/applicants`,
		ADMIN_MESSAGES: `${admin}/messages`,
		ADMIN_REPORTS: `${admin}/reports`,
		PATH_PREFIX: {
			MY: my,
			ADMIN: admin,
			CAREERS: careers,
		},
	};
}

/** @deprecated — TenantContext의 paths 사용 권장. 기본 테넌트 기준 정적 경로 */
export const PATHS = pathsForTenant(DEFAULT_TENANT_SLUG);

/** `startsWith` / 경로 prefix 검사용 */
export const PATH_PREFIX = PATHS.PATH_PREFIX;

/**
 * 채용 공고 상세/지원 URL (동적 id).
 */
export function pathCareersJob(jobId, tenantSlug = DEFAULT_TENANT_SLUG) {
	return `${pathsForTenant(tenantSlug).CAREERS}/${jobId}`;
}

export function pathCareersJobApply(jobId, tenantSlug = DEFAULT_TENANT_SLUG) {
	return `${pathsForTenant(tenantSlug).CAREERS}/${jobId}/apply`;
}

const stripCareers = (fullPath, careersBase) =>
	fullPath.slice(careersBase.length + 1);

/** React Router 중첩 라우트용 세그먼트 (테넌트 루트 아래 상대 path) */
export function routeSegmentsForTenant(tenantSlug) {
	const P = pathsForTenant(tenantSlug);
	const careers = P.CAREERS;
	const admin = P.PATH_PREFIX.ADMIN;
	const my = P.PATH_PREFIX.MY;

	return {
		CAREERS: {
			LOGIN: stripCareers(P.CAREERS_LOGIN, careers),
			SIGNUP: stripCareers(P.CAREERS_SIGNUP, careers),
			MY_APPLICATIONS: stripCareers(P.CAREERS_MY_APPLICATIONS, careers),
			JOB_ID: ':jobId',
			JOB_APPLY: ':jobId/apply',
		},
		ADMIN: {
			DASHBOARD: P.ADMIN_DASHBOARD.slice(admin.length + 1),
			TODOS: P.ADMIN_TODOS.slice(admin.length + 1),
			CATEGORIES: P.ADMIN_CATEGORIES.slice(admin.length + 1),
			DEPARTMENTS: P.ADMIN_DEPARTMENTS.slice(admin.length + 1),
			HOLIDAYS: P.ADMIN_HOLIDAYS.slice(admin.length + 1),
			POSITIONS: P.ADMIN_POSITIONS.slice(admin.length + 1),
			WORK_LOCATIONS: P.ADMIN_WORK_LOCATIONS.slice(admin.length + 1),
			ATTENDANCE: P.ADMIN_ATTENDANCE.slice(admin.length + 1),
			ATTENDANCE_REWARDS: P.ADMIN_ATTENDANCE_REWARDS.slice(admin.length + 1),
			USERS: P.ADMIN_USERS.slice(admin.length + 1),
			RECRUITMENT: P.ADMIN_RECRUITMENT.slice(admin.length + 1),
			RESUME_TEMPLATES: P.ADMIN_RESUME_TEMPLATES.slice(admin.length + 1),
			APPLICANTS: P.ADMIN_APPLICANTS.slice(admin.length + 1),
			MESSAGES: P.ADMIN_MESSAGES.slice(admin.length + 1),
			REPORTS: P.ADMIN_REPORTS.slice(admin.length + 1),
		},
		MY: {
			TODOS: P.MY_TODOS.slice(my.length + 1),
			ATTENDANCE: P.MY_ATTENDANCE.slice(my.length + 1),
			MESSAGES: P.MY_MESSAGES.slice(my.length + 1),
			REPORTS: P.MY_REPORTS.slice(my.length + 1),
			PROFILE: P.MY_PROFILE.slice(my.length + 1),
		},
	};
}

export const ROUTE_SEGMENTS = routeSegmentsForTenant(DEFAULT_TENANT_SLUG);
