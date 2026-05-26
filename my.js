// =========================================================
// Edu-match — 내 교육 (my activity dashboard)
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;

  const $ = (id) => document.getElementById(id);
  const escape = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const KRW = (n) => n && Number(n) > 0 ? Number(n).toLocaleString("ko-KR") + "원" : "협의";
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString("ko-KR") : "—";
  const CAT_LABEL = {
    "corporate-lecture":"기업출강","teambuilding":"팀빌딩","craft-experience":"공방체험",
    "diy-kit":"DIY키트","it-ai":"IT · AI","leadership":"리더십","design":"디자인 · UX","data":"데이터 분석",
  };

  let me = null;

  function ddayLabel(deadline) {
    if (!deadline) return null;
    const d = new Date(deadline + "T23:59:59");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - today) / 86400000);
    if (diff < 0) return { text: "마감", cls: "bg-slate-200 text-slate-600" };
    if (diff === 0) return { text: "오늘 마감", cls: "bg-red-100 text-red-700" };
    if (diff <= 3) return { text: `D-${diff}`, cls: "bg-red-50 text-red-700" };
    if (diff <= 7) return { text: `D-${diff}`, cls: "bg-amber-50 text-amber-700" };
    return { text: `D-${diff}`, cls: "bg-slate-100 text-slate-600" };
  }

  function jobMiniCard(j, extras = "") {
    const dd = ddayLabel(j.deadline);
    return `
      <a href="./index.html#jobs" class="block bg-white rounded-2xl border border-slate-200 hover:border-brand-300 transition p-4 shadow-sm">
        <div class="flex items-start gap-2 flex-wrap">
          <span class="text-xs font-semibold text-brand-600">${escape(CAT_LABEL[j.category] || j.category || "")}</span>
          ${j.is_premium ? '<span class="chip bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900">⭐ PREMIUM</span>' : ''}
          ${j.is_urgent ? '<span class="chip bg-red-100 text-red-700">긴급</span>' : ''}
          ${dd ? `<span class="chip ${dd.cls}">⏰ ${dd.text}</span>` : ''}
          <span class="ml-auto text-xs text-slate-400">${fmtDate(j.created_at)}</span>
        </div>
        <h4 class="mt-1 font-bold leading-snug line-clamp-2">${escape(j.title)}</h4>
        <p class="mt-1 text-sm text-slate-600 line-clamp-2">${escape(j.description || "")}</p>
        <div class="mt-2 text-xs text-slate-500">${escape(j.organization || "—")} · 💰 ${escape(KRW(j.budget_amount || j.budget))}</div>
        ${extras}
      </a>`;
  }

  // Helper: chip class injection (Tailwind utility names)
  // chip class
  const STATUS_CLS = {
    pending: "bg-amber-50 text-amber-700",
    reviewed: "bg-blue-50 text-blue-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-slate-100 text-slate-500",
  };

  async function loadApps() {
    const root = document.querySelector("[data-panel='apps']");
    const { data, error } = await supabase
      .from("applications")
      .select("*, job_postings:job_id(*)")
      .eq("applicant_email", me.email)
      .order("created_at", { ascending: false });
    if (error) { root.innerHTML = `<div class="text-sm text-red-600">${escape(error.message)}</div>`; return; }
    $("kpi-apps").textContent = (data || []).length;
    if (!data?.length) {
      root.innerHTML = emptyState("📄", "지원한 공고가 없습니다", "공고에 지원해보세요!", "./index.html#jobs", "공고 둘러보기");
      return;
    }
    root.innerHTML = `
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        ${data.map((a) => {
          const j = a.job_postings;
          if (!j) return "";
          const stClass = STATUS_CLS[a.status] || "bg-slate-100 text-slate-700";
          const extras = `<div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="font-semibold px-2 py-0.5 rounded-full ${stClass}">${escape(a.status)}</span>
              <span class="text-slate-400">지원일 ${fmtDate(a.created_at)}</span>
            </div>${a.proposal ? `<p class="mt-2 text-xs text-slate-500 line-clamp-2">💬 ${escape(a.proposal)}</p>` : ''}`;
          return jobMiniCard(j, extras);
        }).join("")}
      </div>`;
  }

  async function loadBookmarks() {
    const root = document.querySelector("[data-panel='bookmarks']");
    const { data, error } = await supabase
      .from("em_job_bookmarks")
      .select("created_at, job_postings:job_id(*)")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false });
    if (error) { root.innerHTML = `<div class="text-sm text-red-600">${escape(error.message)}</div>`; return; }
    $("kpi-bookmarks").textContent = (data || []).length;
    if (!data?.length) {
      root.innerHTML = emptyState("♡", "북마크한 공고가 없습니다", "공고 카드 우측 상단의 ♥ 버튼으로 저장할 수 있어요.", "./index.html#jobs", "공고 둘러보기");
      return;
    }
    root.innerHTML = `<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">${data.map((b) => b.job_postings ? jobMiniCard(b.job_postings, '<div class="mt-3 pt-3 border-t border-slate-100 text-xs text-red-500">♥ 북마크 · ' + fmtDate(b.created_at) + '</div>') : "").join("")}</div>`;
  }

  async function loadQuotes() {
    const root = document.querySelector("[data-panel='quotes']");
    const { data, error } = await supabase
      .from("em_consult_quotes")
      .select("*, em_consult_requests:request_id(id,title,organization,category,status,created_at)")
      .eq("consultant_id", me.id)
      .order("created_at", { ascending: false });
    if (error) { root.innerHTML = `<div class="text-sm text-red-600">${escape(error.message)}</div>`; return; }
    $("kpi-quotes").textContent = (data || []).length;
    if (!data?.length) {
      root.innerHTML = emptyState("💼", "제출한 컨설팅 제안이 없습니다", "컨설팅 요청에 제안서를 등록해보세요.", "./consult.html", "컨설팅 요청 보기");
      return;
    }
    root.innerHTML = `<div class="grid gap-3 md:grid-cols-2">${data.map((q) => {
      const r = q.em_consult_requests;
      if (!r) return "";
      return `
        <a href="./consult.html" class="block bg-white rounded-2xl border ${q.is_accepted ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200'} hover:border-brand-300 transition p-4 shadow-sm">
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-semibold text-brand-600">${escape(CAT_LABEL[r.category] || r.category || "")}</span>
            <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escape(r.status)}</span>
            ${q.is_accepted ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓ 채택됨</span>' : ''}
            <span class="ml-auto text-slate-400">${fmtDate(q.created_at)}</span>
          </div>
          <h4 class="mt-1 font-bold line-clamp-1">${escape(r.title)}</h4>
          <p class="text-xs text-slate-500">${escape(r.organization || "")}</p>
          <p class="mt-2 text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">${escape(q.message)}</p>
          ${q.proposed_budget_amount ? `<div class="mt-2 text-xs"><span class="font-semibold text-brand-700">💰 ${escape(q.proposed_budget_type === 'per_hour' ? '시간당' : '프로젝트당')} ${escape(KRW(q.proposed_budget_amount))}</span></div>` : ''}
          ${q.proposed_schedule ? `<div class="text-xs text-slate-500">🗓 ${escape(q.proposed_schedule)}</div>` : ''}
        </a>`;
    }).join("")}</div>`;
  }

  async function loadPosted() {
    const root = document.querySelector("[data-panel='posted']");
    const [{ data: jobs }, { data: reqs }] = await Promise.all([
      supabase.from("job_postings").select("*").eq("posted_by_email", me.email).order("created_at", { ascending: false }),
      supabase.from("em_consult_requests").select("*").eq("requester_id", me.id).order("created_at", { ascending: false }),
    ]);
    const total = (jobs?.length || 0) + (reqs?.length || 0);
    $("kpi-posted").textContent = total;
    if (!total) {
      root.innerHTML = emptyState("📝", "등록한 공고/요청이 없습니다", "강의 공고나 컨설팅 요청을 등록해보세요.", "./register-lecture.html", "공고 등록하기");
      return;
    }
    const jobsHtml = (jobs || []).map((j) => jobMiniCard(j, `<div class="mt-3 pt-3 border-t border-slate-100 text-xs flex items-center justify-between"><span class="font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">강의 공고</span><span class="text-slate-400">${escape(j.status)} · 매칭 ${escape(j.match_status)}</span></div>`)).join("");
    const reqsHtml = (reqs || []).map((r) => `
      <a href="./consult.html" class="block bg-white rounded-2xl border border-slate-200 hover:border-brand-300 transition p-4 shadow-sm">
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <span class="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold">컨설팅 요청</span>
          <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escape(r.status)}</span>
          ${r.urgency === "high" ? '<span class="chip bg-red-100 text-red-700">긴급</span>' : ''}
          <span class="ml-auto text-slate-400">${fmtDate(r.created_at)}</span>
        </div>
        <h4 class="mt-1 font-bold leading-snug line-clamp-2">${escape(r.title)}</h4>
        <p class="mt-1 text-sm text-slate-600 line-clamp-2">${escape(r.description)}</p>
        <div class="mt-2 text-xs text-slate-500">제안 ${r.quote_count || 0}건 · 조회 ${r.view_count || 0}회</div>
      </a>`).join("");
    root.innerHTML = `<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">${jobsHtml}${reqsHtml}</div>`;
  }

  function emptyState(icon, title, sub, href, btn) {
    return `<div class="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
      <div class="text-4xl">${icon}</div>
      <h3 class="mt-3 font-bold">${title}</h3>
      <p class="mt-1 text-sm text-slate-500">${sub}</p>
      <a href="${href}" class="mt-4 inline-flex items-center px-5 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700">${btn}</a>
    </div>`;
  }

  // Tab switching
  document.querySelectorAll(".my-tab-btn").forEach((b) => b.addEventListener("click", () => {
    const key = b.getAttribute("data-tab");
    document.querySelectorAll(".my-tab-btn").forEach((x) => {
      const active = x === b;
      x.classList.toggle("border-brand-600", active);
      x.classList.toggle("text-brand-700", active);
      x.classList.toggle("border-transparent", !active);
      x.classList.toggle("text-slate-500", !active);
    });
    document.querySelectorAll(".my-panel").forEach((p) => p.classList.toggle("hidden", p.getAttribute("data-panel") !== key));
  }));

  (async function init() {
    me = await EM.getCurrentProfile();
    if (!me?.id) {
      $("gate").classList.remove("hidden");
      return;
    }
    $("content").classList.remove("hidden");
    const role = me.role === "lecturer" ? "강사" : me.role === "admin" ? "관리자" : "의뢰자";
    $("me-greeting").textContent = `안녕하세요, ${me.full_name || me.email} 님`;
    $("me-subline").textContent = `${role} 회원 · ${me.email}`;
    await Promise.all([loadApps(), loadBookmarks(), loadQuotes(), loadPosted()]);
  })();
})();
