// =========================================================
// Edu-match — 컨설팅 요청 게시판 (em_consult_requests + em_consult_quotes)
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;

  const $ = (id) => document.getElementById(id);
  const escape = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return Math.floor(diff / 60) + "분 전";
    if (diff < 86400) return Math.floor(diff / 3600) + "시간 전";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + "일 전";
    return d.toLocaleDateString("ko-KR");
  };
  const KRW = (n) => n && Number(n) > 0 ? Number(n).toLocaleString("ko-KR") + "원" : null;

  const CAT = {
    "corporate-lecture":"기업출강","teambuilding":"팀빌딩","craft-experience":"공방체험",
    "diy-kit":"DIY키트","it-ai":"IT · AI","leadership":"리더십","design":"디자인 · UX","data":"데이터 분석",
  };
  const STATUS = {
    open: {label:"모집중", cls:"bg-emerald-100 text-emerald-700"},
    reviewing: {label:"검토중", cls:"bg-blue-100 text-blue-700"},
    matched: {label:"매칭됨", cls:"bg-indigo-100 text-indigo-700"},
    completed: {label:"완료", cls:"bg-slate-200 text-slate-700"},
    closed: {label:"종료", cls:"bg-slate-100 text-slate-500"},
  };

  function budgetLabel(r, prefix = "") {
    if (r.budget_type === "per_hour" && r.budget_amount) return `${prefix}시간당 ${KRW(r.budget_amount)}`;
    if (r.budget_type === "per_project" && r.budget_amount) return `${prefix}프로젝트당 ${KRW(r.budget_amount)}`;
    return `${prefix}협의`;
  }

  let __me = null;
  let __requests = [];

  async function refreshMe() {
    __me = await EM.getCurrentProfile();
    if (__me?.id) {
      $("me-label").textContent = __me.full_name || __me.email;
      $("login-link").classList.add("hidden");
    } else {
      $("me-label").textContent = "비로그인";
      $("login-link").classList.remove("hidden");
    }
  }

  // ---------- List ----------
  async function loadList() {
    try {
      const { data, error } = await supabase
        .from("em_consult_requests")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      __requests = data || [];
      render();
    } catch (err) {
      $("consult-list").innerHTML = `<div class="col-span-full text-sm text-red-600 text-center py-12">오류: ${escape(err.message)}</div>`;
    }
  }

  function render() {
    const root = $("consult-list");
    const q = ($("cf-q").value || "").trim().toLowerCase();
    const cat = $("cf-cat").value;
    const st = $("cf-status").value;
    const sort = $("cf-sort").value;
    let list = __requests.slice();
    if (q)   list = list.filter((r) => [r.title, r.description, r.organization, r.requester_name].filter(Boolean).join(" ").toLowerCase().includes(q));
    if (cat) list = list.filter((r) => r.category === cat);
    if (st)  list = list.filter((r) => r.status === st);
    if (sort === "urgent") list.sort((a,b) => Number(b.urgency === "high") - Number(a.urgency === "high") || new Date(b.created_at) - new Date(a.created_at));
    else if (sort === "quotes") list.sort((a,b) => (b.quote_count || 0) - (a.quote_count || 0));
    else list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    $("cf-count").textContent = `총 ${__requests.length}건 중 ${list.length}건 표시`;

    if (!list.length) {
      root.innerHTML = `
        <div class="col-span-full rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <div class="text-4xl">💼</div>
          <h3 class="mt-3 font-bold">조건에 맞는 요청이 없습니다</h3>
          <p class="mt-1 text-sm text-slate-500">첫 번째 컨설팅 요청을 등록해보세요!</p>
          <button type="button" data-open-req class="mt-4 px-5 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700">요청 등록하기</button>
        </div>`;
      return;
    }

    root.innerHTML = list.map((r) => {
      const s = STATUS[r.status] || STATUS.open;
      const cat = r.category ? `<span class="text-xs font-semibold text-brand-600">${escape(CAT[r.category] || r.category)}</span>` : '';
      const urg = r.urgency === "high" ? '<span class="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">긴급</span>' : '';
      const displayName = r.is_anonymous ? "익명 의뢰자" : escape(r.requester_name);
      const displayOrg  = r.is_anonymous ? "" : escape(r.organization || "");
      return `
        <article class="bg-white rounded-2xl border border-slate-200 hover:border-brand-300 shadow-sm transition flex flex-col">
          <div class="p-5 cursor-pointer flex-1" data-toggle-req="${escape(r.id)}">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}">${s.label}</span>
              ${urg}
              ${cat}
              <span class="ml-auto text-xs text-slate-400">${escape(fmtTime(r.created_at))}</span>
            </div>
            <h3 class="mt-2 font-bold text-base leading-snug">${escape(r.title)}</h3>
            <p class="mt-1 text-sm text-slate-600 line-clamp-2">${escape(r.description)}</p>
            <div class="mt-3 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span class="font-semibold">${displayName}</span>
              ${displayOrg ? `<span>· ${displayOrg}</span>` : ''}
              <span class="ml-auto">💰 ${escape(budgetLabel(r))}</span>
              ${r.preferred_schedule ? `<span>· 🗓 ${escape(r.preferred_schedule)}</span>` : ''}
            </div>
            <div class="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>👁 ${r.view_count || 0}</span>
              <span>💬 제안 ${r.quote_count || 0}</span>
            </div>
          </div>
          <div data-detail="${escape(r.id)}" class="hidden border-t border-slate-100 p-5 space-y-4 bg-slate-50/30">
            <div>
              <h4 class="text-sm font-bold">상세 내용</h4>
              <p class="mt-1 text-sm whitespace-pre-wrap leading-relaxed">${escape(r.description)}</p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><div class="text-slate-500">예산</div><div class="font-bold">${escape(budgetLabel(r))}</div></div>
              <div><div class="text-slate-500">희망 일정</div><div class="font-bold">${escape(r.preferred_schedule || "협의")}</div></div>
              <div><div class="text-slate-500">긴급도</div><div class="font-bold">${escape(r.urgency || "normal")}</div></div>
              <div><div class="text-slate-500">분야</div><div class="font-bold">${escape(CAT[r.category] || r.category || "—")}</div></div>
            </div>
            ${(r.is_anonymous && !(__me?.id === r.requester_id || __me?.role === "admin")) ? `
              <div class="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs">
                🔒 익명 요청 — 의뢰자 연락처는 비공개입니다. 제안서 등록 시 운영자가 의뢰자에게 전달합니다.
              </div>` : `
              <div class="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                <div><span class="text-slate-500">담당자:</span> <span class="font-semibold">${escape(r.requester_name)}</span></div>
                <div><span class="text-slate-500">이메일:</span> <a href="mailto:${escape(r.requester_email)}" class="font-semibold text-brand-600 hover:underline">${escape(r.requester_email)}</a></div>
                ${r.requester_phone ? `<div><span class="text-slate-500">연락처:</span> <a href="tel:${escape(r.requester_phone)}" class="font-semibold text-brand-600">${escape(r.requester_phone)}</a></div>` : ''}
              </div>`}

            <div class="flex flex-wrap items-center gap-2 pt-2">
              ${(__me?.id === r.requester_id || __me?.role === "admin") ? `
                <select data-req-status data-id="${escape(r.id)}" data-prev="${escape(r.status)}" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold outline-none">
                  ${Object.keys(STATUS).map((k) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${STATUS[k].label}</option>`).join("")}
                </select>
                <button data-req-delete="${escape(r.id)}" class="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 font-semibold">요청 삭제</button>` : ''}
            </div>

            <div data-quotes-root="${escape(r.id)}" class="pt-3 border-t border-slate-200"></div>
          </div>
        </article>`;
    }).join("");
  }

  ["cf-q","cf-cat","cf-status","cf-sort"].forEach((id) => {
    const el = $(id);
    el?.addEventListener(el.tagName === "INPUT" ? "input" : "change", render);
  });

  // ---------- Toggle detail + view++ ----------
  document.body.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-toggle-req]");
    if (t) {
      const id = t.getAttribute("data-toggle-req");
      const detail = document.querySelector(`[data-detail="${CSS.escape(id)}"]`);
      if (!detail) return;
      const opening = detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      if (opening) {
        supabase.from("em_consult_requests")
          .update({ view_count: (__requests.find((r) => r.id === id)?.view_count || 0) + 1 })
          .eq("id", id).then();
        loadQuotes(id);
      }
      return;
    }
    const o = e.target.closest("[data-open-req]");
    if (o) openModal();
  });

  // ---------- Modal ----------
  const modal = $("modal-req");
  function openModal() {
    $("req-msg").textContent = "";
    // 로그인 사용자면 prefill
    if (__me?.id) {
      $("r-name").value = __me.full_name || "";
      $("r-email").value = __me.email || "";
      $("r-phone").value = __me.phone || "";
    }
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
  function closeModal() { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  document.querySelectorAll("[data-close-req]").forEach((b) => b.addEventListener("click", closeModal));
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  $("btn-new-req").addEventListener("click", openModal);

  $("req-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("req-msg");
    const setMsg = (t, type) => { msg.textContent = t; msg.className = "text-sm text-center font-medium " + (type === "ok" ? "text-emerald-600" : "text-red-600"); };

    const name = $("r-name").value.trim();
    const email = $("r-email").value.trim();
    const phoneRaw = $("r-phone").value.replace(/[\s-]/g, "");
    if (name.length < 2) return setMsg("담당자 성함을 입력해주세요.", "err");
    if (!/.+@.+\..+/.test(email)) return setMsg("이메일을 확인해주세요.", "err");
    if (phoneRaw && !/^01[0-9]\d{7,8}$/.test(phoneRaw)) return setMsg("휴대폰 번호 형식을 확인해주세요.", "err");

    const btype = $("r-btype").value;
    const bamount = Number($("r-bamount").value) || null;

    const payload = {
      requester_id: __me?.id || null,
      requester_name: name,
      requester_email: email,
      requester_phone: phoneRaw || null,
      organization: $("r-org").value.trim() || null,
      title: $("r-title").value.trim(),
      description: $("r-desc").value.trim(),
      category: $("r-cat").value || null,
      budget_type: btype,
      budget_amount: btype === "negotiable" ? null : bamount,
      preferred_schedule: $("r-sched").value.trim() || null,
      urgency: $("r-urg").value,
      is_anonymous: $("r-anon").checked,
      status: "open",
    };

    setMsg("등록 중…", "ok");
    try {
      const { data, error } = await supabase.from("em_consult_requests").insert(payload).select().single();
      if (error) throw error;

      // 운영자 알림 메일
      EM.notifyAndMail?.({
        type: "consult",
        subject: `[Edu-match · 컨설팅 요청] ${payload.title}`,
        summary: payload.description,
        request_id: data.id,
        requester_name: name, requester_email: email,
        fields: { 기관: payload.organization, 분야: CAT[payload.category] || payload.category,
                 예산: budgetLabel(payload), 일정: payload.preferred_schedule, 긴급도: payload.urgency,
                 익명요청: payload.is_anonymous ? "예" : "아니오", 연락처: payload.requester_phone },
      });

      setMsg(`✓ 컨설팅 요청이 등록되었습니다. (번호: ${data.id.slice(0, 8)})`, "ok");
      EM.toast("컨설팅 요청이 등록되었습니다.", "ok");
      closeModal();
      loadList();
    } catch (err) {
      setMsg("등록 실패: " + err.message, "err");
    }
  });

  // ---------- Quotes (강사 견적/제안) ----------
  async function loadQuotes(reqId) {
    const root = document.querySelector(`[data-quotes-root="${CSS.escape(reqId)}"]`);
    if (!root) return;
    root.innerHTML = `<div class="text-xs text-slate-400">제안 로딩 중…</div>`;
    const { data, error } = await supabase
      .from("em_consult_quotes")
      .select("*")
      .eq("request_id", reqId)
      .eq("is_deleted", false)
      .order("is_accepted", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) { root.innerHTML = `<div class="text-xs text-red-600">${escape(error.message)}</div>`; return; }

    const req = __requests.find((r) => r.id === reqId);
    const isRequester = __me?.id === req?.requester_id || __me?.role === "admin";

    const list = (data || []).map((q) => {
      const isMine = __me?.id === q.consultant_id;
      const canDel = isMine || __me?.role === "admin";
      const av = q.consultant_avatar_url
        ? `<img src="${escape(q.consultant_avatar_url)}" class="w-8 h-8 rounded-full object-cover" referrerpolicy="no-referrer"/>`
        : `<div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">${escape((q.consultant_name || "?").charAt(0))}</div>`;
      const bud = (q.proposed_budget_amount && q.proposed_budget_type)
        ? `<span class="font-semibold text-brand-700">💰 ${escape(q.proposed_budget_type === "per_hour" ? "시간당" : "프로젝트당")} ${escape(KRW(q.proposed_budget_amount))}</span>`
        : '';
      const sched = q.proposed_schedule ? `<span>🗓 ${escape(q.proposed_schedule)}</span>` : '';
      return `
        <div class="rounded-lg border ${q.is_accepted ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'} p-3 space-y-2">
          <div class="flex items-start gap-2">
            ${av}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-xs flex-wrap">
                <span class="font-bold">${escape(q.consultant_name || "강사")}</span>
                ${q.consultant_title ? `<span class="text-slate-500">· ${escape(q.consultant_title)}</span>` : ''}
                <span class="text-slate-400 ml-auto">${escape(fmtTime(q.created_at))}</span>
              </div>
              <p class="mt-1 text-sm whitespace-pre-wrap">${escape(q.message)}</p>
              <div class="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">${bud}${sched}</div>
              ${q.is_accepted ? '<div class="mt-1 text-xs font-bold text-emerald-700">✓ 채택됨</div>' : ''}
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs">
            ${q.consultant_email ? `<a href="mailto:${escape(q.consultant_email)}" class="text-brand-600 hover:underline">✉ ${escape(q.consultant_email)}</a>` : ''}
            ${isRequester && !q.is_accepted ? `<button data-quote-accept="${escape(q.id)}" data-req="${escape(reqId)}" class="ml-auto text-xs font-semibold text-emerald-700 hover:text-emerald-900">채택</button>` : ''}
            ${canDel ? `<button data-quote-delete="${escape(q.id)}" data-req="${escape(reqId)}" class="text-xs text-red-600 hover:text-red-800 font-semibold">삭제</button>` : ''}
          </div>
        </div>`;
    }).join("");

    const composer = __me?.id && __me.role !== "client" ? `
      <form data-quote-form data-req="${escape(reqId)}" class="mt-3 space-y-2 p-3 rounded-lg bg-white border border-slate-200">
        <textarea name="message" required minlength="5" rows="3" placeholder="제안 내용 (커리큘럼 · 가능 일정 · 차별점)" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"></textarea>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select name="ptype" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300">
            <option value="">예산 미지정</option>
            <option value="per_hour">시간당</option>
            <option value="per_project">프로젝트당</option>
          </select>
          <input name="pamount" type="number" min="0" step="100000" placeholder="제안 금액 (원)" class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"/>
          <input name="psched" type="text" placeholder="가능 일정" class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>
        <button type="submit" class="w-full py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 text-sm">제안 등록</button>
      </form>` :
      __me?.id ? `<p class="mt-2 text-xs text-slate-500">제안 등록은 강사(lecturer) 회원만 가능합니다.</p>`
      : `<p class="mt-2 text-xs text-slate-500"><a href="./login.html" class="text-brand-600 hover:underline font-semibold">로그인</a> 후 제안을 등록할 수 있습니다.</p>`;

    root.innerHTML = `
      <div class="text-sm font-bold mb-2">💬 제안 (${(data || []).length})</div>
      <div class="space-y-2">${list || '<div class="text-xs text-slate-400 italic">아직 제안이 없습니다.</div>'}</div>
      ${composer}
    `;
  }

  // ---------- Quote submit / accept / delete ----------
  document.body.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-quote-form]");
    if (!form) return;
    e.preventDefault();
    if (!__me?.id) return EM.toast("로그인이 필요합니다.", "warn");
    const reqId = form.getAttribute("data-req");
    const fd = new FormData(form);
    const message = String(fd.get("message") || "").trim();
    if (message.length < 5) return EM.toast("제안 내용을 5자 이상 입력해주세요.", "warn");
    const ptype = String(fd.get("ptype") || "");
    const pamount = Number(fd.get("pamount")) || null;
    const psched = String(fd.get("psched") || "").trim() || null;

    const { error } = await supabase.from("em_consult_quotes").insert({
      request_id: reqId,
      consultant_id: __me.id,
      consultant_name: __me.full_name || __me.email,
      consultant_email: __me.contact_email || __me.email,
      consultant_avatar_url: __me.avatar_url || null,
      consultant_title: __me.title || null,
      message,
      proposed_budget_type: ptype || null,
      proposed_budget_amount: ptype ? pamount : null,
      proposed_schedule: psched,
    });
    if (error) return EM.toast("제안 등록 실패: " + error.message, "err");
    EM.toast("제안이 등록되었습니다.", "ok");
    form.reset();
    loadQuotes(reqId);
    // 로컬 카운터 +1
    const r = __requests.find((x) => x.id === reqId);
    if (r) r.quote_count = (r.quote_count || 0) + 1;
  });

  document.body.addEventListener("click", async (e) => {
    const acc = e.target.closest("[data-quote-accept]");
    if (acc) {
      if (!confirm("이 제안을 채택할까요?")) return;
      const id = acc.getAttribute("data-quote-accept");
      const reqId = acc.getAttribute("data-req");
      const { error } = await supabase.from("em_consult_quotes").update({ is_accepted: true }).eq("id", id);
      if (error) return EM.toast("채택 실패: " + error.message, "err");
      await supabase.from("em_consult_requests").update({ status: "matched" }).eq("id", reqId);
      EM.toast("제안 채택 · 요청 상태가 '매칭됨' 으로 변경되었습니다.", "ok");
      loadQuotes(reqId);
      loadList();
      return;
    }
    const del = e.target.closest("[data-quote-delete]");
    if (del) {
      if (!confirm("이 제안을 삭제할까요?")) return;
      const id = del.getAttribute("data-quote-delete");
      const reqId = del.getAttribute("data-req");
      const { error } = await supabase.from("em_consult_quotes").delete().eq("id", id);
      if (error) return EM.toast("삭제 실패: " + error.message, "err");
      EM.toast("제안 삭제 완료", "ok");
      loadQuotes(reqId);
      return;
    }
    const reqDel = e.target.closest("[data-req-delete]");
    if (reqDel) {
      if (!confirm("이 컨설팅 요청을 삭제할까요?")) return;
      const id = reqDel.getAttribute("data-req-delete");
      const { error } = await supabase.from("em_consult_requests").delete().eq("id", id);
      if (error) return EM.toast("삭제 실패: " + error.message, "err");
      EM.toast("요청 삭제 완료", "ok");
      loadList();
      return;
    }
  });

  document.body.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-req-status]");
    if (!sel) return;
    const id = sel.getAttribute("data-id");
    const prev = sel.dataset.prev;
    const { error } = await supabase.from("em_consult_requests").update({ status: sel.value }).eq("id", id);
    if (error) { EM.toast("상태 변경 실패: " + error.message, "err"); sel.value = prev; return; }
    EM.toast(`상태 변경: ${STATUS[prev]?.label || prev} → ${STATUS[sel.value]?.label || sel.value}`, "ok");
    sel.dataset.prev = sel.value;
    loadList();
  });

  (async () => { await refreshMe(); await loadList(); })();
})();
