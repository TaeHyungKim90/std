/**
 * 개발 서버에서 브라우저 주소창·XHR 모두 `/api` → 백엔드(8000)로 전달.
 * `http://localhost:3000/api/common/download/1` 가 React 404로 가지 않도록 합니다.
 *
 * Node(CommonJS) 전용 파일이라 `constants/apiConfig.js`(ESM)는 require 하지 않습니다.
 * 기본 백엔드 호스트는 `constants/apiConfig.js`의 BASE_URL 과 동일하게 유지합니다.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const DEFAULT_PROXY_TARGET = 'http://localhost:8000';

module.exports = function setupProxy(app) {
	const target =
		process.env.REACT_APP_API_URL ||
		process.env.REACT_APP_PROXY_TARGET ||
		DEFAULT_PROXY_TARGET;
	app.use(
		'/api',
		createProxyMiddleware({
			target,
			changeOrigin: true,
		})
	);
};
