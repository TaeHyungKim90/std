import React from 'react';
import * as Notify from 'utils/toastUtils';
import { formatIdSnippet, shouldAbbreviateId } from 'utils/formatId';
import 'assets/css/id-copy-chip.css';

/**
 * 긴 ID·로그인명: 축약 표시 + 전체 복사. 짧은 값은 그대로 표시하고 복사는 선택.
 */
const IdCopyChip = ({
	value,
	emptyLabel = '—',
	className = '',
	compact = false,
	muted = false,
	minAbbreviateLen = 20,
	stopClick = true,
	/** tr 등 부모에 onClick이 있을 때 칩 영역 클릭이 행 동작과 겹치지 않게 함 */
	isolateRowClick = false,
}) => {
	if (value == null || value === '') {
		return <span className={className}>{emptyLabel}</span>;
	}

	const str = String(value);
	const abbreviated = shouldAbbreviateId(str, minAbbreviateLen);
	const display = abbreviated ? formatIdSnippet(str) : str;
	const showCopy = str.length >= 8;

	const copy = async (e) => {
		if (stopClick) e.stopPropagation();
		try {
			await navigator.clipboard.writeText(str);
			Notify.toastSuccess('클립보드에 복사했습니다.');
		} catch {
			Notify.toastError('복사에 실패했습니다.');
		}
	};

	const stopRow = isolateRowClick ? (e) => e.stopPropagation() : undefined;

	return (
		<span
			className={`id-copy-chip ${compact ? 'id-copy-chip--compact' : ''} ${muted ? 'id-copy-chip--muted' : ''} ${className}`.trim()}
			title={abbreviated || str !== display ? str : undefined}
			onClick={stopRow}
			onKeyDown={isolateRowClick ? (e) => e.stopPropagation() : undefined}
		>
			<code className="id-copy-chip__text">{display}</code>
			{showCopy ? (
				<button type="button" className="id-copy-chip__btn" onClick={copy} aria-label={`${str} 복사`}>
					복사
				</button>
			) : null}
		</span>
	);
};

export default IdCopyChip;
