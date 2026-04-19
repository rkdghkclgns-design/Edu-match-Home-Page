// =========================================================
// Edu-match — 강사 전용 자료실
// =========================================================
// 접근 조건:
//   1) Supabase Auth 로그인 상태
//   2) em_profiles.role = 'instructor'
//   3) em_instructors.is_approved = true  (관리자 승인)
// 조건 불충족 시 gate 카드 노출.
// =========================================================

(function () {
  const em = window.EduMatch;
  if (!em?.supabase) {
    document.getElementById("gate").style.display = "";
    document.getElementById("gate-title").textContent = "초기화 실패";
    document.getElementById("gate-msg").textContent = "Supabase 설정이 누락되었습니다.";
    return;
  }
  const supabase = em.supabase;
  const TABLES = em.TABLES;

  const gate = document.getElementById("gate");
  const gateTitle = document.getElementById("gate-title");
  const gateMsg = document.getElementById("gate-msg");
  const root = document.getElementById("materials-root");
  const userEmail = document.getElementById("user-email");
  const loginLink = document.getElementById("login-link");
  const countEl = document.getElementById("materials-count");

  function showGate(title, msg) {
    gate.style.display = "";
    root.style.display = "none";
    gateTitle.textContent = title;
    gateMsg.textContent = msg;
  }
  function showRoot() {
    gate.style.display = "none";
    root.style.display = "";
  }

  function escape(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  async function loadMaterials() {
    const { data, error } = await supabase
      .from(TABLES.materials)
      .select("*")
      .eq("is_approved", true)
      .order("created_at", { ascending: false });
    const grid = document.getElementById("materials-grid");
    if (error) { grid.innerHTML = `<p class="admin-empty">오류: ${escape(error.message)}</p>`; return; }
    countEl.textContent = `${data?.length || 0} 건의 승인된 자료`;
    if (!data || data.length === 0) {
      grid.innerHTML = `<p class="admin-empty">등록된 승인 자료가 없습니다.</p>`;
      return;
    }
    grid.innerHTML = data.map((m) => `
      <article class="material-card">
        <h3>${escape(m.title)}</h3>
        <div class="material-card__meta">
          <span>${escape(em.categoryLabel ? em.categoryLabel(m.category) : m.category)}</span>
          <span>· ${escape(m.uploaded_by_name || m.uploaded_by_email || "익명")}</span>
        </div>
        <p>${escape(m.description || "")}</p>
        <div class="job-card__tags">${(m.tags || []).map((t) => `<span>${escape(t)}</span>`).join("")}</div>
        ${m.material_url ? `<a class="material-card__link" href="${escape(m.material_url)}" target="_blank" rel="noopener">자료 열기 →</a>` : ""}
      </article>
    `).join("");
  }

  async function attachUpload(currentUser) {
    const form = document.getElementById("upload-form");
    const showBtn = document.getElementById("show-upload");
    showBtn.addEventListener("click", () => {
      form.style.display = form.style.display === "none" ? "" : "none";
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("upload-msg");
      const payload = {
        title: document.getElementById("m-title").value.trim(),
        description: document.getElementById("m-desc").value.trim(),
        category: document.getElementById("m-category").value,
        material_url: document.getElementById("m-url").value.trim(),
        tags: document.getElementById("m-tags").value.split(",").map((s) => s.trim()).filter(Boolean),
        uploaded_by_email: currentUser.email,
        uploaded_by_name: currentUser.user_metadata?.name || currentUser.email,
        visibility: "instructor-only",
        is_approved: false,
      };
      const { error } = await supabase.from(TABLES.materials).insert(payload);
      if (error) {
        msg.textContent = "업로드 실패: " + error.message;
        msg.className = "auth-message is-shown auth-message--error";
        return;
      }
      msg.textContent = "업로드 완료. 관리자 승인 후 공개됩니다.";
      msg.className = "auth-message is-shown auth-message--success";
      form.reset();
    });
  }

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });

  (async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showGate("로그인이 필요합니다", "강사 전용 자료실입니다. 로그인 후 이용해주세요.");
      return;
    }
    userEmail.textContent = user.email;
    loginLink.style.display = "none";

    // 강사 프로필 + 승인 여부 확인
    const { data: prof } = await supabase
      .from(TABLES.profiles)
      .select("role")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();

    const role = prof?.role;
    if (role !== "instructor") {
      showGate("강사 회원만 이용 가능합니다", "일반 회원은 자료실에 접근할 수 없습니다. 강사로 가입 후 관리자 승인을 받으세요.");
      return;
    }

    const { data: insRow } = await supabase
      .from(TABLES.instructors)
      .select("id,is_approved,name")
      .or(`user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    // user_id 기반 매칭이 없으면 이메일 기반 등록 프로필과 매칭 완화 (seed 데이터에는 user_id가 없어 데모 동작 허용)
    let isApproved = insRow?.is_approved;
    if (isApproved === undefined) {
      const { data: insByName } = await supabase
        .from(TABLES.instructors)
        .select("id,is_approved,name")
        .eq("name", prof?.name || "")
        .limit(1)
        .maybeSingle();
      isApproved = insByName?.is_approved;
    }

    if (!isApproved) {
      showGate("관리자 승인 대기 중", "강사 회원가입은 완료되었으나 관리자 승인 전입니다. 승인 완료 시 이메일로 안내드립니다.");
      return;
    }

    showRoot();
    attachUpload(user);
    loadMaterials();
  })();
})();
