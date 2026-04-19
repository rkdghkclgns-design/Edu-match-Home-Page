// =========================================================
// Edu-match Admin Dashboard (Tailwind) — logic
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { console.error("Supabase client missing"); return; }
  const supabase = EM.client;

  const qs = (s, r) => (r || document).querySelector(s);
  const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const DEMO_FLAG = "em_admin_demo_session";

  const escape = (v) => v == null ? "" : String(v)
    .replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const KRW = (n) => n ? Number(n).toLocaleString("ko-KR") + "원" : "협의";
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString("ko-KR") : "—";

  // ---------- Gate ----------
  const gate = qs("#gate");
  function openGate() { gate.classList.remove("hidden"); gate.classList.add("flex"); }
  function closeGate() { gate.classList.add("hidden"); gate.classList.remove("flex"); }

  async function assertAdmin() {
    if (localStorage.getItem(DEMO_FLAG) === "true") {
      qs("#me-label").textContent = "데모 관리자";
      return true;
    }
    const prof = await EM.getCurrentProfile();
    if (prof && prof.id && (prof.role === "admin" || prof.membership === "pro")) {
      qs("#me-label").textContent = `${prof.full_name || prof.email}${prof.role === "admin" ? " · admin" : ""}`;
      return true;
    }
    return false;
  }

  qs("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = qs("#gate-msg");
    try {
      await EM.signIn({ email: fd.get("email"), password: fd.get("password") });
      const ok = await assertAdmin();
      if (!ok) { msg.textContent = "관리자 권한이 없습니다."; return; }
      closeGate();
      bootstrap();
    } catch (err) {
      msg.textContent = "로그인 실패: " + err.message;
    }
  });

  qs("#gate-demo").addEventListener("click", () => {
    localStorage.setItem(DEMO_FLAG, "true");
    qs("#me-label").textContent = "데모 관리자";
    closeGate();
    bootstrap();
  });

  qs("#btn-logout").addEventListener("click", async () => {
    localStorage.removeItem(DEMO_FLAG);
    try { await EM.signOut(); } catch (e) {}
    location.reload();
  });

  qs("#btn-refresh").addEventListener("click", () => bootstrap());

  // ---------- KPI ----------
  async function loadKpis() {
    try {
      const [usersTotal, pros, pending, completed] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("membership", "pro"),
        supabase.from("matching_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("matching_requests").select("budget").eq("status", "completed"),
      ]);

      qs("#kpi-users").textContent = usersTotal.count ?? 0;
      qs("#kpi-pros").textContent = pros.count ?? 0;
      qs("#kpi-pending").textContent = pending.count ?? 0;

      const revenue = (completed.data || []).reduce((s, r) => s + (Number(r.budget) || 0), 0);
      qs("#kpi-revenue").textContent = revenue > 0 ? Math.round(revenue / 10000).toLocaleString("ko-KR") + "만원" : "—";
      qs("#kpi-revenue-sub").textContent = `${(completed.data || []).length} 건 완료`;
    } catch (err) {
      EM.toast("KPI 로드 실패: " + err.message, "err");
    }
  }

  // ---------- Tabs ----------
  qsa(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    const key = b.getAttribute("data-tab");
    qsa(".tab-btn").forEach((x) => {
      x.classList.toggle("border-brand-600", x === b);
      x.classList.toggle("text-brand-700", x === b);
      x.classList.toggle("border-transparent", x !== b);
      x.classList.toggle("text-slate-500", x !== b);
    });
    qsa(".panel").forEach((p) => p.classList.toggle("hidden", p.getAttribute("data-panel") !== key));
  }));

  // ---------- Users ----------
  let __users = [];
  async function loadUsers() {
    const tb = qs("#users-tbody");
    tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">불러오는 중…</td></tr>`;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      __users = data || [];
      renderUsers(__users);
    } catch (err) {
      tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-600">오류: ${escape(err.message)}</td></tr>`;
    }
  }

  function renderUsers(list) {
    const tb = qs("#users-tbody");
    if (!list.length) { tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">사용자가 없습니다.</td></tr>`; return; }
    tb.innerHTML = list.map((u) => `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 font-medium">${escape(u.full_name || "—")}</td>
        <td class="px-4 py-3 text-slate-600">${escape(u.email)}</td>
        <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'lecturer' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}">${escape(u.role || "—")}</span></td>
        <td class="px-4 py-3">
          <select data-update-membership data-id="${escape(u.id)}" class="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-300">
            <option value="basic" ${u.membership === 'basic' ? 'selected' : ''}>Basic</option>
            <option value="pro" ${u.membership === 'pro' ? 'selected' : ''}>Pro</option>
          </select>
        </td>
        <td class="px-4 py-3 text-slate-500 text-xs">${fmtDate(u.pro_since)}</td>
        <td class="px-4 py-3 text-slate-500 text-xs">${fmtDate(u.created_at)}</td>
        <td class="px-4 py-3 text-right">
          <button data-delete-user="${escape(u.id)}" class="text-xs text-red-600 hover:text-red-800 font-semibold">삭제</button>
        </td>
      </tr>
    `).join("");
  }

  qs("#users-search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return renderUsers(__users);
    renderUsers(__users.filter((u) => [u.full_name, u.email].filter(Boolean).join(" ").toLowerCase().includes(q)));
  });

  document.body.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-update-membership]");
    if (!sel) return;
    const id = sel.getAttribute("data-id");
    const prev = sel.dataset.prev || "basic";
    try {
      const patch = { membership: sel.value };
      if (sel.value === "pro") patch.pro_since = new Date().toISOString();
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      EM.toast(`등급 업데이트: ${sel.value.toUpperCase()}`, "ok");
      sel.dataset.prev = sel.value;
      loadKpis();
    } catch (err) {
      EM.toast("업데이트 실패: " + err.message, "err");
      sel.value = prev;
    }
  });

  document.body.addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-delete-user]");
    if (delBtn) {
      if (!confirm("이 사용자를 삭제하시겠습니까?")) return;
      try {
        const { error } = await supabase.from("profiles").delete().eq("id", delBtn.getAttribute("data-delete-user"));
        if (error) throw error;
        EM.toast("삭제 완료", "ok");
        loadUsers(); loadKpis();
      } catch (err) {
        EM.toast("삭제 실패: " + err.message, "err");
      }
    }
  });

  // ---------- Matching requests ----------
  let __requests = [];
  let __reqFilter = "";
  async function loadMatching() {
    const tb = qs("#match-tbody");
    tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">불러오는 중…</td></tr>`;
    try {
      const { data, error } = await supabase
        .from("matching_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      __requests = data || [];
      renderMatching();
    } catch (err) {
      tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-600">오류: ${escape(err.message)}</td></tr>`;
    }
  }

  function renderMatching() {
    const tb = qs("#match-tbody");
    const list = __reqFilter ? __requests.filter((r) => r.status === __reqFilter) : __requests;
    if (!list.length) { tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">문의가 없습니다.</td></tr>`; return; }
    tb.innerHTML = list.map((r) => `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3">
          <div class="font-medium">${escape(r.client_name)}</div>
          <div class="text-xs text-slate-500">${escape(r.company || "—")} · ${escape(r.email || "")}</div>
        </td>
        <td class="px-4 py-3 text-sm">${escape(r.category || "—")}</td>
        <td class="px-4 py-3 text-sm font-semibold">${escape(KRW(r.budget))}</td>
        <td class="px-4 py-3 text-sm text-slate-600 max-w-sm truncate" title="${escape(r.message || "")}">${escape(r.message || "")}</td>
        <td class="px-4 py-3">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'processing' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'}">${escape(r.status)}</span>
        </td>
        <td class="px-4 py-3 text-xs text-slate-500">${fmtDate(r.created_at)}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          ${r.status !== 'processing' ? `<button data-match-status="processing" data-id="${escape(r.id)}" class="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-semibold mr-1">진행중</button>` : ""}
          ${r.status !== 'completed' ? `<button data-match-status="completed" data-id="${escape(r.id)}" class="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold">완료</button>` : ""}
          ${r.status === 'completed' ? `<span class="text-xs text-emerald-600 font-semibold">✓ 완료</span>` : ""}
        </td>
      </tr>
    `).join("");
  }

  qsa(".filter-btn").forEach((b) => b.addEventListener("click", () => {
    __reqFilter = b.getAttribute("data-filter");
    qsa(".filter-btn").forEach((x) => {
      const active = x === b;
      x.classList.toggle("bg-brand-100", active);
      x.classList.toggle("text-brand-700", active);
      x.classList.toggle("bg-slate-100", !active);
      x.classList.toggle("text-slate-600", !active);
    });
    renderMatching();
  }));

  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-match-status]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const status = btn.getAttribute("data-match-status");
    try {
      const { error } = await supabase.from("matching_requests").update({ status }).eq("id", id);
      if (error) throw error;
      EM.toast(`상태 변경: ${status}`, "ok");
      loadMatching(); loadKpis();
    } catch (err) {
      EM.toast("변경 실패: " + err.message, "err");
    }
  });

  // ---------- Jobs ----------
  async function loadJobs() {
    const tb = qs("#jobs-tbody");
    try {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || !data.length) { tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">공고가 없습니다.</td></tr>`; return; }
      tb.innerHTML = data.map((j) => `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-3 font-medium">${escape(j.title)}</td>
          <td class="px-4 py-3 text-sm">${escape(j.category || "—")}</td>
          <td class="px-4 py-3 text-sm font-semibold">${escape(KRW(j.budget))}</td>
          <td class="px-4 py-3">
            <button data-toggle-premium data-id="${escape(j.id)}" class="${j.is_premium ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900' : 'bg-slate-100 text-slate-600'} text-xs font-bold px-2.5 py-1 rounded-full">
              ${j.is_premium ? '⭐ PREMIUM' : '일반'}
            </button>
          </td>
          <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${j.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}">${escape(j.status)}</span></td>
          <td class="px-4 py-3 text-xs text-slate-500">${fmtDate(j.created_at)}</td>
          <td class="px-4 py-3 text-right">
            <button data-toggle-status data-id="${escape(j.id)}" data-current="${escape(j.status)}" class="text-xs font-semibold text-slate-600 hover:text-slate-900 mr-2">
              ${j.status === 'open' ? '닫기' : '열기'}
            </button>
            <button data-delete-job="${escape(j.id)}" class="text-xs text-red-600 hover:text-red-800 font-semibold">삭제</button>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tb.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-600">오류: ${escape(err.message)}</td></tr>`;
    }
  }

  document.body.addEventListener("click", async (e) => {
    const prBtn = e.target.closest("[data-toggle-premium]");
    if (prBtn) {
      const id = prBtn.getAttribute("data-id");
      const isNow = prBtn.textContent.includes("PREMIUM");
      try {
        const { error } = await supabase.from("job_postings").update({ is_premium: !isNow }).eq("id", id);
        if (error) throw error;
        EM.toast(!isNow ? "프리미엄으로 지정" : "일반으로 전환", "ok");
        loadJobs();
      } catch (err) { EM.toast("실패: " + err.message, "err"); }
      return;
    }

    const stBtn = e.target.closest("[data-toggle-status]");
    if (stBtn) {
      const id = stBtn.getAttribute("data-id");
      const cur = stBtn.getAttribute("data-current");
      const nextStatus = cur === "open" ? "closed" : "open";
      try {
        const { error } = await supabase.from("job_postings").update({ status: nextStatus }).eq("id", id);
        if (error) throw error;
        EM.toast(`공고 ${nextStatus === 'open' ? '열기' : '닫기'}`, "ok");
        loadJobs();
      } catch (err) { EM.toast("실패: " + err.message, "err"); }
      return;
    }

    const delJob = e.target.closest("[data-delete-job]");
    if (delJob) {
      if (!confirm("이 공고를 삭제하시겠습니까?")) return;
      try {
        const { error } = await supabase.from("job_postings").delete().eq("id", delJob.getAttribute("data-delete-job"));
        if (error) throw error;
        EM.toast("삭제 완료", "ok");
        loadJobs();
      } catch (err) { EM.toast("삭제 실패: " + err.message, "err"); }
    }
  });

  // ---------- Applications ----------
  async function loadApps() {
    const tb = qs("#apps-tbody");
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || !data.length) { tb.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">지원 내역이 없습니다.</td></tr>`; return; }
      tb.innerHTML = data.map((a) => `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-3">
            <div class="font-medium">${escape(a.applicant_name || "—")}</div>
            <div class="text-xs text-slate-500">${escape(a.applicant_email || "")}</div>
          </td>
          <td class="px-4 py-3 text-xs font-mono text-slate-500">${escape((a.job_id || "").slice(0, 8))}</td>
          <td class="px-4 py-3">${a.resume_url ? `<a href="${escape(a.resume_url)}" target="_blank" rel="noopener" class="text-brand-600 hover:underline text-xs">열기</a>` : '<span class="text-slate-400 text-xs">없음</span>'}</td>
          <td class="px-4 py-3 text-sm text-slate-600 max-w-sm truncate" title="${escape(a.proposal || "")}">${escape(a.proposal || "")}</td>
          <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escape(a.status)}</span></td>
          <td class="px-4 py-3 text-xs text-slate-500">${fmtDate(a.created_at)}</td>
        </tr>
      `).join("");
    } catch (err) {
      tb.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-600">오류: ${escape(err.message)}</td></tr>`;
    }
  }

  // ---------- Bootstrap ----------
  function bootstrap() {
    loadKpis(); loadUsers(); loadMatching(); loadJobs(); loadApps();
  }

  (async () => {
    // 초기 렌더를 위해 Supabase 클라이언트 자체는 로드되어 있어야 함
    const ok = await assertAdmin();
    if (!ok) openGate();
    else bootstrap();
  })();
})();
