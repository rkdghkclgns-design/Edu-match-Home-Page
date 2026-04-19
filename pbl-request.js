// Edu-match — PBL 훈련운영계획서 의뢰 (Tailwind rebuild)
(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;

  const $ = (id) => document.getElementById(id);
  const list = $("materials-list");
  const addBtn = $("add-material");
  const form = $("pbl-form");
  const msg = $("pbl-msg");

  function addRow(prefill = {}) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[1fr_2fr_auto] gap-2";
    row.innerHTML = `
      <input type="text" placeholder="자료명" value="${prefill.name || ""}" data-field="name" class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300" />
      <input type="url" placeholder="공유 URL" value="${prefill.url || ""}" data-field="url" class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300" />
      <button type="button" class="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:text-red-600 hover:border-red-200" data-remove>×</button>
    `;
    row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }
  addRow(); addRow();
  addBtn.addEventListener("click", () => addRow());

  function show(text, type) {
    msg.textContent = text;
    msg.className = "text-sm font-medium text-center " + (type === "ok" ? "text-emerald-600" : "text-red-600");
  }

  const val = (id) => ($(id)?.value || "").toString().trim();
  const num = (id) => Number(val(id)) || 0;

  function buildKdt() {
    return {
      overview: { purpose: val("p-purpose"), direction: val("p-direction"), past_results: val("p-results"), analysis: val("p-analysis") },
      capability: {
        enterprise_demand: { composition: val("e-compose"), management: val("e-manage"), survey: val("e-survey") },
        training_content: { regular_curriculum: val("t-regular"), project_learning: val("t-project"), management_plan: val("t-mgmt") },
        trainee_management: { selection: val("s-select"), career_support: val("s-career") },
      },
      infrastructure: {
        manpower: {
          regular_instructors: val("i-regular"), project_instructors: val("i-project"), management: val("i-mgmt"),
          main_instructor_count: num("i-main-total"), assistant_instructor_count: num("i-sub-total"),
        },
        resources: { facility_equipment: val("r-facility"), utilization: val("r-util") },
      },
      appendix: { autonomy_metric: val("x-metric"), partner_appropriateness: val("x-partner"), online_realtime_guidance: val("x-online") },
      format_reference: "KDT 훈련운영계획서(선도제외) 표준 양식",
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      requester_name: val("r-name"),
      requester_email: val("r-email"),
      requester_phone: val("r-phone"),
      organization: val("r-org"),
      topic: val("p-topic"),
      domain: val("p-domain"),
      target_level: val("p-level"),
      audience_size: num("p-size"),
      duration_hours: num("p-hours"),
      objectives: val("p-obj"),
      deliverable_format: val("p-format"),
      notes: val("p-notes"),
      status: "pending",
      academy_type: val("kdt-academy"),
      training_type: val("kdt-type"),
      training_course_name: val("kdt-course"),
      course_code: val("kdt-code"),
      total_trainees: num("kdt-total"),
      kdt_plan: buildKdt(),
    };
    if (!payload.requester_name || !payload.requester_email || !payload.topic || !payload.objectives) {
      show("필수 항목을 모두 입력해주세요.", "err"); return;
    }
    show("제출 중…", "ok");
    try {
      const { data: inserted, error } = await supabase.from("em_pbl_requests").insert(payload).select().single();
      if (error) throw error;
      const rows = Array.from(list.querySelectorAll('.grid'))
        .map((row) => ({
          request_id: inserted.id,
          name: row.querySelector('[data-field="name"]').value.trim(),
          url: row.querySelector('[data-field="url"]').value.trim(),
        }))
        .filter((r) => r.name || r.url);
      if (rows.length > 0) await supabase.from("em_pbl_materials").insert(rows);
      show(`의뢰 접수 완료 (번호: ${inserted.id.slice(0, 8)})`, "ok");
      EM.toast("PBL 의뢰가 접수되었습니다.", "ok");
      form.reset();
      list.innerHTML = ""; addRow(); addRow();
    } catch (err) {
      show("의뢰 실패: " + err.message, "err");
    }
  });
})();
