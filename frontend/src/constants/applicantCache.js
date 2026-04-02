/**
 * 지원자 세션 캐시 키·브로드캐스트 이벤트.
 * `api/client`와 무관하게 axios 401 등에서 참조해 순환 의존을 피합니다.
 */
export const APPLICANT_USER_STORAGE_KEY = 'applicant_user';

/** CustomEvent — detail: { user: object | null } */
export const APPLICANT_SESSION_UPDATED_EVENT = 'applicantSessionUpdated';
