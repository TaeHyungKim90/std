# 프론트엔드 파일 네이밍 (팀 규칙)

| 구분 | 확장자 | 예 |
|------|--------|-----|
| **화면·마크업·JSX 반환** (페이지, 레이아웃, 컨텍스트 Provider 등) | `.jsx` | `LoginPage.jsx`, `TenantContext.jsx`, `PdfViewerPage.jsx` |
| **로직·설정만** (API 클라이언트, 상수, 순수 유틸, 훅) | `.js` | `axiosInstance.js`, `fileUtils.js`, `paths.js` |

- 라우트 정의처럼 `<Route>`를 쓰는 모듈은 `.jsx`.
- 엔트리 `index.js`는 CRA 관례에 따라 `.js` 유지 가능.
- 페이지 전용 스타일은 같은 이름의 `.css` (예: `PdfViewerPage.css`).

**경로·메뉴**: 새 화면 추가 시 `constants/paths.js`, `constants/menu.js`, 해당 `*Routes.jsx`를 함께 수정.

상세 구조: [`../research.md`](../research.md) §14.
