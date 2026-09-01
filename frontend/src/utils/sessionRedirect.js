/** 세션 만료 → 로그인 이동 중복 방지 (401 연속 호출·토스트 버튼 이중 클릭) */
let redirecting = false;

export function beginSessionRedirect() {
	if (redirecting) return false;
	redirecting = true;
	return true;
}

export function endSessionRedirect() {
	redirecting = false;
}

export function isSessionRedirecting() {
	return redirecting;
}
