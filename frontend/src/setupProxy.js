/**
 * 개발 서버에서 브라우저 주소창·XHR 모두 `/api` → 백엔드(8000)로 전달.
 * `http://localhost:3000/api/common/download/1` 가 React 404로 가지 않도록 합니다.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
	app.use(
		'/api',
		createProxyMiddleware({
			target: 'http://127.0.0.1:8000',
			changeOrigin: true,
		})
	);
};
