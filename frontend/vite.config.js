import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, 'src');

const SRC_ROOT_DIRS = fs
	.readdirSync(srcDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);

const DEFAULT_PROXY_TARGET = 'http://localhost:8000';

function proxyTargetFromEnv(env) {
	const base = env.REACT_APP_API_BASE_URL || '';
	return (
		(base && base.replace(/\/?api\/?$/i, '').replace(/\/$/, '')) ||
		env.REACT_APP_PROXY_TARGET ||
		DEFAULT_PROXY_TARGET
	);
}

/** CRA jsconfig paths("*": ./src/*) — 최상위 src 폴더만 alias */
function srcRootAliases() {
	return Object.fromEntries(SRC_ROOT_DIRS.map((name) => [name, path.join(srcDir, name)]));
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, __dirname, ['REACT_APP_', '']);
	const isProd = mode === 'production';
	const processEnv = {
		NODE_ENV: isProd ? 'production' : 'development',
		PUBLIC_URL: '',
		REACT_APP_API_BASE_URL: '',
		REACT_APP_DEFAULT_TENANT_SLUG: '',
		REACT_APP_FILE_DOWNLOAD_VIA_API: '',
		REACT_APP_PROXY_TARGET: '',
		...Object.fromEntries(
			Object.entries(env).filter(([key]) => key.startsWith('REACT_APP_') || key === 'NODE_ENV')
		),
	};

	const processEnvDefine = Object.fromEntries(
		Object.entries(processEnv).map(([key, value]) => [
			`process.env.${key}`,
			JSON.stringify(value == null ? '' : String(value)),
		])
	);

	const target = proxyTargetFromEnv(processEnv);

	return {
		plugins: [react()],
		envPrefix: 'REACT_APP_',
		define: processEnvDefine,
		resolve: {
			alias: srcRootAliases(),
		},
		server: {
			port: 3000,
			strictPort: true,
			proxy: {
				'/api': { target, changeOrigin: true },
				'/uploads/tenant-branding': { target, changeOrigin: true },
				'/assets': {
					target,
					changeOrigin: true,
					bypass(req) {
						const url = req.url || '';
						const publicPath = path.join(__dirname, 'public', url.split('?')[0]);
						if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
							return url;
						}
						return undefined;
					},
				},
			},
		},
		build: {
			outDir: 'build',
			assetsDir: 'static',
			emptyOutDir: true,
		},
		test: {
			globals: true,
			environment: 'jsdom',
			setupFiles: './src/setupTests.js',
			css: false,
		},
	};
});
