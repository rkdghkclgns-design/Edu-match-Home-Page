// =========================================================
// Edu-match — 강의 슬라이드 의뢰
// =========================================================

(function () {
  const em = window.EduMatch;
  if (!em?.supabase) {
    alert("Supabase 설정이 누락되었습니다.");
    return;
  }
  const supabase = em.supabase;
  const TABLES = em.TABLES;
  const SLIDES = "em_slide_requests";
  const SLIDE_MATS = "em_slide_materials";

  const list = document.getElementById("slide-materials-list");
  const addBtn = document.getElementById("slide-add-material");
  const form = document.getElementById("slide-form");
  const msg = document.getElementById("slide-msg");

  function addRow(prefill = {}) {
    const row = document.createElement("div");
    row.className = "pbl-material-row";
    row.innerHTML = `
      <input type="text" placeholder="자료명 (예: 브랜드 가이드)" value="${prefill.name || ""}" data-field="name" />
      <input type="url" placeholder="공유 URL" value="${prefill.url || ""}" data-field="url" />
      <button type="button" class="remove" aria-label="삭제">×</button>
    `;
    row.querySelector(".remove").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }

  addRow();
  addRow();
  addBtn.addEventListener("click", () => addRow());

  function show(text, type) {
    msg.textContent = text;
    msg.className = "auth-message is-shown auth-message--" + type;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      requester_name: document.getElementById("sr-name").value.trim(),
      requester_email: document.getElementById("sr-email").value.trim(),
      requester_phone: document.getElementById("sr-phone").value.trim(),
      organization: document.getElementById("sr-org").value.trim(),
      topic: document.getElementById("ss-topic").value.trim(),
      domain: document.getElementById("ss-domain").value.trim(),
      target_level: document.getElementById("ss-level").value,
      audience_size: Number(document.getElementById("ss-size").value) || 0,
      duration_hours: Number(document.getElementById("ss-hours").value) || 0,
      slide_count: Number(document.getElementById("ss-slides").value) || 0,
      style_preference: document.getElementById("ss-style").value.trim(),
      color_theme: document.getElementById("ss-color").value.trim(),
      deliverable_format: document.getElementById("ss-format").value,
      objectives: document.getElementById("ss-obj").value.trim(),
      notes: document.getElementById("ss-notes").value.trim(),
      status: "pending",
    };

    show("제출 중…", "success");
    const { data: inserted, error } = await supabase
      .from(SLIDES)
      .insert(payload)
      .select()
      .single();
    if (error) {
      show("의뢰 실패: " + error.message, "error");
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
      const { error: mErr } = await supabase.from(SLIDE_MATS).insert(rows);
      if (mErr) {
        show(`의뢰는 접수되었으나 일부 자료 등록 실패: ${mErr.message}`, "error");
        return;
      }
    }

    show(
      `슬라이드 의뢰가 접수되었습니다. (의뢰번호: ${inserted.id.slice(0, 8)}) 담당 매니저가 1~2주 내 회신드립니다.`,
      "success",
    );
    form.reset();
    list.innerHTML = "";
    addRow();
    addRow();
  });
})();
