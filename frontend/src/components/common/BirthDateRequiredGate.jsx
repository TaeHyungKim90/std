import { useAuth } from 'context/AuthContext';
import { useAppPaths } from 'context/TenantContext';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BIRTH_DATE_PROMPT_KEY = 'vp_birth_date_prompted';

/**
 * 생년월일 미등록 일반 사용자에게 안내 후 내 정보로 이동.
 * 관리자(role=admin)는 제외. 비밀번호 강제 변경이 우선이면 그쪽을 먼저 처리.
 */
const BirthDateRequiredGate = () => {
	const { isLoggedIn, loading, mustChangePassword, birthDate, userRole } = useAuth();
	const paths = useAppPaths();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const promptingRef = useRef(false);

	useEffect(() => {
		if (loading || !isLoggedIn || mustChangePassword) return;
		// 관리자는 생년월일 입력을 요구하지 않음
		if (userRole === 'admin') {
			sessionStorage.removeItem(BIRTH_DATE_PROMPT_KEY);
			promptingRef.current = false;
			return;
		}

		const hasBirth = Boolean(birthDate && String(birthDate).trim());
		if (hasBirth) {
			sessionStorage.removeItem(BIRTH_DATE_PROMPT_KEY);
			promptingRef.current = false;
			return;
		}

		const onProfile =
			pathname === paths.MY_PROFILE ||
			pathname.startsWith(`${paths.MY_PROFILE}/`);
		if (onProfile) return;
		if (sessionStorage.getItem(BIRTH_DATE_PROMPT_KEY)) return;
		if (promptingRef.current) return;

		promptingRef.current = true;
		sessionStorage.setItem(BIRTH_DATE_PROMPT_KEY, '1');
		window.alert(
			'생년월일이 등록되어 있지 않습니다.\n확인을 누르면 내 정보 화면으로 이동합니다. 생년월일을 입력해 주세요.'
		);
		navigate(paths.MY_PROFILE, { replace: true });
		promptingRef.current = false;
	}, [
		birthDate,
		isLoggedIn,
		loading,
		mustChangePassword,
		navigate,
		pathname,
		paths.MY_PROFILE,
		userRole,
	]);

	return null;
};

export default BirthDateRequiredGate;
