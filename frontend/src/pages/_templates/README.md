# Page Templates (Reference Only)

이 디렉토리의 파일들은 **라우팅에 연결되지 않는 참고용 템플릿**입니다.

새 화면을 만들 때 공통 마크업/래퍼 클래스를 빠르게 가져갈 수 있도록, 현재 프로젝트의 주요 화면 CSS 구조를 본떠 둡니다.

## 템플릿 파일

| 파일 | 대응 스타일 |
|------|-------------|
| `CareersPageTemplate.jsx` | `careers-content-wrapper`, `careers-header` |
| `AdminPageTemplate.jsx` | `bq-admin-view`, `admin-header`, `admin-table-wrapper` |
| `HrRepPageTemplate.jsx` | `rep-page rep-page--wide`, `rep-page__title`, `rep-page__sub` |

관리자 가산점·PDF 뷰어 등 신규 화면은 `pages/admin/AdminAttendanceRewards.jsx`, `pages/hr/PdfViewerPage.jsx`를 참고하는 것이 좋습니다.

파일 네이밍: [`../../../FILE_CONVENTIONS.md`](../../../FILE_CONVENTIONS.md)
