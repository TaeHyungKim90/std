import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from 'context/AuthContext';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminRoute from './AdminRoute';

test.each(['todos', 'reports', 'expenses', 'attendance', 'messages', 'contacts', 'profile'])(
  'removes admin styles when navigating to my/%s', async menu => {
    render(<AuthContext.Provider value={{ isLoggedIn: true, userRole: 'admin', loading: false }}>
      <MemoryRouter initialEntries={['/admin']}><Routes>
        <Route element={<AdminRoute />}><Route path="/admin" element={<Link to={`/my/${menu}`}>사용자 메뉴</Link>} /></Route>
        <Route path="/my/:menu" element={<Link to="/admin">관리모드</Link>} />
      </Routes></MemoryRouter>
    </AuthContext.Provider>);
    expect(document.querySelectorAll('style[data-admin-styles]')).toHaveLength(1);
    await userEvent.click(screen.getByText('사용자 메뉴'));
    expect(document.querySelector('style[data-admin-styles]')).toBeNull();
    await userEvent.click(screen.getByText('관리모드'));
    expect(document.querySelectorAll('style[data-admin-styles]')).toHaveLength(1);
  }
);
