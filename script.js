// =========================================================
// Edu-match Platform — Landing interactions + Supabase jobs feed
// =========================================================

// Year in footer
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Nav scroll state
const nav = document.querySelector(".nav");
const onScroll = () => {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", window.scrollY > 8);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Reveal-on-scroll
const revealSelectors =
  ".hero__title, .hero__lede, .hero__ctas, .hero__metrics, " +
  ".section__head, .about, .pillar, .instructor-card, .job-card, " +
  ".logos, .contact__card";
function applyReveal(root = document) {
  const targets = root.querySelectorAll(revealSelectors);
  targets.forEach((el) => {
    if (!el.hasAttribute("data-reveal")) {
      el.setAttribute("data-reveal", "");
      io.observe(el);
    }
  });
}

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
applyReveal();

// Animated counters
const counters = document.querySelectorAll("[data-counter]");
const countIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.getAttribute("data-counter")) || 0;
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
counters.forEach((el) => countIO.observe(el));

// =========================================================
// Supabase live feeds — jobs + instructors
// =========================================================

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function formatWon(n) {
  if (!n || Number(n) <= 0) return "무료";
  return Number(n).toLocaleString("ko-KR") + "원";
}

// 아주 가벼운 마크다운 → HTML (제목/굵게/기울임/링크/리스트/줄바꿈만 지원)
function tinyMarkdown(raw) {
  if (!raw) return "";
  let t = String(raw);
  t = t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])\*(.+?)\*(?=[\s.,)!?]|$)/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#9ae6ff;">$1</a>');
  // 제목
  t = t.replace(/^#{3}\s+(.+)$/gm, '<h4 style="margin:12px 0 4px; font-size:14px;">$1</h4>');
  t = t.replace(/^#{2}\s+(.+)$/gm, '<h3 style="margin:14px 0 6px; font-size:15px; font-weight:700;">$1</h3>');
  t = t.replace(/^#\s+(.+)$/gm,    '<h2 style="margin:16px 0 8px; font-size:16px; font-weight:800;">$1</h2>');
  // 리스트
  t = t.replace(/^(?:-\s+.+(?:\n|$))+?/gm, (block) => {
    const items = block.trim().split("\n").map((l) => l.replace(/^-\s+/, "")).map((l) => `<li>${l}</li>`).join("");
    return `<ul style="margin:6px 0 10px 18px; padding:0;">${items}</ul>`;
  });
  // 줄바꿈 (단, 이미 블록 태그가 들어간 줄은 제외)
  t = t.replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>");
  return t;
}

function jobCardHtml(job, cats) {
  const urgent = job.is_urgent;
  const catLabel = cats.find((c) => c.key === job.category)?.label || job.category || "";
  const tags = (job.tags || [])
    .slice(0, 5)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join("");
  const badge = urgent
    ? '<span class="job-badge job-badge--urgent">긴급</span>'
    : '<span class="job-badge">모집 중</span>';

  const travelChip = job.travel_fee_region
    ? `<span class="job-card__travel" title="강의 장소 기준 출장비">✈ ${escapeHtml(job.travel_fee_region)} · ${escapeHtml(formatWon(job.travel_fee_amount))}</span>`
    : "";
  const shareChip = Number(job.revenue_share_percent) > 0
    ? `<span class="job-card__share" title="강사 등록 공고 · 등록자 쉐어">🤝 강사 등록 · ${escapeHtml(job.revenue_share_percent)}% 쉐어${job.posted_by_name ? ` (${escapeHtml(job.posted_by_name)})` : ""}</span>`
    : "";
  const budgetLabel = (() => {
    if (job.budget_type === "per_hour" && job.budget_amount) return `시간당 ${formatWon(job.budget_amount)}`;
    if (job.budget_type === "per_course" && job.budget_amount) return `과정당 ${formatWon(job.budget_amount)}`;
    if (job.budget_type === "negotiable") return "예산 협의";
    return job.budget || "협의";
  })();
  const budgetChip = `<span class="job-card__budget" title="예산 / 단가">💰 ${escapeHtml(budgetLabel)}</span>`;
  const chipRow = `<div style="display:flex; gap:6px; flex-wrap:wrap; margin: 8px 0 12px;">${budgetChip}${shareChip}${travelChip}</div>`;

  // 단가 참고 링크: 공식 HRD-Net 로 기본 연결, 공고에 별도 URL 이 있으면 함께 노출
  const refUrl = job.min_price_ref_url && job.min_price_ref_url !== "https://sssdbiz.co.kr/search?serviceId=550a5eef-073f-4152-adbf-cdc92f2f0aa3"
    ? job.min_price_ref_url
    : "https://www.hrd.go.kr";
  const minPriceLink = `
    <div style="margin-top:8px; font-size:12px; color: var(--text-soft);">
      단가 참고: <a href="${escapeHtml(refUrl)}" target="_blank" rel="noopener" style="color:#9ae6ff;">고용노동부 HRD-Net →</a>
      · <a href="https://www.law.go.kr/LSW/admRulSc.do?menuId=1&subMenuId=15&query=%EC%A7%81%EC%97%85%EB%8A%A5%EB%A0%A5%EA%B0%9C%EB%B0%9C%ED%9B%88%EB%A0%A8+%EC%8B%A4%EC%8B%9C%EA%B8%B0%EC%A4%80" target="_blank" rel="noopener" style="color:#9ae6ff;">국가법령정보센터 「직업능력개발훈련 실시기준」 →</a>
    </div>`;

  const bodyHtml = job.body_content
    ? `<div class="job-card__body">${tinyMarkdown(job.body_content)}</div>
       <button type="button" class="job-card__body-toggle">본문 펼치기 ▾</button>`
    : "";

  const images = Array.isArray(job.body_images) ? job.body_images : [];
  const galleryHtml = images.length > 0
    ? `<div class="job-card__gallery">${images.slice(0, 6).map((m) => `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name || "첨부 이미지")}" loading="lazy" /></a>`).join("")}</div>`
    : "";

  return `
    <article class="job-card ${urgent ? "job-card--urgent" : ""}" data-job-id="${escapeHtml(job.id || "")}">
      <div class="job-card__header">
        <span class="job-card__org">${escapeHtml(job.organization)}</span>
        ${badge}
      </div>
      <h3 class="job-card__title">${escapeHtml(job.title)}</h3>
      ${chipRow}
      <p class="job-card__desc">${escapeHtml(job.description || "")}</p>
      <div class="job-card__details">
        <div class="job-card__detail">
          <span class="job-card__detail-label">기간</span>
          <span>${escapeHtml(job.period || "협의")}</span>
        </div>
        <div class="job-card__detail">
          <span class="job-card__detail-label">형태</span>
          <span>${escapeHtml(job.format || "offline")}</span>
        </div>
        <div class="job-card__detail">
          <span class="job-card__detail-label">대상</span>
          <span>${escapeHtml(job.target_audience || "—")}</span>
        </div>
        <div class="job-card__detail">
          <span class="job-card__detail-label">예산</span>
          <span>${escapeHtml(budgetLabel)}</span>
        </div>
        <div class="job-card__detail">
          <span class="job-card__detail-label">출장비</span>
          <span>${escapeHtml(job.travel_fee_region || "미선택")} · ${escapeHtml(formatWon(job.travel_fee_amount))}</span>
        </div>
        ${catLabel ? `<div class="job-card__detail"><span class="job-card__detail-label">분야</span><span>${escapeHtml(catLabel)}</span></div>` : ""}
      </div>
      <div class="job-card__tags">${tags}</div>
      ${bodyHtml}
      ${galleryHtml}
      ${minPriceLink}
      <div class="job-card__ctas">
        <button type="button" class="btn btn--detail job-card__detail-btn" data-job-id="${escapeHtml(job.id || "")}">자세히 보기</button>
        <a class="job-card__cta btn ${urgent ? "btn--primary" : "btn--ghost"}" href="#contact">지원하기 →</a>
      </div>
    </article>
  `;
}

