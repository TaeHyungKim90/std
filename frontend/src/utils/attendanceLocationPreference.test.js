import {
	clearPreferredWorkLocation,
	preferredWorkLocationStorageKey,
	readPreferredWorkLocation,
	resolvePreferredAgainstOptions,
	writePreferredWorkLocation,
} from './attendanceLocationPreference';

describe('attendanceLocationPreference', () => {
	const uid = 'user-abc';

	beforeEach(() => {
		localStorage.clear();
	});

	test('preferredWorkLocationStorageKey returns null for blank userId', () => {
		expect(preferredWorkLocationStorageKey('')).toBeNull();
		expect(preferredWorkLocationStorageKey(null)).toBeNull();
		expect(preferredWorkLocationStorageKey(undefined)).toBeNull();
	});

	test('write / read / clear round-trip', () => {
		writePreferredWorkLocation(uid, '회사');
		expect(readPreferredWorkLocation(uid)).toBe('회사');
		clearPreferredWorkLocation(uid);
		expect(readPreferredWorkLocation(uid)).toBeNull();
	});

	test('write trims value', () => {
		writePreferredWorkLocation(uid, '  본사  ');
		expect(readPreferredWorkLocation(uid)).toBe('본사');
	});

	test('resolvePreferredAgainstOptions returns null when not in list', () => {
		writePreferredWorkLocation(uid, '삭제된장소');
		expect(resolvePreferredAgainstOptions(uid, ['회사', '지점'])).toBeNull();
	});

	test('resolvePreferredAgainstOptions returns stored when in list', () => {
		writePreferredWorkLocation(uid, '지점');
		expect(resolvePreferredAgainstOptions(uid, ['회사', '지점'])).toBe('지점');
	});
});
