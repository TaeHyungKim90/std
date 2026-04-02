/**
 * Clipboard API → 임시 textarea + execCommand 순으로 복사 시도.
 * 비 HTTPS·일부 브라우저에서 writeText만 실패하는 경우 폴백이 동작할 수 있음.
 * 사용자 제스처(클릭 등) 컨텍스트에서 호출할 것.
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
	if (typeof document === 'undefined') return false;

	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// 폴백으로 진행
		}
	}

	try {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.setAttribute('readonly', '');
		ta.setAttribute('aria-hidden', 'true');
		ta.style.position = 'fixed';
		ta.style.top = '0';
		ta.style.left = '-9999px';
		document.body.appendChild(ta);
		ta.focus();
		ta.select();
		ta.setSelectionRange(0, text.length);
		const ok = document.execCommand('copy');
		document.body.removeChild(ta);
		return Boolean(ok);
	} catch {
		return false;
	}
}