const MATCH_INQUIRY_URL = "https://sssdbiz.co.kr/search?serviceId=550a5eef-073f-4152-adbf-cdc92f2f0aa3";

function instructorCardHtml(ins) {
  const avatarColor = ins.avatar_color || "a";
  const initial = ins.avatar_initial || (ins.name || "").charAt(0) || "?";
  const badgeMap = {
    hot: '<span class="instructor-card__badge instructor-card__badge--hot">인기</span>',
    pro: '<span class="instructor-card__badge">전문</span>',
    new: '<span class="instructor-card__badge">신규</span>',
  };
  const badge = badgeMap[ins.badge] || '<span class="instructor-card__badge">강사</span>';
  const tags = (ins.expertise || [])
    .slice(0, 4)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join("");
  const feature = ins.is_featured ? "instructor-card--feature" : "";
  const avatarInner = ins.avatar_url
    ? `<img src="${escapeHtml(ins.avatar_url)}" alt="${escapeHtml(ins.name)}" loading="lazy" referrerpolicy="no-referrer" />`
    : `<span>${escapeHtml(initial)}</span>`;
  return `
    <article class="instructor-card ${feature}" data-instructor-id="${escapeHtml(ins.id || "")}">
      <div class="instructor-card__header">
        <div class="instructor-card__avatar avatar--${escapeHtml(avatarColor)}${ins.avatar_url ? " instructor-card__avatar--photo" : ""}">
          ${avatarInner}
        </div>
        <div class="instructor-card__meta">
          ${badge}
          <div class="instructor-card__rating">★ ${escapeHtml(ins.rating ?? "—")} <span>(리뷰 ${escapeHtml(ins.review_count ?? 0)})</span></div>
        </div>
      </div>
      <h3 class="instructor-card__name">${escapeHtml(ins.name)}</h3>
      <p class="instructor-card__title">${escapeHtml(ins.title || "")}</p>
      <p class="instructor-card__bio">${escapeHtml(ins.bio || "")}</p>
      <div class="instructor-card__tags">${tags}</div>
      <div class="instructor-card__footer">
        <span class="instructor-card__exp">경력 ${escapeHtml(ins.experience_years || 0)}년</span>
        <a class="instructor-card__link" href="${MATCH_INQUIRY_URL}" target="_blank" rel="noopener">매칭 문의 →</a>
      </div>
    </article>
  `;
}

