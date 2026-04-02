import 'assets/css/avatar-image-crop-modal.css';

import AppModal from 'components/common/AppModal';
import UserAvatar from 'components/common/UserAvatar';
import { Camera } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFilePreviewUrl } from 'utils/fileUtils';
import * as Notify from 'utils/toastUtils';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

const AvatarImageCropModal = ({ isOpen, file, initialImageUrl = null, initialAdjust, onClose, onConfirm }) => {
	const fileInputRef = useRef(null);
	const frameRef = useRef(null);
	const [framePx, setFramePx] = useState(320);

	const [sourceFile, setSourceFile] = useState(null);
	const [step, setStep] = useState('edit');
	const [imageSrc, setImageSrc] = useState(null);
	const [previewFile, setPreviewFile] = useState(null);
	const [previewUrl, setPreviewUrl] = useState(null);
	const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
	const [zoom, setZoom] = useState(1);
	/** 픽셀 기준이 아닌, 저장값과 동일한 정규화 오프셋 (-1~1, 실제 이동은 × framePx) */
	const [offsetNorm, setOffsetNorm] = useState({ x: 0, y: 0 });
	const [dragging, setDragging] = useState(false);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const offsetNormStartRef = useRef({ x: 0, y: 0 });

	useEffect(() => {
		if (!isOpen) return;
		setSourceFile(file || null);
		setStep('edit');
	}, [isOpen, file]);

	const resolvedInitialImageUrl = useMemo(() => {
		if (!initialImageUrl) return null;
		const s = String(initialImageUrl);
		if (s.startsWith('blob:') || s.startsWith('data:') || s.startsWith('http')) return s;
		return getFilePreviewUrl(s);
	}, [initialImageUrl]);

	useEffect(() => {
		if (!isOpen || step !== 'edit') return undefined;
		const el = frameRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return undefined;
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect?.width;
			if (w && w > 0) setFramePx(w);
		});
		ro.observe(el);
		const w = el.getBoundingClientRect().width;
		if (w > 0) setFramePx(w);
		return () => ro.disconnect();
	}, [isOpen, step, imageSrc]);

	useEffect(() => {
		if (!isOpen || !sourceFile) return undefined;
		const nextSrc = URL.createObjectURL(sourceFile);
		setImageSrc(nextSrc);
		const nextZoom = clamp(Number(initialAdjust?.zoom ?? 1), MIN_ZOOM, MAX_ZOOM);
		setZoom(nextZoom);
		setOffsetNorm({
			x: clamp(Number(initialAdjust?.offsetX ?? 0), -1, 1),
			y: clamp(Number(initialAdjust?.offsetY ?? 0), -1, 1),
		});

		loadImage(nextSrc)
			.then((img) => {
				setNaturalSize({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
			})
			.catch(() => {
				Notify.toastError('이미지를 불러오지 못했습니다.');
			});

		return () => {
			URL.revokeObjectURL(nextSrc);
		};
	}, [initialAdjust?.offsetX, initialAdjust?.offsetY, initialAdjust?.zoom, isOpen, sourceFile]);

	useEffect(() => {
		if (!isOpen || sourceFile || !resolvedInitialImageUrl) return;
		setImageSrc(resolvedInitialImageUrl);
		const nextZoom = clamp(Number(initialAdjust?.zoom ?? 1), MIN_ZOOM, MAX_ZOOM);
		setZoom(nextZoom);
		setOffsetNorm({
			x: clamp(Number(initialAdjust?.offsetX ?? 0), -1, 1),
			y: clamp(Number(initialAdjust?.offsetY ?? 0), -1, 1),
		});
		loadImage(resolvedInitialImageUrl)
			.then((img) => {
				setNaturalSize({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
			})
			.catch(() => {
				Notify.toastError('이미지를 불러오지 못했습니다.');
			});
	}, [initialAdjust?.offsetX, initialAdjust?.offsetY, initialAdjust?.zoom, isOpen, resolvedInitialImageUrl, sourceFile]);

	useEffect(() => {
		if (!isOpen || sourceFile || resolvedInitialImageUrl) return;
		setImageSrc(null);
		setNaturalSize({ width: 1, height: 1 });
		setZoom(1);
		setOffsetNorm({ x: 0, y: 0 });
	}, [isOpen, resolvedInitialImageUrl, sourceFile]);

	useEffect(() => {
		if (!previewUrl) return;
		return () => URL.revokeObjectURL(previewUrl);
	}, [previewUrl]);

	const baseScale = useMemo(() => {
		const { width, height } = naturalSize;
		return Math.max(framePx / width, framePx / height);
	}, [naturalSize, framePx]);

	const rendered = useMemo(() => {
		const { width, height } = naturalSize;
		const scale = baseScale * zoom;
		return {
			width: width * scale,
			height: height * scale,
			scale,
		};
	}, [naturalSize, baseScale, zoom]);

	const maxNorm = useMemo(() => {
		const limitPxX = Math.max(0, rendered.width / 2 - framePx / 2);
		const limitPxY = Math.max(0, rendered.height / 2 - framePx / 2);
		const nx = framePx > 0 ? Math.min(1, limitPxX / framePx) : 0;
		const ny = framePx > 0 ? Math.min(1, limitPxY / framePx) : 0;
		return { x: nx, y: ny };
	}, [rendered.width, rendered.height, framePx]);

	const clampOffsetNorm = useCallback(
		(x, y) => ({
			x: clamp(x, -maxNorm.x, maxNorm.x),
			y: clamp(y, -maxNorm.y, maxNorm.y),
		}),
		[maxNorm.x, maxNorm.y],
	);

	useEffect(() => {
		setOffsetNorm((prev) => {
			const next = clampOffsetNorm(prev.x, prev.y);
			if (Math.abs(next.x - prev.x) < 1e-9 && Math.abs(next.y - prev.y) < 1e-9) return prev;
			return next;
		});
	}, [clampOffsetNorm]);

	const offsetPx = useMemo(
		() => ({ x: offsetNorm.x * framePx, y: offsetNorm.y * framePx }),
		[offsetNorm.x, offsetNorm.y, framePx],
	);

	const handlePointerDown = (e) => {
		e.preventDefault();
		setDragging(true);
		dragStartRef.current = { x: e.clientX, y: e.clientY };
		offsetNormStartRef.current = { ...offsetNorm };
	};

	const handlePointerMove = (e) => {
		if (!dragging || framePx <= 0) return;
		e.preventDefault();
		const dx = e.clientX - dragStartRef.current.x;
		const dy = e.clientY - dragStartRef.current.y;
		setOffsetNorm(
			clampOffsetNorm(offsetNormStartRef.current.x + dx / framePx, offsetNormStartRef.current.y + dy / framePx),
		);
	};

	const endDragging = () => {
		setDragging(false);
	};

	const handleZoomOut = () => setZoom((prev) => clamp(Number((prev - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
	const handleZoomIn = () => setZoom((prev) => clamp(Number((prev + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));

	const handleWheelZoom = (e) => {
		e.preventDefault();
		const direction = e.deltaY > 0 ? -1 : 1;
		setZoom((prev) => clamp(Number((prev + direction * ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
	};

	const handleNext = useCallback(async () => {
		if (!imageSrc) return;
		if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
		const nextPreview = sourceFile ? URL.createObjectURL(sourceFile) : imageSrc;
		setPreviewFile(sourceFile || null);
		setPreviewUrl(nextPreview);
		setStep('preview');
	}, [imageSrc, previewUrl, sourceFile]);

	const handleConfirm = useCallback(async () => {
		if (!previewUrl) return;
		onConfirm?.(previewFile || null, previewUrl, {
			zoom: clamp(Number(zoom || 1), MIN_ZOOM, MAX_ZOOM),
			offsetX: clamp(offsetNorm.x, -1, 1),
			offsetY: clamp(offsetNorm.y, -1, 1),
		});
	}, [offsetNorm.x, offsetNorm.y, onConfirm, previewFile, previewUrl, zoom]);

	useEffect(() => {
		if (!isOpen) return undefined;
		const handleKeyDown = (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose?.();
				return;
			}
			if (e.key === 'Enter' && imageSrc && step === 'edit') {
				e.preventDefault();
				handleNext();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleNext, imageSrc, isOpen, onClose, step]);

	const handlePickFile = (e) => {
		const nextFile = e.target.files?.[0];
		if (!nextFile) return;
		setSourceFile(nextFile);
		setStep('edit');
		e.target.value = '';
	};

	const previewAdjust = useMemo(
		() => ({
			zoom: clamp(Number(zoom || 1), MIN_ZOOM, MAX_ZOOM),
			offsetX: clamp(offsetNorm.x, -1, 1),
			offsetY: clamp(offsetNorm.y, -1, 1),
		}),
		[offsetNorm.x, offsetNorm.y, zoom],
	);

	return (
		<AppModal isOpen={isOpen} onClose={onClose} contentClassName="avatar-crop-modal">
			<h2 className="avatar-crop-modal__title">프로필 위치 조정</h2>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="avatar-crop-modal__file-input"
				onChange={handlePickFile}
				hidden
			/>

			{imageSrc && step === 'edit' ? (
				<>
					<div
						ref={frameRef}
						className={`avatar-crop-modal__frame ${dragging ? 'is-dragging' : ''}`}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={endDragging}
						onPointerLeave={endDragging}
						onWheel={handleWheelZoom}
						role="presentation"
					>
						<img
							src={imageSrc}
							alt="크롭 대상"
							draggable={false}
							className="avatar-crop-modal__image"
							style={{
								width: `${rendered.width}px`,
								height: `${rendered.height}px`,
								transform: `translate(calc(-50% + ${offsetPx.x}px), calc(-50% + ${offsetPx.y}px))`,
							}}
						/>
						<div className="avatar-crop-modal__dimmer" aria-hidden="true">
							<div className="avatar-crop-modal__hole" />
						</div>
						<div className="avatar-crop-modal__corners" aria-hidden="true">
							<span className="avatar-crop-modal__corner avatar-crop-modal__corner--tl" />
							<span className="avatar-crop-modal__corner avatar-crop-modal__corner--tr" />
							<span className="avatar-crop-modal__corner avatar-crop-modal__corner--bl" />
							<span className="avatar-crop-modal__corner avatar-crop-modal__corner--br" />
						</div>
					</div>

					<div className="avatar-crop-modal__rotate-row">
						<div className="avatar-crop-modal__gif-hint">
							이미지는 원본으로 저장되고, 여기서 조정한 위치/확대값만 저장됩니다.
						</div>
					</div>

					<div className="avatar-crop-modal__zoom-row">
						<button
							type="button"
							className="avatar-crop-modal__zoom-btn"
							onClick={handleZoomOut}
							aria-label="축소"
							disabled={zoom <= MIN_ZOOM}
						>
							-
						</button>
						<input
							id="avatar-crop-zoom"
							type="range"
							min={MIN_ZOOM}
							max={MAX_ZOOM}
							step="0.01"
							value={zoom}
							onChange={(e) => setZoom(Number(e.target.value))}
						/>
						<button
							type="button"
							className="avatar-crop-modal__zoom-btn"
							onClick={handleZoomIn}
							aria-label="확대"
							disabled={zoom >= MAX_ZOOM}
						>
							+
						</button>
					</div>
				</>
			) : null}

			{step === 'preview' ? (
				<div className="avatar-crop-modal__preview-step">
					<div className="avatar-crop-modal__preview-title">새 프로필 사진</div>
					<div className="avatar-crop-modal__preview-wrap">
						{previewUrl ? (
							<UserAvatar imageUrl={previewUrl} size={210} avatarAdjust={previewAdjust} />
						) : (
							<div className="avatar-crop-modal__preview-image avatar-crop-modal__preview-image--empty" />
						)}
					</div>
				</div>
			) : null}

			{!imageSrc ? (
				<div className="avatar-crop-modal__empty">
					<div className="avatar-crop-modal__empty-preview" aria-hidden="true">
						<Camera size={34} />
					</div>
					<p className="avatar-crop-modal__empty-text">아래에서 사진을 선택해 주세요.</p>
				</div>
			) : null}

			<div className="avatar-crop-modal__picker-row">
				<button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
					{imageSrc ? '다른 사진 선택' : '기기에서 업로드'}
				</button>
			</div>

			<div className="modal-actions avatar-crop-modal__actions">
				{step === 'preview' ? (
					<>
						<button type="button" className="btn-cancel" onClick={() => setStep('edit')}>
							이전
						</button>
						<button type="button" className="btn-save" onClick={handleConfirm} disabled={!previewUrl}>
							프로필 사진으로 저장
						</button>
					</>
				) : (
					<>
						<button type="button" className="btn-cancel" onClick={onClose}>
							취소
						</button>
						<button type="button" className="btn-save" onClick={handleNext} disabled={!imageSrc}>
							다음
						</button>
					</>
				)}
			</div>
		</AppModal>
	);
};

export default AvatarImageCropModal;
