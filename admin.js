// =========================================================
// Edu-match — Admin Panel
// =========================================================
// 관리자 세션 검증 + Supabase CRUD + Gemini 기반 공고 생성
// =========================================================

(async function () {
  const em = window.EduMatch || {};
  const supabase = em.supabase;
  const TABLES = em.TABLES || {
    instructors: "em_instructors",
    jobs: "em_job_postings",
    applications: "em_applications",
    profiles: "em_profiles",
  };

  // ---------- 세션 가드 (Edge Function 검증) ----------
  if (typeof em.adminVerify !== "function" || typeof em.getAdminToken !== "function") {
    alert("관리자 인증 모듈이 로드되지 않았습니다.");
    window.location.href = "./login.html";
    return;
  }
  if (!em.getAdminToken()) {
    alert("관리자 인증이 필요합니다. 로그인 페이지로 이동합니다.");
    window.location.href = "./login.html";
    return;
  }
  const ok = await em.adminVerify();
  if (!ok) {
    em.clearAdminToken && em.clearAdminToken();
    alert("관리자 세션이 만료되었습니다. 다시 로그인해주세요.");
    window.location.href = "./login.html";
    return;
  }

  // ---------- 시계 표시 ----------
  const timeEl = document.getElementById("admin-time");
  function updateTime() {
    if (!timeEl) return;
    const now = new Date();
    timeEl.textContent = now.toLocaleString("ko-KR");
  }
  updateTime();
  setInterval(updateTime, 1000 * 30);

  // ---------- 로그아웃 ----------
  const logoutBtn = document.getElementById("admin-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      em.clearAdminToken && em.clearAdminToken();
      window.location.href = "./index.html";
    });
  }

  // ---------- 탭 전환 ----------
  const tabBtns = document.querySelectorAll(".admin-tab-btn");
  const panels = document.querySelectorAll(".admin-panel");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-panel");
      tabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      panels.forEach((p) => p.classList.toggle("is-active", p.getAttribute("data-panel") === key));
    });
  });

  // ---------- 유틸 ----------
  function fmtDate(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("ko-KR") + " " + d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  function emptyRow(cols, text) {
    return `<tr><td colspan="${cols}" class="admin-empty">${text}</td></tr>`;
  }
  function safeText(v) {
    if (v === null || v === undefined) return "—";
    return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function showFormMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = "auth-message is-shown auth-message--" + (type || "error");
  }
  function mustSupabase() {
    if (!supabase) {
      alert("Supabase 설정이 필요합니다. supabase-config.js 를 확인해주세요.");
      return false;
    }
    return true;
  }

  // ---------- 회원 목록 ----------
  async function loadUsers() {
    const tbody = document.getElementById("users-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(7, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(7, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(7, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(7, "등록된 회원이 없습니다."); return; }
    tbody.innerHTML = data.map((u) => `
      <tr>
        <td>${safeText(u.name)}</td>
        <td>${safeText(u.email)}</td>
        <td>${safeText(u.phone)}</td>
        <td>${safeText(u.role)}</td>
        <td>${safeText(u.category)}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td><button class="admin-action" data-action="delete-user" data-id="${u.id}">삭제</button></td>
      </tr>
    `).join("");
    const statUsers = document.getElementById("stat-users");
    if (statUsers) statUsers.textContent = data.length;
  }

  // ---------- 강사 목록 ----------
  async function loadInstructors() {
    const tbody = document.getElementById("instructors-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(7, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(7, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.instructors)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(7, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(7, "등록된 강사가 없습니다."); return; }
    tbody.innerHTML = data.map((i) => `
      <tr>
        <td>${safeText(i.name)}</td>
        <td>${safeText(i.title)}</td>
        <td>${safeText(em.categoryLabel ? em.categoryLabel(i.category) : i.category)}</td>
        <td>${safeText(i.experience_years)}년</td>
        <td>★ ${safeText(i.rating)}</td>
        <td>${fmtDate(i.created_at)}</td>
        <td><button class="admin-action" data-action="delete-instructor" data-id="${i.id}">삭제</button></td>
      </tr>
    `).join("");
    const statIns = document.getElementById("stat-instructors");
    if (statIns) statIns.textContent = data.length;
  }

  // ---------- 공고 목록 ----------
  async function loadJobs() {
    const tbody = document.getElementById("jobs-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(7, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(7, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.jobs)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(7, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(7, "등록된 공고가 없습니다."); return; }
    const openCount = data.filter((j) => j.status === "open").length;
    tbody.innerHTML = data.map((j) => `
      <tr>
        <td>${safeText(j.organization)}</td>
        <td>${safeText(j.title)}</td>
        <td>${safeText(em.categoryLabel ? em.categoryLabel(j.category) : j.category)}</td>
        <td>${safeText(j.period)}</td>
        <td>${safeText(j.status)}</td>
        <td>${fmtDate(j.created_at)}</td>
        <td><button class="admin-action" data-action="delete-job" data-id="${j.id}">삭제</button></td>
      </tr>
    `).join("");
    const statJobs = document.getElementById("stat-jobs");
    if (statJobs) statJobs.textContent = openCount;
  }

  // ---------- 지원 내역 ----------
  async function loadApplications() {
    const tbody = document.getElementById("applications-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(6, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(6, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.applications)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(6, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(6, "지원 내역이 없습니다."); return; }
    tbody.innerHTML = data.map((a) => `
      <tr>
        <td>${safeText(a.job_id)}</td>
        <td>${safeText(a.instructor_id)}</td>
        <td>${safeText(a.message)}</td>
        <td>${safeText(a.status)}</td>
        <td>${fmtDate(a.created_at)}</td>
        <td><button class="admin-action" data-action="delete-application" data-id="${a.id}">삭제</button></td>
      </tr>
    `).join("");
    const statApps = document.getElementById("stat-applications");
    if (statApps) statApps.textContent = data.length;
  }

  // ---------- 이벤트 위임 (삭제) ----------
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id || !mustSupabase()) return;

    const tableMap = {
      "delete-user": TABLES.profiles,
      "delete-instructor": TABLES.instructors,
      "delete-job": TABLES.jobs,
      "delete-application": TABLES.applications,
    };
    const table = tableMap[action];
    if (!table) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    if (action === "delete-user") loadUsers();
    else if (action === "delete-instructor") loadInstructors();
    else if (action === "delete-job") loadJobs();
    else if (action === "delete-application") loadApplications();
  });

  // ---------- 새로고침 ----------
  document.getElementById("refresh-users")?.addEventListener("click", loadUsers);
  document.getElementById("refresh-instructors")?.addEventListener("click", loadInstructors);
  document.getElementById("refresh-jobs")?.addEventListener("click", loadJobs);
  document.getElementById("refresh-applications")?.addEventListener("click", loadApplications);

  // ---------- 신규 공고 등록 ----------
  const newJobForm = document.getElementById("new-job-form");
  if (newJobForm) {
    newJobForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("new-job-message");
      if (!mustSupabase()) return;
      const payload = {
        organization: document.getElementById("job-org").value.trim(),
        title: document.getElementById("job-title").value.trim(),
        description: document.getElementById("job-desc").value.trim(),
        category: document.getElementById("job-category").value,
        format: document.getElementById("job-format").value,
        period: document.getElementById("job-period").value.trim(),
        target_audience: document.getElementById("job-target").value.trim(),
        budget: document.getElementById("job-budget").value.trim(),
        tags: document.getElementById("job-tags").value.split(",").map((s) => s.trim()).filter(Boolean),
        is_urgent: document.getElementById("job-urgent").checked,
        status: "open",
        source: "manual",
      };
      const { error } = await supabase.from(TABLES.jobs).insert(payload);
      if (error) { showFormMessage(msg, "등록 실패: " + error.message, "error"); return; }
      showFormMessage(msg, "공고 등록 완료!", "success");
      newJobForm.reset();
      loadJobs();
    });
  }

  // ---------- 신규 강사 등록 ----------
  const newInsForm = document.getElementById("new-instructor-form");
  if (newInsForm) {
    newInsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("new-instructor-message");
      if (!mustSupabase()) return;
      const payload = {
        name: document.getElementById("ins-name").value.trim(),
        title: document.getElementById("ins-title").value.trim(),
        bio: document.getElementById("ins-bio").value.trim(),
        category: document.getElementById("ins-category").value,
        experience_years: Number(document.getElementById("ins-exp").value) || 0,
        expertise: document.getElementById("ins-expertise").value.split(",").map((s) => s.trim()).filter(Boolean),
        rating: Number(document.getElementById("ins-rating").value) || 0,
      };
      const { error } = await supabase.from(TABLES.instructors).insert(payload);
      if (error) { showFormMessage(msg, "등록 실패: " + error.message, "error"); return; }
      showFormMessage(msg, "강사 등록 완료!", "success");
      newInsForm.reset();
      loadInstructors();
    });
  }

  // ---------- Gemini AI 공고 생성 ----------
  const aiForm = document.getElementById("ai-generate-form");
  const aiPreview = document.getElementById("ai-preview");

  function renderPreview(jobs) {
    if (!aiPreview) return;
    if (!jobs || jobs.length === 0) {
      aiPreview.innerHTML = `<p class="admin-empty">생성된 공고가 없습니다.</p>`;
      return;
    }
    aiPreview.innerHTML = jobs
      .map(
        (j, idx) => `
      <article class="job-card ${j.is_urgent ? "job-card--urgent" : ""}">
        <div class="job-card__header">
          <span class="job-card__org">${safeText(j.organization)}</span>
          <span class="job-badge ${j.is_urgent ? "job-badge--urgent" : ""}">${j.is_urgent ? "긴급" : "모집 중"}</span>
        </div>
        <h3 class="job-card__title">${safeText(j.title)}</h3>
        <p class="job-card__desc">${safeText(j.description)}</p>
        <div class="job-card__details">
          <div class="job-card__detail"><span class="job-card__detail-label">기간</span><span>${safeText(j.period)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">형태</span><span>${safeText(j.format)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">대상</span><span>${safeText(j.target_audience)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">예산</span><span>${safeText(j.budget)}</span></div>
        </div>
        <div class="job-card__tags">${(j.tags || []).map((t) => `<span>${safeText(t)}</span>`).join("")}</div>
        <div style="display:flex; gap:10px; margin-top: 12px;">
          <button class="admin-action admin-action--primary" data-ai-action="save" data-idx="${idx}">이 공고 저장</button>
        </div>
      </article>
    `
      )
      .join("");
  }

  let lastGenerated = [];

  if (aiForm) {
    aiForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msgEl = document.getElementById("ai-generate-message");
      const submitBtn = document.getElementById("ai-generate-submit");
      if (typeof em.callGemini !== "function") {
        showFormMessage(msgEl, "Gemini 프록시가 설정되지 않았습니다.", "error");
        return;
      }

      const topic = document.getElementById("ai-topic").value.trim();
      const category = document.getElementById("ai-category").value;
      const orgType = document.getElementById("ai-org-type").value.trim();
      const audience = document.getElementById("ai-audience").value.trim();
      const format = document.getElementById("ai-format").value;
      const count = Math.min(5, Math.max(1, Number(document.getElementById("ai-count").value) || 3));
      const shouldSave = document.getElementById("ai-save").checked;

      if (!topic) {
        showFormMessage(msgEl, "교육 주제를 입력해주세요.", "error");
        return;
      }

      submitBtn.disabled = true;
      showFormMessage(msgEl, "Gemini 로 공고 초안 생성 중… (10~20초 소요)", "success");

      const categoryLabel = em.categoryLabel ? em.categoryLabel(category) : category;

      const systemPrompt = `
당신은 한국의 기업출강/교강사 매칭 플랫폼 'Edu-match' 의 공고 편집자입니다.
다음 조건에 맞는 실제로 존재할 법한 강의 공고를 ${count} 개 생성하세요.

조건:
- 카테고리: ${categoryLabel} (${category})
- 주제/키워드: ${topic}
- 수요 기관 유형: ${orgType}
- 대상/규모: ${audience}
- 형태: ${format}

응답은 반드시 다음 스키마의 JSON 배열로만 작성하세요. 다른 텍스트는 포함하지 마세요.
[
  {
    "organization": "실제 느낌의 기관/기업명",
    "title": "공고 제목 (40자 이내)",
    "description": "공고 설명 (120자 내외, 커리큘럼 뉘앙스 포함)",
    "category": "${category}",
    "format": "${format}",
    "period": "실제 기간 문자열 예) 2026.06 ~ 2026.08 (3개월)",
    "target_audience": "수강 대상과 인원",
    "budget": "강사비 또는 시급 범위",
    "tags": ["3~5개 키워드 태그"],
    "is_urgent": false
  }
]
반드시 서로 다른 기관, 서로 다른 구체적 기간과 예산을 제시하세요.
중 1건은 is_urgent=true 로 표시해도 좋습니다.
`.trim();

      try {
        const { text } = await em.callGemini({
          systemPrompt,
          content: `카테고리=${categoryLabel}, 주제=${topic}, 대상=${audience}`,
          generationConfig: { temperature: 0.9, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
        });
        const parsed = em.extractJson(text);
        if (!Array.isArray(parsed)) throw new Error("Gemini 응답을 JSON 배열로 파싱하지 못했습니다.");

        lastGenerated = parsed.map((j) => ({
          organization: j.organization || orgType || "미정 기관",
          title: j.title || `${topic} 교육 강사 모집`,
          description: j.description || "",
          category: j.category || category,
          format: j.format || format,
          period: j.period || "협의",
          target_audience: j.target_audience || audience,
          budget: j.budget || "협의",
          tags: Array.isArray(j.tags) ? j.tags : [],
          is_urgent: Boolean(j.is_urgent),
          status: "open",
          source: "ai-gemini",
        }));

        renderPreview(lastGenerated);

        if (shouldSave && lastGenerated.length) {
          if (!mustSupabase()) return;
          const { error } = await supabase.from(TABLES.jobs).insert(lastGenerated);
          if (error) {
            showFormMessage(msgEl, `${lastGenerated.length}건 초안 생성 · 저장 실패: ${error.message}`, "error");
          } else {
            showFormMessage(msgEl, `${lastGenerated.length}건 공고 생성 및 Supabase 저장 완료!`, "success");
            loadJobs();
          }
        } else {
          showFormMessage(msgEl, `${lastGenerated.length}건 공고 초안 생성 완료. 개별 저장 버튼을 누르세요.`, "success");
        }
      } catch (err) {
        console.error(err);
        showFormMessage(msgEl, "생성 실패: " + (err.message || err), "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // 개별 저장 버튼
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-ai-action='save']");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    const job = lastGenerated[idx];
    if (!job || !mustSupabase()) return;
    const { error } = await supabase.from(TABLES.jobs).insert(job);
    const msg = document.getElementById("ai-generate-message");
    if (error) { showFormMessage(msg, "저장 실패: " + error.message, "error"); return; }
    showFormMessage(msg, "선택한 공고를 저장했습니다.", "success");
    loadJobs();
  });

  // ---------- 강사 승인 대기열 ----------
  async function loadApprovals() {
    const tbody = document.getElementById("approvals-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(6, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(6, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.instructors)
      .select("*")
      .eq("is_approved", false)
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(6, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(6, "승인 대기 강사가 없습니다."); return; }
    tbody.innerHTML = data.map((i) => `
      <tr>
        <td>${safeText(i.name)}</td>
        <td>${safeText(i.title)}</td>
        <td>${safeText(em.categoryLabel ? em.categoryLabel(i.category) : i.category)}</td>
        <td>${safeText(i.experience_years)}년</td>
        <td>${fmtDate(i.created_at)}</td>
        <td>
          <button class="admin-action admin-action--primary" data-action="approve-instructor" data-id="${i.id}">승인</button>
          <button class="admin-action" data-action="reject-instructor" data-id="${i.id}">거절</button>
        </td>
      </tr>
    `).join("");
  }

  // ---------- 강의자료 승인 ----------
  async function loadMaterialsAdmin() {
    const tbody = document.getElementById("materials-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(7, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(7, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.materials)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(7, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(7, "등록된 자료가 없습니다."); return; }
    tbody.innerHTML = data.map((m) => `
      <tr>
        <td>${safeText(m.title)}</td>
        <td>${safeText(em.categoryLabel ? em.categoryLabel(m.category) : m.category)}</td>
        <td>${safeText(m.uploaded_by_name || m.uploaded_by_email)}</td>
        <td>${m.material_url ? `<a href="${safeText(m.material_url)}" target="_blank" rel="noopener">열기</a>` : "—"}</td>
        <td>${m.is_approved ? "✔ 승인" : "⏳ 대기"}</td>
        <td>${fmtDate(m.created_at)}</td>
        <td>
          ${m.is_approved
            ? `<button class="admin-action" data-action="unapprove-material" data-id="${m.id}">승인 해제</button>`
            : `<button class="admin-action admin-action--primary" data-action="approve-material" data-id="${m.id}">승인</button>`}
          <button class="admin-action" data-action="delete-material" data-id="${m.id}">삭제</button>
        </td>
      </tr>
    `).join("");
  }

  // ---------- PBL 의뢰 ----------
  async function loadPbl() {
    const tbody = document.getElementById("pbl-tbody");
    if (!tbody) return;
    if (!mustSupabase()) { tbody.innerHTML = emptyRow(7, "Supabase 설정 필요"); return; }
    tbody.innerHTML = emptyRow(7, "불러오는 중…");
    const { data, error } = await supabase
      .from(TABLES.pblRequests)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = emptyRow(7, "오류: " + error.message); return; }
    if (!data || data.length === 0) { tbody.innerHTML = emptyRow(7, "등록된 의뢰가 없습니다."); return; }
    tbody.innerHTML = data.map((p) => `
      <tr>
        <td>${safeText(p.requester_name)}<br/><span class="admin-header__meta">${safeText(p.requester_email)}</span></td>
        <td>${safeText(p.organization)}</td>
        <td>${safeText(p.topic)}<br/><span class="admin-header__meta">${safeText(p.domain)}</span></td>
        <td>${safeText(p.audience_size)}명 / ${safeText(p.duration_hours)}h</td>
        <td>
          <select data-action="pbl-status" data-id="${p.id}" class="admin-action">
            ${["pending","reviewing","drafted","delivered","closed"].map((s) =>
              `<option value="${s}" ${p.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </td>
        <td>${fmtDate(p.created_at)}</td>
        <td>
          <button class="admin-action" data-action="pbl-detail" data-id="${p.id}">상세</button>
          <button class="admin-action" data-action="delete-pbl" data-id="${p.id}">삭제</button>
        </td>
      </tr>
    `).join("");
  }

  async function renderPblDetail(id) {
    const root = document.getElementById("pbl-detail");
    if (!root) return;
    const { data: req } = await supabase.from(TABLES.pblRequests).select("*").eq("id", id).maybeSingle();
    const { data: mats } = await supabase.from(TABLES.pblMaterials).select("*").eq("request_id", id).order("created_at", { ascending: true });
    if (!req) { root.innerHTML = `<p class="admin-empty">의뢰를 찾을 수 없습니다.</p>`; return; }
    root.innerHTML = `
      <article class="job-card">
        <div class="job-card__header">
          <span class="job-card__org">${safeText(req.organization || "—")}</span>
          <span class="job-badge">${safeText(req.status)}</span>
        </div>
        <h3 class="job-card__title">${safeText(req.topic)}</h3>
        <p class="job-card__desc"><strong>학습목표:</strong> ${safeText(req.objectives || "—")}</p>
        <div class="job-card__details">
          <div class="job-card__detail"><span class="job-card__detail-label">의뢰자</span><span>${safeText(req.requester_name)} · ${safeText(req.requester_email)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">연락처</span><span>${safeText(req.requester_phone || "—")}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">분야</span><span>${safeText(req.domain)} · ${safeText(req.target_level)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">규모</span><span>${safeText(req.audience_size)}명 / ${safeText(req.duration_hours)}h / ${safeText(req.deliverable_format)}</span></div>
          <div class="job-card__detail"><span class="job-card__detail-label">비고</span><span>${safeText(req.notes || "—")}</span></div>
        </div>
        <div style="margin-top:14px;">
          <strong>첨부 자료 (${(mats||[]).length}건)</strong>
          <ul style="margin:8px 0 0; padding-left: 18px;">
            ${(mats||[]).map((m) => `<li>${safeText(m.name)} — ${m.url ? `<a href="${safeText(m.url)}" target="_blank" rel="noopener">${safeText(m.url)}</a>` : "(링크 없음)"}</li>`).join("") || "<li>첨부 자료 없음</li>"}
          </ul>
        </div>
      </article>
    `;
  }

  // 승인 / 상태변경 이벤트 위임
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id || !mustSupabase()) return;

    if (action === "approve-instructor") {
      const { error } = await supabase.from(TABLES.instructors).update({ is_approved: true }).eq("id", id);
      if (error) return alert("승인 실패: " + error.message);
      loadApprovals(); loadInstructors();
    } else if (action === "reject-instructor") {
      if (!confirm("강사 등록을 거절하고 삭제할까요?")) return;
      const { error } = await supabase.from(TABLES.instructors).delete().eq("id", id);
      if (error) return alert("거절 실패: " + error.message);
      loadApprovals(); loadInstructors();
    } else if (action === "approve-material") {
      const { error } = await supabase.from(TABLES.materials).update({ is_approved: true }).eq("id", id);
      if (error) return alert("승인 실패: " + error.message);
      loadMaterialsAdmin();
    } else if (action === "unapprove-material") {
      const { error } = await supabase.from(TABLES.materials).update({ is_approved: false }).eq("id", id);
      if (error) return alert("승인 해제 실패: " + error.message);
      loadMaterialsAdmin();
    } else if (action === "delete-material") {
      if (!confirm("자료를 삭제할까요?")) return;
      const { error } = await supabase.from(TABLES.materials).delete().eq("id", id);
      if (error) return alert("삭제 실패: " + error.message);
      loadMaterialsAdmin();
    } else if (action === "delete-pbl") {
      if (!confirm("PBL 의뢰를 삭제할까요?")) return;
      const { error } = await supabase.from(TABLES.pblRequests).delete().eq("id", id);
      if (error) return alert("삭제 실패: " + error.message);
      loadPbl();
    } else if (action === "pbl-detail") {
      renderPblDetail(id);
    }
  });

  document.body.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-action='pbl-status']");
    if (!sel) return;
    const id = sel.getAttribute("data-id");
    const status = sel.value;
    const { error } = await supabase.from(TABLES.pblRequests).update({ status }).eq("id", id);
    if (error) return alert("상태 변경 실패: " + error.message);
  });

  document.getElementById("refresh-approvals")?.addEventListener("click", loadApprovals);
  document.getElementById("refresh-materials")?.addEventListener("click", loadMaterialsAdmin);
  document.getElementById("refresh-pbl")?.addEventListener("click", loadPbl);

  // ---------- 딥리서치 ----------
  const drForm = document.getElementById("deep-research-form");
  if (drForm) {
    drForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("dr-message");
      const result = document.getElementById("dr-result");
      const submit = document.getElementById("dr-submit");
      const topic = document.getElementById("dr-topic").value.trim() || "한국 기업 교육 · 강사 모집 공고";
      const count = Math.min(12, Math.max(3, Number(document.getElementById("dr-count").value) || 8));
      const categories = document.getElementById("dr-cats").value.split(",").map((s) => s.trim()).filter(Boolean);
      const saveMode = document.getElementById("dr-mode").value;
      submit.disabled = true;
      showFormMessage(msg, "Google Search 그라운딩 + Gemini 로 리서치 중… (20~40초 소요)", "success");
      try {
        const resp = await fetch(em.DEEP_RESEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: em.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${em.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ topic, count, categories, saveMode }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        showFormMessage(msg, `${data.count}건 저장 완료 · 그라운딩 출처 ${data.groundingAttributions}개 활용.`, "success");
        if (Array.isArray(data.jobs)) {
          result.innerHTML = data.jobs.map((j) => `
            <article class="job-card ${j.is_urgent ? "job-card--urgent" : ""}">
              <div class="job-card__header">
                <span class="job-card__org">${safeText(j.organization)}</span>
                <span class="job-badge">${j.is_urgent ? "긴급" : "모집 중"}</span>
              </div>
              <h3 class="job-card__title">${safeText(j.title)}</h3>
              <p class="job-card__desc">${safeText(j.description)}</p>
              <div class="job-card__details">
                <div class="job-card__detail"><span class="job-card__detail-label">기간</span><span>${safeText(j.period)}</span></div>
                <div class="job-card__detail"><span class="job-card__detail-label">형태</span><span>${safeText(j.format)}</span></div>
                <div class="job-card__detail"><span class="job-card__detail-label">대상</span><span>${safeText(j.target_audience)}</span></div>
                <div class="job-card__detail"><span class="job-card__detail-label">예산</span><span>${safeText(j.budget)}</span></div>
              </div>
              <div class="job-card__tags">${(j.tags || []).map((t) => `<span>${safeText(t)}</span>`).join("")}</div>
            </article>`).join("");
        }
        loadJobs();
      } catch (err) {
        showFormMessage(msg, "딥리서치 실패: " + (err.message || err), "error");
      } finally {
        submit.disabled = false;
      }
    });
  }

  // ---------- 초기 로드 ----------
  loadUsers();
  loadInstructors();
  loadJobs();
  loadApplications();
  loadApprovals();
  loadMaterialsAdmin();
  loadPbl();
})();
