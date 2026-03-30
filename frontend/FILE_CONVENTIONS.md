# 프론트엔드 파일 네이밍 (팀 규칙 제안)

| 구분 | 확장자 | 예 |
|------|--------|-----|
| **화면·마크업·JSX 반환** (페이지, 레이아웃, 컨텍스트 Provider 등) | `.jsx` | `LoginPage.jsx`, `AuthContext.jsx` |
| **로직·설정만** (API 클라이언트, 상수, 순수 유틸, 훅) | `.js` | `axiosInstance.js`, `useApiRequest.js`, `constants.js` |

- 라우트 정의처럼 `<Route>`를 쓰는 모듈은 `.jsx`로 둡니다.
- 엔트리 `index.js`는 CRA 관례에 따라 `.js` 유지 가능합니다.
