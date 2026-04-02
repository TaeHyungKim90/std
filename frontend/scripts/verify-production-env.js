/**
 * 프로덕션 번들 빌드 전 필수 환경 변수 검증.
 * REACT_APP_API_BASE_URL이 비어 있으면 axios baseURL이 ''가 되어 배포 환경에서 상대 경로 요청으로 깨질 수 있습니다.
 *
 * CRA(react-scripts)와 동일한 파일 병합 순서로 값을 해석합니다(쉘에 이미 있으면 그 값이 우선).
 */
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.join(__dirname, '..');

function stripBom(s) {
	if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
	return s;
}

function parseEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return {};
	const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
	const out = {};
	for (const line of raw.split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const eq = t.indexOf('=');
		if (eq === -1) continue;
		const key = t.slice(0, eq).trim();
		let val = t.slice(eq + 1).trim();
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1);
		}
		out[key] = val;
	}
	return out;
}

/** CRA `react-scripts/config/env.js` 와 동일: 먼저 로드된 파일의 키가 우선(뒤 파일은 이미 있는 키를 덮지 않음). */
function mergedEnvFromFiles() {
	const names = [
		'.env.production.local',
		'.env.local',
		'.env.production',
		'.env',
	];
	const acc = {};
	for (const name of names) {
		const parsed = parseEnvFile(path.join(FRONTEND_ROOT, name));
		for (const [k, v] of Object.entries(parsed)) {
			if (!Object.prototype.hasOwnProperty.call(acc, k)) {
				acc[k] = v;
			}
		}
	}
	return acc;
}

function resolveApiBaseUrl() {
	const fromShell = process.env.REACT_APP_API_BASE_URL;
	if (Object.prototype.hasOwnProperty.call(process.env, 'REACT_APP_API_BASE_URL')) {
		return String(fromShell ?? '').trim();
	}
	const fromFiles = mergedEnvFromFiles();
	return String(fromFiles.REACT_APP_API_BASE_URL ?? '').trim();
}

const apiBase = resolveApiBaseUrl();
if (!apiBase) {
	console.error(
		'\n[verify-production-env] 빌드 실패: REACT_APP_API_BASE_URL이 비어 있습니다.\n' +
			'프로덕션 번들에서 API 요청이 상대 경로로 나가 배포 시 조용히 실패할 수 있습니다.\n' +
			'frontend/.env.production(또는 CI 환경 변수)에 예: REACT_APP_API_BASE_URL=https://api.example.com/api\n'
	);
	process.exit(1);
}

console.log('[verify-production-env] REACT_APP_API_BASE_URL OK');
