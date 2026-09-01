import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerAuthNavigate } from 'utils/authNavigate';

/** react-router navigate를 axios/토스트 등 비-컴포넌트 코드에 연결 */
export default function AuthNavigateRegistrar() {
	const navigate = useNavigate();

	useEffect(() => {
		registerAuthNavigate(navigate);
		return () => registerAuthNavigate(null);
	}, [navigate]);

	return null;
}
