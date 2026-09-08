import React, { useCallback, useEffect, useRef, useState } from 'react';

const DAUM_POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

let postcodeScriptPromise = null;

function loadDaumPostcodeScript() {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('window unavailable'));
	}
	if (window.daum?.Postcode) {
		return Promise.resolve();
	}
	if (postcodeScriptPromise) {
		return postcodeScriptPromise;
	}
	postcodeScriptPromise = new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${DAUM_POSTCODE_SRC}"]`);
		if (existing) {
			existing.addEventListener('load', () => resolve());
			existing.addEventListener('error', () => reject(new Error('우편번호 스크립트 로드 실패')));
			if (window.daum?.Postcode) resolve();
			return;
		}
		const script = document.createElement('script');
		script.src = DAUM_POSTCODE_SRC;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			postcodeScriptPromise = null;
			reject(new Error('우편번호 스크립트 로드 실패'));
		};
		document.head.appendChild(script);
	});
	return postcodeScriptPromise;
}

function composeAddress(base, detail) {
	const b = String(base || '').trim();
	const d = String(detail || '').trim();
	if (!b) return '';
	return d ? `${b} ${d}` : b;
}

/**
 * 다음(카카오) 우편번호 검색 + 상세주소.
 * onChange(fullAddress) — 기본+상세 합친 문자열.
 */
const AddressSearchField = ({
	value = '',
	onChange,
	required = false,
	disabled = false,
	className = '',
	baseInputClassName = 'login-input',
	detailInputClassName = 'login-input',
	buttonClassName = 'btn-check-id',
}) => {
	const [baseAddress, setBaseAddress] = useState('');
	const [detailAddress, setDetailAddress] = useState('');
	const [busy, setBusy] = useState(false);
	const lastEmitted = useRef('');
	const hydratedFromValue = useRef(false);

	// 외부 value로 초기 하이드레이션 (한 번 또는 value가 바뀌고 내부가 비었을 때)
	useEffect(() => {
		const external = String(value || '').trim();
		if (!external) {
			if (!baseAddress && !detailAddress) return;
			return;
		}
		const current = composeAddress(baseAddress, detailAddress);
		if (external === current || external === lastEmitted.current) return;
		if (!hydratedFromValue.current || (!baseAddress && !detailAddress)) {
			setBaseAddress(external);
			setDetailAddress('');
			hydratedFromValue.current = true;
		}
	}, [value, baseAddress, detailAddress]);

	const emit = useCallback(
		(base, detail) => {
			const full = composeAddress(base, detail);
			lastEmitted.current = full;
			if (typeof onChange === 'function') onChange(full);
		},
		[onChange]
	);

	const openPostcode = useCallback(async () => {
		if (disabled || busy) return;
		setBusy(true);
		try {
			await loadDaumPostcodeScript();
			new window.daum.Postcode({
				oncomplete(data) {
					const road = data.roadAddress || data.jibunAddress || data.address || '';
					const zonecode = data.zonecode ? `[${data.zonecode}] ` : '';
					const nextBase = `${zonecode}${road}`.trim();
					setBaseAddress(nextBase);
					emit(nextBase, detailAddress);
				},
			}).open();
		} catch (err) {
			console.error(err);
			window.alert('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			setBusy(false);
		}
	}, [busy, detailAddress, disabled, emit]);

	const onDetailChange = (e) => {
		const next = e.target.value;
		setDetailAddress(next);
		emit(baseAddress, next);
	};

	return (
		<div className={`address-search-field ${className}`.trim()}>
			<div className="input-group address-search-field__row">
				<input
					type="text"
					className={baseInputClassName}
					value={baseAddress}
					placeholder="주소 검색"
					readOnly
					required={required}
					disabled={disabled}
					aria-label="기본 주소"
				/>
				<button
					type="button"
					className={buttonClassName}
					onClick={openPostcode}
					disabled={disabled || busy}
				>
					{busy ? '불러오는 중…' : '주소 검색'}
				</button>
			</div>
			<input
				type="text"
				className={detailInputClassName}
				value={detailAddress}
				onChange={onDetailChange}
				placeholder="상세주소 (선택)"
				disabled={disabled || !baseAddress}
				aria-label="상세 주소"
			/>
		</div>
	);
};

export default AddressSearchField;
