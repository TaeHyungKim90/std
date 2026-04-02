import React from 'react';
import * as Notify from 'utils/toastUtils';
import { copyTextToClipboard } from 'utils/copyToClipboard';
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
	/**
	 * `tr` 등 부모에 행 클릭·키보드 핸들이 있을 때 칩(및 복사 버튼)에서의 이벤트가
	 * 행으로 전파되지 않게 막습니다. 복사 버튼은 Tab으로 포커스 가능하므로,
	 * 행에 Space/Enter·화살표 등 키 처리가 있다면 해당 페이지에서 포커스 링·키 충돌을 한 번 확인하세요.
	 */
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
		const ok = await copyTextToClipboard(str);
		if (ok) {
			Notify.toastSuccess('클립보드에 복사했습니다.');
			return;
		}
		Notify.toastWarn(
			'자동 복사를 사용할 수 없습니다. HTTPS가 아닌 주소·브라우저 제한일 수 있습니다. 위 텍스트를 선택해 복사해 주세요.',
			{ duration: 7000 },
		);
	};

	const stopRow = isolateRowClick ? (e) => e.stopPropagation() : undefined;
	const stopRowKeyDown = isolateRowClick ? (e) => e.stopPropagation() : undefined;

	return (
		<span
			className={`id-copy-chip ${compact ? 'id-copy-chip--compact' : ''} ${muted ? 'id-copy-chip--muted' : ''} ${className}`.trim()}
			title={abbreviated || str !== display ? str : undefined}
			onClick={stopRow}
			onKeyDown={stopRowKeyDown}
		>
			<code className="id-copy-chip__text">{display}</code>
			{showCopy ? (
				<button
					type="button"
					className="id-copy-chip__btn"
					onClick={copy}
					onKeyDown={stopRowKeyDown}
					aria-label={`${str} 복사`}
				>
					복사
				</button>
			) : null}
		</span>
	);
};

export default IdCopyChip;
