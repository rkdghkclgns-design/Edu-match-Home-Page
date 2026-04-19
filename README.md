# Edu-match — 교강사 매칭 홈페이지

기업출강 워크샵 · 팀빌딩 · 공방체험 · DIY키트 · 교강사 매칭 플랫폼.
Supabase + Gemini 기반의 정적 웹앱으로, GitHub Pages + GitHub Actions 로 자동 배포됩니다.

---

## 파일 구조

```
Edu-match/
├── index.html             # 메인 랜딩 (Supabase 에서 강사/공고 로드)
├── signup.html            # 회원가입
├── login.html             # 로그인 (일반 / 관리자)
├── admin.html             # 관리자 대시보드 + AI 공고 생성
├── styles.css             # 디자인 시스템 (다크 · 바이올렛/시안 그라디언트)
├── script.js              # 랜딩 인터랙션 + Supabase 피드
├── auth.js                # 로그인 / 회원가입 로직
├── admin.js               # 관리자 CRUD + Gemini 공고 생성
├── supabase-config.js     # Supabase 클라이언트 + Gemini 프록시 호출
├── schema.sql             # em_ 접두사 테이블 정의
└── .github/workflows/deploy.yml  # GitHub Pages 자동 배포
```

---

## 관리자 계정

| 항목 | 값 |
|------|----|
| ID | `admin1124` |
| PW | `1124` |

로그인 → 관리자 탭 → 위 정보 입력 → `admin.html` 진입.
세션은 `localStorage` (`edumatch_admin_session`) 에 저장됩니다.

---

## Supabase 연동

- 프로젝트 ID: `pkwbqbxuujpcvndpacsc`
- URL: `https://pkwbqbxuujpcvndpacsc.supabase.co`
- Publishable Key 는 `supabase-config.js` 에 포함 (RLS public 정책으로 안전하게 노출).
- Edu-match 전용 테이블: `em_instructors`, `em_job_postings`, `em_applications`, `em_profiles`.

### GEMINI_API_KEY

`GEMINI_API_KEY` 는 Supabase Edge Function Secrets 에 저장되어 있으며,
`gemini-proxy` 엣지펑션을 통해 서버 측에서만 호출됩니다.
클라이언트는 API 키를 보지 않고, Edge Function 의 CORS 공개 엔드포인트만 호출합니다.

시크릿 관리: <https://supabase.com/dashboard/project/pkwbqbxuujpcvndpacsc/functions/secrets>

---

## AI 공고 생성 (관리자)

1. 관리자 로그인 → `admin.html`
2. **✦ AI 공고 생성 (Gemini)** 탭 진입
3. 주제 · 카테고리 · 대상 · 규모 입력 → 생성
4. 미리보기 카드가 렌더되며, "Supabase 자동 저장" 체크 시 `em_job_postings` 에 즉시 저장
5. 저장된 공고는 랜딩 페이지의 **강의 공고** 섹션에서 실시간으로 보여짐

Gemini 모델: `gemini-2.5-flash` · thinkingBudget=0 으로 빠른 응답.
JSON 배열 응답을 `extractJson()` 으로 파싱 후 `em_job_postings` 에 bulk insert.

---

## 페이지 흐름

| 경로 | 용도 |
|------|------|
| `/index.html` | Hero · 8개 카테고리 · 매칭 프로세스 · Supabase 강사진 · Supabase 공고 |
| `/signup.html` | 일반/강사 회원가입 (Supabase Auth + em_profiles) |
| `/login.html` | 일반 로그인 + 관리자 로그인 |
| `/admin.html` | 회원 · 강사 · 공고 · 지원내역 CRUD + AI 공고 생성 |

---

## 로컬 실행

```bash
python -m http.server 8080
# → http://localhost:8080/index.html
```

---

## GitHub Actions 자동 배포

`.github/workflows/deploy.yml` 에 정의된 워크플로가 `main` 브랜치 푸시 시
자동으로 정적 사이트를 GitHub Pages 에 배포합니다.

설정:

1. GitHub 리포지토리 → Settings → Pages → Source: **GitHub Actions**
2. `main` 브랜치에 푸시 → Actions 탭에서 빌드/배포 확인
3. 배포 완료 후 `https://<user>.github.io/<repo>/` 로 접속

---

## 보안 참고

- 관리자 계정은 프론트엔드 하드코딩입니다. 운영 전 Edge Function + service_role 기반 인증 교체 권장.
- 현재 `em_*` 테이블은 public CRUD 정책입니다. 운영 전 RLS 정책 강화 필요.
- Gemini API 키는 Edge Function Secrets 에만 존재하며 클라이언트에 노출되지 않습니다.
