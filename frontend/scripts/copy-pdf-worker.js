const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.join(__dirname, '..');
const src = path.join(
	FRONTEND_ROOT,
	'node_modules',
	'pdfjs-dist',
	'legacy',
	'build',
	'pdf.worker.min.mjs'
);
const dest = path.join(FRONTEND_ROOT, 'public', 'pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
	console.error('[copy-pdf-worker] pdfjs worker not found:', src);
	process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied to public/pdf.worker.min.mjs');