let __jobsCache = [];

function applyJobFilters(em) {
  const grid = document.querySelector("#jobs .jobs-grid");
  if (!grid) return;
  const q = (document.getElementById("jf-q")?.value || "").trim().toLowerCase();
  const cat = document.getElementById("jf-category")?.value || "";
  const fmt = document.getElementById("jf-format")?.value || "";
  const bt = document.getElementById("jf-budget")?.value || "";
  const urgentOnly = document.getElementById("jf-urgent")?.checked || false;
  const sort = document.getElementById("jf-sort")?.value || "recent";

  let list = __jobsCache.slice();
  if (q) {
    list = list.filter((j) => {
      const hay = [
        j.title, j.organization, j.description, j.body_content,
        (j.tags || []).join(" "), j.target_audience, j.period, j.budget,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  if (cat) list = list.filter((j) => j.category === cat);
  if (fmt) list = list.filter((j) => j.format === fmt);
  if (bt)  list = list.filter((j) => j.budget_type === bt);
  if (urgentOnly) list = list.filter((j) => j.is_urgent);

  if (sort === "recent") {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === "urgent") {
    list.sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent) || new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === "budget-high") {
    list.sort((a, b) => (b.budget_amount || 0) - (a.budget_amount || 0));
  } else if (sort === "budget-low") {
    list.sort((a, b) => (a.budget_amount || 0) - (b.budget_amount || 0));
  }

  const countEl = document.getElementById("jf-count");
  if (countEl) countEl.textContent = `총 ${__jobsCache.length}건 중 ${list.length}건 표시`;

  if (list.length === 0) {
    grid.innerHTML = `<p class="admin-empty" style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--text-soft);">조건에 맞는 공고가 없습니다.</p>`;
    return;
  }
  grid.innerHTML = list.map((j) => jobCardHtml(j, em.SERVICE_CATEGORIES)).join("");
  applyReveal(grid);
}

function bindJobFilters(em) {
  const ids = ["jf-q", "jf-category", "jf-format", "jf-budget", "jf-urgent", "jf-sort"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = el.tagName === "INPUT" && el.type === "search" ? "input" : "change";
    el.addEventListener(ev, () => applyJobFilters(em));
  });
  document.getElementById("jf-reset")?.addEventListener("click", () => {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = false;
      else el.value = id === "jf-sort" ? "recent" : "";
    });
    applyJobFilters(em);
  });
}

