import 'assets/css/calendar.css';
import 'assets/css/attendance.css';

import { Outlet } from 'react-router-dom';

/** `/my/*` 직원 영역 공통: 일정·출퇴근 스타일을 페이지별 임포트 없이 한 번만 로드합니다. */
const HrLayout = () => <Outlet />;

export default HrLayout;
