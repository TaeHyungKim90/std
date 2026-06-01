import './PdfViewerPage.css';

import { client } from 'api/axiosInstance';
import { Download } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Notify from 'utils/toastUtils';

const PDF_RENDER_SCALE_LIMIT = 2;
const PDF_WORKER_SRC = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`.replace(/\/+/g, '/');

pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

function getApiFileUrl(fileId) {
	return `/common/files/${encodeURIComponent(fileId)}`;
}

function parseFilename(contentDisposition, fallbackName) {
	if (!contentDisposition) return fallbackName;

	const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		try {
			return decodeURIComponent(utf8Match[1]);
		} catch {
			return utf8Match[1];
		}
	}

	const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
	if (quotedMatch?.[1]) return quotedMatch[1];

	const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
	return plainMatch?.[1]?.trim() || fallbackName;
}

function isPdfFile(contentType, ...names) {
	const normalizedType = String(contentType || '').toLowerCase();
	return (
		normalizedType.includes('pdf') ||
		names.some((name) => String(name || '').toLowerCase().endsWith('.pdf'))
	);
}

function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename || 'attachment.pdf';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function PdfPageCanvas({ pageNumber, pdfDocument }) {
	const wrapRef = useRef(null);
	const canvasRef = useRef(null);
	const [containerWidth, setContainerWidth] = useState(0);

	useEffect(() => {
		const element = wrapRef.current;
		if (!element) return undefined;

		const updateWidth = () => setContainerWidth(element.clientWidth);
		updateWidth();

		const resizeObserver = new ResizeObserver(updateWidth);
		resizeObserver.observe(element);

		return () => resizeObserver.disconnect();
	}, []);

	useEffect(() => {
		let isCancelled = false;
		let renderTask = null;

		async function renderPage() {
			if (!pdfDocument || !canvasRef.current || !containerWidth) return;

			const page = await pdfDocument.getPage(pageNumber);
			if (isCancelled) return;

			const baseViewport = page.getViewport({ scale: 1 });
			const scale = Math.min(PDF_RENDER_SCALE_LIMIT, containerWidth / baseViewport.width);
			const viewport = page.getViewport({ scale });
			const canvas = canvasRef.current;
			const context = canvas.getContext('2d');

			canvas.width = Math.floor(viewport.width);
			canvas.height = Math.floor(viewport.height);

			renderTask = page.render({ canvasContext: context, viewport });
			await renderTask.promise;
		}

		renderPage();

		return () => {
			isCancelled = true;
			if (renderTask) {
				renderTask.cancel();
			}
		};
	}, [containerWidth, pageNumber, pdfDocument]);

	return (
		<div className="pdf-viewer-page-canvas-wrap" ref={wrapRef}>
			<canvas
				ref={canvasRef}
				className="pdf-viewer-page-canvas"
				aria-label={`PDF ${pageNumber} 페이지`}
			/>
		</div>
	);
}

export default function PdfViewerPage() {
	const [searchParams] = useSearchParams();
	const fileId = searchParams.get('fileId');
	const fallbackName = searchParams.get('name') || 'attachment.pdf';
	const [blob, setBlob] = useState(null);
	const [filename, setFilename] = useState(fallbackName);
	const [pdfDocument, setPdfDocument] = useState(null);
	const [pageCount, setPageCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');

	const pages = useMemo(
		() => Array.from({ length: pageCount }, (_, index) => index + 1),
		[pageCount]
	);

	const handleDownload = useCallback(() => {
		if (!blob) return;
		downloadBlob(blob, filename);
	}, [blob, filename]);

	useEffect(() => {
		let pdfTask = null;
		let isCancelled = false;

		async function loadFile() {
			if (!fileId) {
				setErrorMessage('파일 정보가 없습니다.');
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				setErrorMessage('');

				const response = await client.get(getApiFileUrl(fileId), {
					responseType: 'arraybuffer',
				});
				if (isCancelled) return;

				const contentType = response.headers['content-type'] || '';
				const downloadedName = parseFilename(
					response.headers['content-disposition'],
					fallbackName
				);
				const isPdf = isPdfFile(contentType, downloadedName, fallbackName);
				const fileBlob = new Blob([response.data], {
					type: isPdf ? 'application/pdf' : contentType || 'application/octet-stream',
				});
				setBlob(fileBlob);
				setFilename(downloadedName);

				if (!isPdf) {
					setErrorMessage('PDF 파일만 뷰어에서 미리볼 수 있습니다. 다운로드 버튼으로 저장해 주세요.');
					setLoading(false);
					return;
				}

				pdfTask = pdfjsLib.getDocument({
					data: new Uint8Array(response.data),
				});
				const loadedPdf = await pdfTask.promise;
				if (isCancelled) {
					loadedPdf.destroy();
					return;
				}

				setPdfDocument(loadedPdf);
				setPageCount(loadedPdf.numPages);
			} catch (err) {
				console.error('PDF 뷰어 로드 실패:', err);
				const status = err?.response?.status;
				setErrorMessage(
					status === 403
						? '이 PDF를 열람할 권한이 없습니다.'
						: 'PDF 미리보기를 표시할 수 없습니다. 다운로드 버튼으로 저장해 확인해 주세요.'
				);
				Notify.toastApiFailure(err, 'PDF를 불러올 수 없습니다.');
			} finally {
				if (!isCancelled) {
					setLoading(false);
				}
			}
		}

		loadFile();

		return () => {
			isCancelled = true;
			if (pdfTask) {
				pdfTask.destroy();
			}
		};
	}, [fallbackName, fileId]);

	useEffect(() => () => {
		if (pdfDocument) {
			pdfDocument.destroy();
		}
	}, [pdfDocument]);

	return (
		<div className="pdf-viewer">
			<header className="pdf-viewer-toolbar">
				<div className="pdf-viewer-title-wrap">
					<strong className="pdf-viewer-title">{filename}</strong>
					<span className="pdf-viewer-subtitle">
						{pageCount ? `${pageCount}페이지` : '첨부파일 미리보기'}
					</span>
				</div>
				<button
					type="button"
					className="pdf-viewer-download-button"
					onClick={handleDownload}
					disabled={!blob}
				>
					<Download size={18} />
					다운로드
				</button>
			</header>

			<main className="pdf-viewer-content">
				{loading && <div className="pdf-viewer-state">PDF를 불러오는 중입니다...</div>}
				{!loading && errorMessage && (
					<div className="pdf-viewer-state pdf-viewer-state--error">
						{errorMessage}
					</div>
				)}
				{!loading && !errorMessage && pages.map((pageNumber) => (
					<PdfPageCanvas
						key={pageNumber}
						pageNumber={pageNumber}
						pdfDocument={pdfDocument}
					/>
				))}
			</main>
		</div>
	);
}