async function hydrateJobs(em) {
  const grid = document.querySelector("#jobs .jobs-grid");
  if (!grid || !em?.supabase) return;
  try {
    const { data, error } = await em.supabase
      .from(em.TABLES.jobs)
      .select("*")
      .eq("status", "open")
      .order("is_urgent", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    if (!data || data.length === 0) return;
    __jobsCache = data;
    bindJobFilters(em);
    applyJobFilters(em);
  } catch (err) {
    console.warn("[Edu-match] jobs hydrate failed:", err);
  }
}

async function hydrateInstructors(em) {
  const grid = document.querySelector("#instructors .instructors-grid");
  if (!grid || !em?.supabase) return;
  try {
    const { data, error } = await em.supabase
      .from(em.TABLES.instructors)
      .select("*")
      .order("is_featured", { ascending: false })
      .order("rating", { ascending: false })
      .limit(8);
    if (error) throw error;
    if (!data || data.length === 0) return;
    grid.innerHTML = data.map(instructorCardHtml).join("");
    applyReveal(grid);
  } catch (err) {
    console.warn("[Edu-match] instructors hydrate failed:", err);
  }
}

function bootEduMatchFeeds() {
  const em = window.EduMatch;
  if (!em) {
    // supabase-config.js 가 아직 로드되지 않은 경우 재시도
    setTimeout(bootEduMatchFeeds, 120);
    return;
  }
  hydrateJobs(em);
  hydrateInstructors(em);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEduMatchFeeds);
} else {
  bootEduMatchFeeds();
}

