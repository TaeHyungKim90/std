import DOMPurify from 'dompurify';

/**
 * SunEditor 등에서 온 HTML을 표시하기 전 XSS 완화.
 * (관리자만 편집한다는 전제에도, 저장된 데이터 오염·실수 대비)
 */
const DEFAULT_CONFIG = {
	ALLOWED_TAGS: [
		'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
		'ul', 'ol', 'li', 'a', 'img', 'span', 'div',
		'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code',
		'table', 'thead', 'tbody', 'tr', 'th', 'td'
	],
	ALLOWED_ATTR: [
		'href', 'title', 'target', 'rel', 'src', 'alt',
		'width', 'height', 'style', 'class', 'colspan', 'rowspan'
	],
	ALLOW_DATA_ATTR: false
};

export function sanitizeEditorHtml(html) {
	if (html == null || html === '') return '';
	return DOMPurify.sanitize(String(html), DEFAULT_CONFIG);
}
