import { Calendar } from 'lucide-react';
import { useId, useRef } from 'react';
import { completeYmdOrEmpty, formatDigitsToYmd } from 'utils/ymdInputFormat';

/**
 * 앱 전역 YYYY-MM-DD 날짜 입력.
 * 키보드: 19900505 → 1990-05-05. 달력: 입력칸 왼쪽 정렬로 열림.
 */
export default function YmdDateInput({
	id,
	name,
	value = '',
	onChange,
	className = '',
	inputClassName = '',
	required = false,
	disabled = false,
	max,
	min,
	placeholder = '연도-월-일',
	'aria-label': ariaLabel,
	...rest
}) {
	const autoId = useId();
	const inputId = id || autoId;
	const pickerRef = useRef(null);
	const display = formatDigitsToYmd(value);
	const pickerValue = completeYmdOrEmpty(display);

	const emit = (next) => {
		if (typeof onChange !== 'function') return;
		onChange({
			target: {
				name: name || '',
				value: next,
			},
		});
	};

	const openPicker = () => {
		if (disabled) return;
		const el = pickerRef.current;
		if (!el) return;
		if (typeof el.showPicker === 'function') {
			try {
				el.showPicker();
				return;
			} catch {
				/* fall through */
			}
		}
		el.click();
	};

	return (
		<div className={`ymd-date-input ${className}`.trim()}>
			<input
				{...rest}
				id={inputId}
				type="text"
				name={name}
				inputMode="numeric"
				autoComplete="bday"
				placeholder={placeholder}
				value={display}
				required={required}
				disabled={disabled}
				maxLength={10}
				aria-label={ariaLabel}
				className={`ymd-date-input__text ${inputClassName}`.trim()}
				onChange={(e) => emit(formatDigitsToYmd(e.target.value))}
			/>
			<span className="ymd-date-input__icon" aria-hidden="true">
				<Calendar size={15} strokeWidth={1.75} />
			</span>
			<button
				type="button"
				className="ymd-date-input__calendar-btn"
				tabIndex={-1}
				disabled={disabled}
				aria-label={ariaLabel ? `${ariaLabel} 달력` : '달력에서 날짜 선택'}
				onClick={openPicker}
			/>
			{/* 전체 너비 앵커 — pointer-events:none, 달력은 버튼에서 showPicker */}
			<input
				ref={pickerRef}
				type="date"
				className="ymd-date-input__native"
				tabIndex={-1}
				aria-hidden="true"
				disabled={disabled}
				value={pickerValue}
				max={max || undefined}
				min={min || undefined}
				onChange={(e) => emit(e.target.value || '')}
			/>
		</div>
	);
}
