// =========================================================
// Edu-match Landing (Tailwind rebuild) — app logic
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { console.error("[Edu-match] Supabase client not ready"); return; }
  const supabase = EM.client;

  // ---------- helpers ----------
  const qs = (s, r) => (r || document).querySelector(s);
  const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));

  const formatKRW = (n) => {
    if (!n || Number(n) <= 0) return "협의";
    return Number(n).toLocaleString("ko-KR") + "원";
  };
  const escape = (v) => v == null ? "" : String(v)
    .replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function openModal(id) { const m = qs("#" + id); if (!m) return; m.classList.remove("hidden"); m.classList.add("flex"); }
  function closeModal(el) { el.classList.add("hidden"); el.classList.remove("flex"); }
  qsa("[data-close]").forEach((b) => b.addEventListener("click", (e) => closeModal(e.target.closest('[id^="modal-"]'))));
  qsa('[id^="modal-"]').forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    qsa('[id^="modal-"]:not(.hidden)').forEach(closeModal);
  });

  // ---------- KPIs ----------
  async function loadKpis() {
    try {
      const [lec, pro, jobs, matches] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "lecturer"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("membership", "pro"),
        supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("matching_requests").select("id", { count: "exact", head: true }).eq("status", "completed"),
      ]);
      qs("#kpi-lecturers").textContent = lec.count ?? 0;
      qs("#kpi-pros").textContent = pro.count ?? 0;
      qs("#kpi-jobs").textContent = jobs.count ?? 0;
      qs("#kpi-matches").textContent = matches.count ?? 0;
    } catch (err) {
      console.warn("KPI load error:", err);
    }
  }

  // ---------- JOBS ----------
  let __jobs = [];
  async function loadJobs() {
    const grid = qs("#jobs-grid");
    try {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("status", "open")
        .order("is_premium", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      __jobs = data || [];
      renderJobs(__jobs);
    } catch (err) {
      console.warn(err);
      grid.innerHTML = `<div class="col-span-full text-sm text-red-600">공고 불러오기 실패: ${escape(err.message)}</div>`;
    }
  }

  function renderJobs(list) {
    const grid = qs("#jobs-grid");
    if (!list.length) {
      grid.innerHTML = `<div class="col-span-full text-sm text-slate-400 text-center py-12">조건에 맞는 공고가 없습니다.</div>`;
      return;
    }
    grid.innerHTML = list.map((j) => `
      <article class="relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition">
        ${j.is_premium ? '<div class="absolute -top-2 -right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900 text-[11px] font-bold shadow">⭐ PREMIUM</div>' : ''}
        <div class="flex items-start justify-between gap-2">
          <span class="text-xs font-semibold text-brand-600">${escape(j.category || "분야 미지정")}</span>
          <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">모집 중</span>
        </div>
        <h3 class="mt-2 font-bold text-lg leading-snug">${escape(j.title)}</h3>
        <p class="mt-2 text-sm text-slate-600 line-clamp-3">${escape(j.description || "")}</p>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-sm font-bold text-slate-900">${escape(formatKRW(j.budget))}</span>
          <button data-apply-id="${escape(j.id)}" data-apply-title="${escape(j.title)}" class="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition">지원하기 →</button>
        </div>
      </article>
    `).join("");
  }

  // Search
  qs("#jobs-search")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return renderJobs(__jobs);
    const filtered = __jobs.filter((j) => [j.title, j.description, j.category].filter(Boolean).join(" ").toLowerCase().includes(q));
    renderJobs(filtered);
  });

  // Apply buttons
  document.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-apply-id]");
    if (!b) return;
    qs("#apply-job-id").value = b.getAttribute("data-apply-id");
    qs("#apply-job-title").textContent = "대상 공고: " + b.getAttribute("data-apply-title");
    openModal("modal-apply");
  });

  // ---------- Apply form submit ----------
  qs("#apply-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const job_id = qs("#apply-job-id").value;
    const applicant_name = String(fd.get("applicant_name") || "").trim();
    const applicant_email = String(fd.get("applicant_email") || "").trim();
    const proposal = String(fd.get("proposal") || "").trim();
    const file = fd.get("resume");
    const consent = fd.get("consent") === "on";

    if (!consent) return EM.toast("개인정보 수집·활용 동의가 필요합니다.", "warn");
    if (applicant_name.length < 2) return EM.toast("강사 성함을 입력해주세요.", "warn");
    if (!/.+@.+\..+/.test(applicant_email)) return EM.toast("이메일을 확인해주세요.", "warn");
    if (proposal.length < 10) return EM.toast("제안서를 10자 이상 입력해주세요.", "warn");

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "제출 중…";

    try {
      let resume_url = null;
      if (file && file.size > 0) {
        if (file.size > 10 * 1024 * 1024) throw new Error("이력서는 10MB 이하여야 합니다.");
        resume_url = await EM.uploadResume(file, applicant_email);
      }
      const { error } = await supabase.from("applications").insert({
        job_id, applicant_name, applicant_email, resume_url, proposal, status: "pending",
      });
      if (error) throw error;
      EM.toast("지원서가 접수되었습니다. 담당자가 검토 후 연락드립니다.", "ok");
      form.reset();
      closeModal(qs("#modal-apply"));
    } catch (err) {
      console.error(err);
      EM.toast("제출 실패: " + err.message, "err");
    } finally {
      btn.disabled = false; btn.textContent = "지원서 제출";
    }
  });

  // ---------- Matching request ----------
  qs("#btn-open-match")?.addEventListener("click", () => openModal("modal-match"));
  qsa('a[href="#contact-match"]').forEach((a) => a.addEventListener("click", (e) => {
    // allow default anchor scroll; also open modal for quick access on mobile
  }));

  qs("#match-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const payload = {
      client_name: String(fd.get("client_name") || "").trim(),
      company: String(fd.get("company") || "").trim(),
      category: String(fd.get("category") || "").trim(),
      budget: Number(fd.get("budget")) || null,
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      status: "pending",
      consent_agreed: fd.get("consent") === "on",
    };

    if (!payload.consent_agreed) return EM.toast("개인정보 수집·활용 동의가 필요합니다.", "warn");
    if (payload.client_name.length < 2) return EM.toast("담당자 성함을 입력해주세요.", "warn");
    if (!/.+@.+\..+/.test(payload.email)) return EM.toast("이메일을 확인해주세요.", "warn");
    if (payload.message.length < 10) return EM.toast("요청 내용을 10자 이상 작성해주세요.", "warn");

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "제출 중…";

    try {
      const { error } = await supabase.from("matching_requests").insert(payload);
      if (error) throw error;
      EM.toast("매칭 문의가 접수되었습니다. 48시간 내 매니저가 회신드립니다.", "ok");
      form.reset();
      closeModal(qs("#modal-match"));
      loadKpis();
    } catch (err) {
      console.error(err);
      EM.toast("제출 실패: " + err.message, "err");
    } finally {
      btn.disabled = false; btn.textContent = "문의 제출";
    }
  });

  // ---------- Auth modal ----------
  const authBtn = qs("#nav-auth-btn");
  const authForm = qs("#auth-form");
  let authMode = "signin";

  function syncAuthMode() {
    qsa("[data-auth-tab]").forEach((t) => {
      const active = t.getAttribute("data-auth-tab") === authMode;
      t.classList.toggle("bg-white", active);
      t.classList.toggle("shadow-sm", active);
      t.classList.toggle("text-slate-600", !active);
    });
    qsa("[data-auth-only]").forEach((el) => {
      el.classList.toggle("hidden", el.getAttribute("data-auth-only") !== authMode);
    });
    qs("#auth-title").textContent = authMode === "signup" ? "회원가입" : "로그인";
    qs("#auth-submit").textContent = authMode === "signup" ? "회원가입" : "로그인";
  }
  qsa("[data-auth-tab]").forEach((t) => t.addEventListener("click", () => {
    authMode = t.getAttribute("data-auth-tab"); syncAuthMode();
  }));

  async function refreshAuthUI() {
    const prof = await EM.getCurrentProfile();
    if (!prof || !prof.id) {
      authBtn.textContent = "로그인";
      return;
    }
    const badge = prof.membership === "pro"
      ? '<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900 text-[10px] font-bold">PRO</span>'
      : "";
    authBtn.innerHTML = `${escape(prof.full_name || prof.email)}${badge} · 로그아웃`;
  }

  authBtn?.addEventListener("click", async () => {
    const prof = await EM.getCurrentProfile();
    if (prof && prof.id) {
      await EM.signOut();
      EM.toast("로그아웃 완료", "ok");
      refreshAuthUI();
      return;
    }
    openModal("modal-auth"); syncAuthMode();
  });

  authForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(authForm);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const fullName = String(fd.get("full_name") || "").trim();
    const role = String(fd.get("role") || "client");
    try {
      if (authMode === "signup") {
        await EM.signUp({ email, password, fullName, role });
        EM.toast("회원가입 완료. 이메일 인증 후 로그인해주세요.", "ok");
      } else {
        await EM.signIn({ email, password });
        EM.toast("로그인 성공", "ok");
      }
      closeModal(qs("#modal-auth"));
      refreshAuthUI();
    } catch (err) {
      EM.toast("실패: " + err.message, "err");
    }
  });

  // ---------- Pro upgrade ----------
  qs("#btn-upgrade-pro")?.addEventListener("click", async () => {
    const prof = await EM.getCurrentProfile();
    if (!prof || !prof.id) {
      EM.toast("Pro 구독은 로그인 후 가능합니다.", "warn");
      openModal("modal-auth"); syncAuthMode();
      return;
    }
    if (prof.membership === "pro") return EM.toast("이미 Pro 멤버입니다.", "ok");
    if (!confirm("Pro 멤버십을 시작하시겠습니까?\n(데모 환경 — 실제 결제는 이루어지지 않습니다.)")) return;
    try {
      await EM.upgradeToPro();
      EM.toast("Pro 멤버십이 활성화되었습니다. 프리미엄 공고 전체 열람 가능합니다.", "ok");
      refreshAuthUI();
      loadKpis();
    } catch (err) {
      EM.toast("업그레이드 실패: " + err.message, "err");
    }
  });

  // ---------- init ----------
  loadKpis();
  loadJobs();
  refreshAuthUI();
})();
