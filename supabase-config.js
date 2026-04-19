// =========================================================
// Edu-match — Supabase Configuration
// =========================================================
// Supabase 프로젝트: pkwbqbxuujpcvndpacsc (NexGen ERP 프로젝트 공용)
// GEMINI_API_KEY 는 Supabase Edge Function Secrets 에 저장되어 있으며
// gemini-proxy 엣지펑션을 통해 안전하게 호출됩니다 (키는 클라이언트 노출 X).
// =========================================================

const SUPABASE_URL = "https://pkwbqbxuujpcvndpacsc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_09z4u2K4XVU5fUl2e532Fg_kqct0zez";

// Gemini 프록시 엣지펑션 (GEMINI_API_KEY 는 서버 측 비밀로 보관)
const GEMINI_PROXY_URL = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

// Supabase 클라이언트 (CDN 로드 후 window.supabase 사용)
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Edu-match 테이블 (ERP 테이블과의 충돌 방지용 em_ 접두사)
const EM_TABLES = {
  instructors: "em_instructors",
  jobs: "em_job_postings",
  applications: "em_applications",
  profiles: "em_profiles",
};

// 관리자 계정
const ADMIN_CREDENTIALS = {
  id: "admin1124",
  pw: "1124",
};

// 강의/서비스 카테고리
const SERVICE_CATEGORIES = [
  { key: "corporate-lecture", label: "기업출강 워크샵", icon: "🏢" },
  { key: "teambuilding", label: "팀빌딩 프로그램", icon: "🤝" },
  { key: "craft-experience", label: "공방체험", icon: "🎨" },
  { key: "diy-kit", label: "DIY키트", icon: "📦" },
  { key: "it-ai", label: "IT · AI 교육", icon: "💻" },
  { key: "leadership", label: "리더십 · 조직개발", icon: "👥" },
  { key: "design", label: "디자인 · UX", icon: "🎯" },
  { key: "data", label: "데이터 분석", icon: "📊" },
];

function categoryLabel(key) {
  const hit = SERVICE_CATEGORIES.find((c) => c.key === key);
  return hit ? hit.label : key || "";
}

// 인증 헬퍼: 현재 세션 사용자 가져오기
async function getCurrentUser() {
  if (!supabaseClient) return null;
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

// 관리자 세션 헬퍼
const ADMIN_SESSION_KEY = "edumatch_admin_session";
function isAdminLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}
function setAdminSession(flag) {
  if (flag) localStorage.setItem(ADMIN_SESSION_KEY, "true");
  else localStorage.removeItem(ADMIN_SESSION_KEY);
}

// Gemini 호출 헬퍼 (Edge Function 경유)
// systemPrompt + content 로 텍스트 생성. JSON 응답을 요청하려면 systemPrompt 에 명시.
async function callGemini({ systemPrompt, content, model, generationConfig } = {}) {
  const resp = await fetch(GEMINI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      systemPrompt,
      content,
      model: model || "gemini-2.5-flash",
      // 기본적으로 thinking 을 0 으로 설정해 응답 토큰이 즉시 반환되도록 함
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
        ...(generationConfig || {}),
      },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini proxy error ${resp.status}: ${text}`);
  }
  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { raw: json, text };
}

// JSON 블록만 추출하는 안전 파서
function extractJson(text) {
  if (!text) return null;
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/);
  const raw = match ? match[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    const firstBrace = raw.indexOf("{");
    const firstBracket = raw.indexOf("[");
    const startIdx = [firstBrace, firstBracket].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (startIdx === undefined) return null;
    const lastBrace = raw.lastIndexOf("}");
    const lastBracket = raw.lastIndexOf("]");
    const endIdx = Math.max(lastBrace, lastBracket);
    if (endIdx < 0) return null;
    try {
      return JSON.parse(raw.slice(startIdx, endIdx + 1));
    } catch {
      return null;
    }
  }
}

// 공개 (window에 노출)
window.EduMatch = {
  supabase: supabaseClient,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  GEMINI_PROXY_URL,
  TABLES: EM_TABLES,
  ADMIN_CREDENTIALS,
  SERVICE_CATEGORIES,
  categoryLabel,
  getCurrentUser,
  isAdminLoggedIn,
  setAdminSession,
  callGemini,
  extractJson,
};

// 구 참조 호환 (점진적 마이그레이션용)
window.HRDI = window.EduMatch;