// =========================================================
// 매칭 문의 모달
// =========================================================
(function setupInquiryModal() {
  const modal = document.getElementById("em-modal");
  if (!modal) return;
  const contextEl = document.getElementById("em-modal-context");
  const titleEl = document.getElementById("em-modal-title");
  const msgEl = document.getElementById("em-inq-msg");
  const form = document.getElementById("em-inquiry-form");
  let currentRef = { instructorId: null, jobId: null, label: "" };

  function openModal(ref) {
    currentRef = ref || {};
    titleEl.textContent = "공고 지원하기";
    contextEl.textContent = ref.label
      ? `지원 대상: ${ref.label}`
      : "지원하실 공고 정보를 확인하고 지원서를 작성해주세요.";
    msgEl.textContent = "";
    msgEl.className = "em-modal__msg";
    modal.classList.add("is-open");
  }
  function closeModal() {
    modal.classList.remove("is-open");
    form.reset();
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-modal-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // 공고 카드의 "지원하기" 버튼만 모달 트리거
  document.body.addEventListener("click", (e) => {
    // 본문 펼치기 토글
    const toggle = e.target.closest(".job-card__body-toggle");
    if (toggle) {
      const body = toggle.previousElementSibling;
      if (body?.classList.contains("job-card__body")) {
        body.classList.toggle("is-open");
        toggle.textContent = body.classList.contains("is-open") ? "본문 접기 ▴" : "본문 펼치기 ▾";
      }
      return;
    }

    const hit = e.target.closest(".job-card__cta,[data-inquiry]");
    if (!hit) return;
    const card = hit.closest(".job-card");
    if (!card) return;
    e.preventDefault();
    const name = card.querySelector(".job-card__title")?.textContent?.trim() || "";
    const org = card.querySelector(".job-card__org")?.textContent?.trim() || "";
    openModal({
      instructorId: null,
      jobId: card.dataset?.jobId || null,
      label: org ? `${org} · ${name}` : name,
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const em = window.EduMatch;
    if (!em?.supabase) {
      msgEl.textContent = "Supabase 설정이 필요합니다.";
      msgEl.className = "em-modal__msg em-modal__msg--err";
      return;
    }
    const payload = {
      applicant_name: document.getElementById("em-inq-name").value.trim(),
      applicant_email: document.getElementById("em-inq-email").value.trim(),
      message: document.getElementById("em-inq-message").value.trim(),
      instructor_id: currentRef.instructorId || null,
      job_id: currentRef.jobId || null,
      status: "pending",
    };
    msgEl.textContent = "제출 중…";
    msgEl.className = "em-modal__msg em-modal__msg--ok";
    const { error } = await em.supabase.from(em.TABLES.applications).insert(payload);
    if (error) {
      msgEl.textContent = "제출 실패: " + error.message;
      msgEl.className = "em-modal__msg em-modal__msg--err";
      return;
    }
    msgEl.textContent = "접수되었습니다. 담당 매니저가 24시간 내 연락드립니다.";
    msgEl.className = "em-modal__msg em-modal__msg--ok";
    setTimeout(closeModal, 1400);
  });
})();

// =========================================================
// 공고 자세히 보기 모달
// =========================================================
(function setupDetailModal() {
  const modal = document.getElementById("em-detail-modal");
  if (!modal) return;
  const body = document.getElementById("em-detail-body");

  function open() { modal.classList.add("is-open"); }
  function close() { modal.classList.remove("is-open"); body.innerHTML = ""; }

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-modal-close]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".job-card__detail-btn");
    if (!btn) return;
    const jobId = btn.getAttribute("data-job-id");
    const job = (typeof __jobsCache !== "undefined" ? __jobsCache : []).find((j) => j.id === jobId);
    if (!job) return;

    const em = window.EduMatch;
    const cats = em?.SERVICE_CATEGORIES || [];
    const catLabel = cats.find((c) => c.key === job.category)?.label || job.category || "";
    const urgent = job.is_urgent;
    const images = Array.isArray(job.body_images) ? job.body_images : [];
    const heroImg = images[0]?.url;
    const budgetLabel = (() => {
      if (job.budget_type === "per_hour" && job.budget_amount) return `시간당 ${formatWon(job.budget_amount)}`;
      if (job.budget_type === "per_course" && job.budget_amount) return `과정당 ${formatWon(job.budget_amount)}`;
      if (job.budget_type === "negotiable") return "예산 협의";
      return job.budget || "협의";
    })();

    body.innerHTML = `
      <div class="em-modal__sub">${escapeHtml(job.organization || "")}</div>
      <h2 class="em-modal__title" style="margin-top: 4px;">${escapeHtml(job.title || "")}</h2>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin: 12px 0;">
        ${urgent ? '<span class="job-badge job-badge--urgent">긴급</span>' : '<span class="job-badge">모집 중</span>'}
        <span class="job-card__budget">💰 ${escapeHtml(budgetLabel)}</span>
        ${job.travel_fee_region ? `<span class="job-card__travel">✈ ${escapeHtml(job.travel_fee_region)} · ${escapeHtml(formatWon(job.travel_fee_amount))}</span>` : ""}
        ${Number(job.revenue_share_percent) > 0 ? `<span class="job-card__share">🤝 강사 등록 · ${escapeHtml(job.revenue_share_percent)}% 쉐어${job.posted_by_name ? ` (${escapeHtml(job.posted_by_name)})` : ""}</span>` : ""}
      </div>

      ${heroImg ? `<img class="detail-hero-img" src="${escapeHtml(heroImg)}" alt="대표 이미지" />` : ""}

      <div class="detail-section">
        <h4>개요</h4>
        <p style="white-space: pre-wrap; line-height: 1.7;">${escapeHtml(job.description || "")}</p>
      </div>

      <div class="detail-section">
        <h4>상세 정보</h4>
        <div class="job-card__details">
          <div class="job-card__detail"><span class="job-card__detail-label">기간</span><span>${escapeHtml(job.period || "협의")}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">형태</span><span>${escapeHtml(job.format || "offline")}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">대상</span><span>${escapeHtml(job.target_audience || "—")}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">예산</span><span>${escapeHtml(budgetLabel)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">출장비</span><span>${escapeHtml(job.travel_fee_region || "미선택")} · ${escapeHtml(formatWon(job.travel_fee_amount))}</span></div>
          ${catLabel ? `<div class="job-card__detail"><span class="job-card__detail-label">분야</span><span>${escapeHtml(catLabel)}</span></div>` : ""}
        </div>
      </div>

      ${job.body_content ? `
        <div class="detail-section">
          <h4>본문</h4>
          <div style="line-height:1.7;">${tinyMarkdown(job.body_content)}</div>
        </div>` : ""}

      ${images.length > 0 ? `
        <div class="detail-section">
          <h4>첨부 이미지 (${images.length}장)</h4>
          <div class="detail-gallery">
            ${images.map((m) => `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name || "")}" loading="lazy" /></a>`).join("")}
          </div>
        </div>` : ""}

      ${(job.tags || []).length > 0 ? `
        <div class="detail-section">
          <h4>태그</h4>
          <div class="job-card__tags">${(job.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
        </div>` : ""}

      <div class="detail-section" style="margin-top: 24px;">
        <a class="btn btn--primary" href="#contact" data-modal-close>지원하기 →</a>
        <button type="button" class="btn btn--ghost" data-modal-close style="margin-left: 8px;">닫기</button>
      </div>
    `;
    open();
  });
})();
