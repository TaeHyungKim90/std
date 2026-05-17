import {
	fcAllDaySpanToInclusiveYmd,
	todoDbToFullCalendarAllDayRange,
} from './employmentDateUtils';

describe('employmentDateUtils (calendar ranges)', () => {
	it('todoDbToFullCalendarAllDayRange maps 2-day inclusive DB span to exclusive FC end', () => {
		const range = todoDbToFullCalendarAllDayRange(
			'2025-06-10T00:00:00',
			'2025-06-11T23:59:59'
		);
		expect(range).toEqual({ start: '2025-06-10', end: '2025-06-12' });
	});

	it('fcAllDaySpanToInclusiveYmd inverts FC 2-day selection', () => {
		const span = fcAllDaySpanToInclusiveYmd('2025-06-10', '2025-06-12');
		expect(span).toEqual({ startYmd: '2025-06-10', endYmd: '2025-06-11' });
	});
});
