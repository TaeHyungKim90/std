import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEFAULT_PARAM = 'page';

function parsePage(raw) {
	const n = parseInt(raw || '1', 10);
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

/**
 * 목록 페이지 번호를 URL 쿼리(`?page=`)와 동기화합니다.
 * @param {object} opts
 * @param {string} [opts.paramKey='page'] 쿼리 키
 * @param {number} opts.pageSize 페이지 크기 (total 변경 시 범위 클램프에 사용)
 * @param {number | null} [opts.total=null] 전체 건수. 첫 요청 전에는 `null`을 넘기면 URL 페이지를 잘못 덮어쓰지 않습니다.
 */
export function usePaginationSearchParams({ paramKey = DEFAULT_PARAM, pageSize, total = null }) {
	const [searchParams, setSearchParams] = useSearchParams();

	const page = useMemo(
		() => parsePage(searchParams.get(paramKey)),
		[searchParams, paramKey]
	);

	const setPage = useCallback(
		(next) => {
			const p = Math.max(1, Math.floor(Number(next)) || 1);
			setSearchParams(
				(prev) => {
					const nextParams = new URLSearchParams(prev);
					if (p <= 1) nextParams.delete(paramKey);
					else nextParams.set(paramKey, String(p));
					return nextParams;
				},
				{ replace: false }
			);
		},
		[setSearchParams, paramKey]
	);

	const totalPages = Math.max(1, Math.ceil((total ?? 0) / pageSize));

	useEffect(() => {
		if (total == null) return;
		if (page > totalPages) {
			setPage(totalPages);
		}
	}, [page, totalPages, total, setPage]);

	return [page, setPage];
}
