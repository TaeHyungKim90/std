import {
	getEventInclusiveYmdRange,
	hasOwnVacationOnDate,
	hasOwnVacationOverlappingRange,
} from './todoVacationUtils';

describe('todoVacationUtils', () => {
	const ownVacation = {
		start: '2025-06-10',
		end: '2025-06-11',
		extendedProps: {
			user_id: 'user_a',
			category: 'vacation_full',
			start_date: '2025-06-10T00:00:00',
			end_date: '2025-06-10T23:59:59',
		},
	};

	const otherVacation = {
		start: '2025-06-10',
		end: '2025-06-11',
		extendedProps: {
			user_id: 'user_b',
			category: 'vacation_full',
			start_date: '2025-06-10T00:00:00',
			end_date: '2025-06-10T23:59:59',
		},
	};

	it('hasOwnVacationOnDate ignores other users', () => {
		const events = [otherVacation];
		expect(hasOwnVacationOnDate(events, '2025-06-10', 'user_a')).toBe(false);
		expect(hasOwnVacationOnDate(events, '2025-06-10', 'user_b')).toBe(true);
	});

	it('hasOwnVacationOnDate detects own vacation', () => {
		const events = [ownVacation];
		expect(hasOwnVacationOnDate(events, '2025-06-10', 'user_a')).toBe(true);
		expect(hasOwnVacationOnDate(events, '2025-06-11', 'user_a')).toBe(false);
	});

	it('hasOwnVacationOverlappingRange detects range overlap', () => {
		const events = [ownVacation];
		expect(hasOwnVacationOverlappingRange(events, '2025-06-09', '2025-06-12', 'user_a')).toBe(
			true
		);
		expect(hasOwnVacationOverlappingRange(events, '2025-06-11', '2025-06-12', 'user_a')).toBe(
			false
		);
		expect(hasOwnVacationOverlappingRange(events, '2025-06-10', '2025-06-10', 'user_b')).toBe(
			false
		);
	});

	it('getEventInclusiveYmdRange uses DB inclusive end_date', () => {
		const span = getEventInclusiveYmdRange(ownVacation);
		expect(span).toEqual({ from: '2025-06-10', to: '2025-06-10' });
	});
});
