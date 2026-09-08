import { render, screen, waitFor } from '@testing-library/react';

import App from './App';

vi.mock('./routes', () => ({
	default: function StubAppRoutes() {
		return <div data-testid="stub-routes" />;
	},
}));

vi.mock('api/authApi', () => ({
	authApi: {
		checkAuth: () => Promise.resolve({ data: { isLoggedIn: false } }),
		logout: () => Promise.resolve({ data: { success: true } }),
	},
}));

describe('App', () => {
	test('AuthProvider·Router 셸과 라우트 슬롯이 마운트된다', async () => {
		render(<App />);
		await waitFor(() => {
			expect(screen.getByTestId('stub-routes')).toBeInTheDocument();
		});
	});
});
