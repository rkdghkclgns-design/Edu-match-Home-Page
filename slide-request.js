// Edu-match — 강의 슬라이드 의뢰 (Tailwind rebuild)
(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;
  const SLIDES = "em_slide_requests";
  const SLIDE_MATS = "em_slide_materials";

  const $ = (id) => document.getElementById(id);
  const list = $("slide-materials-list");
  const addBtn = $("slide-add-material");
  const form = $("slide-form");
  const msg = $("slide-msg");

  function addRow(prefill = {}) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[1fr_2fr_auto] gap-2";
    row.innerHTML = `
      <input type="text" placeholder="자료명 (예: 브랜드 가이드)" value="${prefill.name || ""}" data-field="name" class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300" />
      <input type="url" placeholder="공유 URL" value="${prefill.url || ""}" data-field="url" class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300" />
      <button type="button" class="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:text-red-600 hover:border-red-200" data-remove>×</button>
    `;
    row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }
  addRow(); addRow();
  addBtn.addEventListener("click", () => addRow());

  const val = (id) => ($(id)?.value || "").toString().trim();
  const num = (id) => Number(val(id)) || 0;
  function show(text, type) {
    msg.textContent = text;
    msg.className = "text-sm font-medium text-center " + (type === "ok" ? "text-emerald-600" : "text-red-600");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      requester_name: val("sr-name"),
      requester_email: val("sr-email"),
      requester_phone: val("sr-phone"),
      organization: val("sr-org"),
      topic: val("ss-topic"),
      domain: val("ss-domain"),
      target_level: val("ss-level"),
      audience_size: num("ss-size"),
      duration_hours: num("ss-hours"),
      slide_count: num("ss-slides"),
      style_preference: val("ss-style"),
      color_theme: val("ss-color"),
      deliverable_format: val("ss-format"),
      objectives: val("ss-obj"),
      notes: val("ss-notes"),
      status: "pending",
    };
    if (!payload.requester_name || !payload.requester_email || !payload.topic || !payload.objectives) {
      show("필수 항목을 모두 입력해주세요.", "err"); return;
    }
    show("제출 중…", "ok");
    try {
      const { data: inserted, error } = await supabase.from(SLIDES).insert(payload).select().single();
      if (error) throw error;
      const rows = Array.from(list.querySelectorAll('.grid'))
        .map((row) => ({ request_id: inserted.id, name: row.querySelector('[data-field="name"]').value.trim(), url: row.querySelector('[data-field="url"]').value.trim() }))
        .filter((r) => r.name || r.url);
      if (rows.length > 0) await supabase.from(SLIDE_MATS).insert(rows);
      show(`의뢰 접수 완료 (번호: ${inserted.id.slice(0, 8)})`, "ok");
      EM.toast("슬라이드 의뢰가 접수되었습니다.", "ok");
      form.reset();
      list.innerHTML = ""; addRow(); addRow();
    } catch (err) {
      show("의뢰 실패: " + err.message, "err");
    }
  });
})();
