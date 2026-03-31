/**
 * API·페이징 기본값 (프론트엔드 전역).
 * 배포 시 `.env` 의 `REACT_APP_API_BASE_URL` / `REACT_APP_API_URL` 등과 맞출 수 있습니다.
 */

export const DEFAULT_PAGE_SIZE = 20;

/** 브라우저 밖(프록시 타겟 등)과 동일한 기본 백엔드 호스트 */
export const BASE_URL =
	process.env.REACT_APP_API_URL || 'http://localhost:8000';
