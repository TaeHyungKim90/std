import * as Notify from 'utils/toastUtils';
/**
 * 서버에 저장된 파일을 브라우저 새 창(탭)에서 열어주는 공통 함수
 * @param {string} fileUrl - DB에 저장된 파일 상대 경로 (예: /uploads/20260319_resume.pdf)
 */
export const openFileViewer = (fileUrl) => {
	if (!fileUrl) {
		Notify.toastWarn("등록된 파일이 없습니다.");
		return;
	}

	// 🚨 환경변수에 백엔드 주소가 있다면 사용하고, 없다면 기본 로컬 주소 사용
	const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
	
	// 파일 URL이 이미 http로 시작하는 외부 링크라면 그대로 사용, 아니면 base URL을 붙임
	const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${baseUrl}${fileUrl}`;

	// 새 창(탭)에서 파일 열기 (보안을 위해 noopener, noreferrer 추가)
	window.open(fullUrl, '_blank', 'noopener,noreferrer');
};