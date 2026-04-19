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
  const chipRow = (travelChip || shareChip)
    ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin: 8px 0 12px;">${shareChip}${travelChip}</div>`
    : "";

  const minPriceLink = job.min_price_ref_url
    ? `<div style="margin-top:8px; font-size:12px; color: var(--text-soft);">최소 단가 참고: <a href="${escapeHtml(job.min_price_ref_url)}" target="_blank" rel="noopener" style="color:#9ae6ff;">솜씨당Biz 동일 서비스 →</a></div>`
    : "";

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
          <span>${escapeHtml(job.budget || "협의")}</span>
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
      <a class="job-card__cta btn ${urgent ? "btn--primary" : "btn--ghost"}" href="#contact">지원하기 →</a>
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
      .limit(12);
    if (error) throw error;
    if (!data || data.length === 0) return; // 그대로 정적 데모 유지
    grid.innerHTML = data.map((j) => jobCardHtml(j, em.SERVICE_CATEGORIES)).join("");
    applyReveal(grid);
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
