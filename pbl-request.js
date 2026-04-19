// =========================================================
// Edu-match — PBL 문서 초안 의뢰
// =========================================================
// - em_pbl_requests 에 의뢰 insert
// - em_pbl_materials 에 참고자료 항목들 bulk insert
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
      <input type="text" placeholder="자료명 (예: 사전 설문 요약)" value="${prefill.name || ""}" data-field="name" />
      <input type="url" placeholder="공유 URL (Drive/Dropbox/Notion/SharePoint 등)" value="${prefill.url || ""}" data-field="url" />
      <button type="button" class="remove" aria-label="삭제">×</button>
    `;
    row.querySelector(".remove").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }

  // 기본 2줄
  addRow();
  addRow();
  addBtn.addEventListener("click", () => addRow());

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = "auth-message is-shown auth-message--" + type;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      requester_name: document.getElementById("r-name").value.trim(),
      requester_email: document.getElementById("r-email").value.trim(),
      requester_phone: document.getElementById("r-phone").value.trim(),
      organization: document.getElementById("r-org").value.trim(),
      topic: document.getElementById("p-topic").value.trim(),
      domain: document.getElementById("p-domain").value.trim(),
      target_level: document.getElementById("p-level").value,
      audience_size: Number(document.getElementById("p-size").value) || 0,
      duration_hours: Number(document.getElementById("p-hours").value) || 0,
      objectives: document.getElementById("p-obj").value.trim(),
      deliverable_format: document.getElementById("p-format").value,
      notes: document.getElementById("p-notes").value.trim(),
      status: "pending",
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

    // 첨부자료 bulk insert
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
      `의뢰가 접수되었습니다. (의뢰번호: ${inserted.id.slice(0, 8)}) · 1주일 내 담당 매니저가 회신드립니다.`,
      "success",
    );
    form.reset();
    list.innerHTML = "";
    addRow();
    addRow();
  });
})();
