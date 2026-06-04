const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.join(__dirname, '..');
const dest = path.join(FRONTEND_ROOT, 'public', 'pdf.worker.min.mjs');
const candidates = [
	path.join(FRONTEND_ROOT, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'),
	path.join(FRONTEND_ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
	path.join(FRONTEND_ROOT, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
	path.join(FRONTEND_ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs'),
];

const src = candidates.find((p) => fs.existsSync(p));

if (!src) {
	console.warn(
		'[copy-pdf-worker] pdfjs worker not found (run `npm ci` in frontend/). PDF preview may fail; dev server will continue.'
	);
	process.exit(0);
}

fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied to public/pdf.worker.min.mjs');
