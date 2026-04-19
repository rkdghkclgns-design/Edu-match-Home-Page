// =========================================================
// Edu-match — PBL 훈련운영계획서 의뢰 (KDT 표준 양식 반영)
// =========================================================

(function () {
  const em = window.EduMatch;
  if (!em?.supabase) {
    alert("Supabase 설정이 누락되었습니다.");
    return;
  }
  const supabase = em.supabase;
  const TABLES = em.TABLES;

  const list = document.getElementById("materials-list");
  const addBtn = document.getElementById("add-material");
  const form = document.getElementById("pbl-form");
  const msg = document.getElementById("pbl-msg");

  function addRow(prefill = {}) {
    const row = document.createElement("div");
    row.className = "pbl-material-row";
    row.innerHTML = `
      <input type="text" placeholder="자료명 (예: 사전 설문, 참여기업 리스트)" value="${prefill.name || ""}" data-field="name" />
      <input type="url" placeholder="공유 URL" value="${prefill.url || ""}" data-field="url" />
      <button type="button" class="remove" aria-label="삭제">×</button>
    `;
    row.querySelector(".remove").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }

  addRow();
  addRow();
  addBtn.addEventListener("click", () => addRow());

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = "auth-message is-shown auth-message--" + type;
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? (el.value || "").toString().trim() : "";
  }

  function num(id) {
    return Number(val(id)) || 0;
  }

  function buildKdtPlan() {
    return {
      overview: {
        purpose: val("p-purpose"),
        direction: val("p-direction"),
        past_results: val("p-results"),
        analysis: val("p-analysis"),
      },
      capability: {
        enterprise_demand: {
          composition: val("e-compose"),
          management: val("e-manage"),
          survey: val("e-survey"),
        },
        training_content: {
          regular_curriculum: val("t-regular"),
          project_learning: val("t-project"),
          management_plan: val("t-mgmt"),
        },
        trainee_management: {
          selection: val("s-select"),
          career_support: val("s-career"),
        },
      },
      infrastructure: {
        manpower: {
          regular_instructors: val("i-regular"),
          project_instructors: val("i-project"),
          management: val("i-mgmt"),
          main_instructor_count: num("i-main-total"),
          assistant_instructor_count: num("i-sub-total"),
        },
        resources: {
          facility_equipment: val("r-facility"),
          utilization: val("r-util"),
        },
      },
      appendix: {
        autonomy_metric: val("x-metric"),
        partner_appropriateness: val("x-partner"),
        online_realtime_guidance: val("x-online"),
      },
      format_reference: "KDT 훈련운영계획서(선도제외) 표준 양식 기반",
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
      kdt_plan: buildKdtPlan(),
    };

    showMsg("제출 중…", "success");
    const { data: inserted, error } = await supabase
      .from(TABLES.pblRequests)
      .insert(payload)
      .select()
      .single();
    if (error) {
      showMsg("의뢰 실패: " + error.message, "error");
      return;
    }

    const rows = Array.from(list.querySelectorAll(".pbl-material-row"))
      .map((row) => ({
        request_id: inserted.id,
        name: row.querySelector('[data-field="name"]').value.trim(),
        url: row.querySelector('[data-field="url"]').value.trim(),
      }))
      .filter((r) => r.name || r.url);

    if (rows.length > 0) {
      const { error: mErr } = await supabase.from(TABLES.pblMaterials).insert(rows);
      if (mErr) {
        showMsg(`의뢰는 접수되었으나 일부 자료 등록 실패: ${mErr.message}`, "error");
        return;
      }
    }

    showMsg(
      `훈련운영계획서 초안 의뢰가 접수되었습니다. (의뢰번호: ${inserted.id.slice(0, 8)}) · 1~2주 내 담당 매니저가 회신드립니다.`,
      "success",
    );
    form.reset();
    list.innerHTML = "";
    addRow();
    addRow();
  });
})();
