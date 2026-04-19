// Edu-match — 강사 자료실 (Tailwind rebuild)
(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;
  const TABLE = "em_lecture_materials";

  const $ = (id) => document.getElementById(id);
  const escape = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const CATS = [
    { key:"corporate-lecture", label:"기업출강 워크샵" },
    { key:"teambuilding",      label:"팀빌딩 프로그램" },
    { key:"craft-experience",  label:"공방체험" },
    { key:"diy-kit",           label:"DIY키트" },
    { key:"it-ai",             label:"IT · AI 교육" },
    { key:"leadership",        label:"리더십 · 조직개발" },
    { key:"design",            label:"디자인 · UX" },
    { key:"data",              label:"데이터 분석" },
  ];
  const catLabel = (k) => CATS.find((c) => c.key === k)?.label || k;

  const gate = $("gate"), root = $("materials-root"), userEmail = $("user-email"), loginLink = $("login-link");
  const countEl = $("materials-count");

  function showGate(title, msg) {
    gate.classList.remove("hidden");
    root.classList.add("hidden");
    $("gate-title").textContent = title;
    $("gate-msg").textContent = msg;
  }
  function showRoot() {
    gate.classList.add("hidden");
    root.classList.remove("hidden");
  }

  async function loadMaterials() {
    const grid = $("materials-grid");
    try {
      const { data, error } = await supabase.from(TABLE).select("*").eq("is_approved", true).order("created_at", { ascending: false });
      if (error) throw error;
      countEl.textContent = `${data?.length || 0}건의 승인 자료`;
      if (!data?.length) { grid.innerHTML = `<p class="col-span-full text-sm text-slate-400 text-center py-12">등록된 승인 자료가 없습니다.</p>`; return; }
      grid.innerHTML = data.map((m) => `
        <article class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h3 class="font-bold">${escape(m.title)}</h3>
          <div class="mt-1 text-xs text-slate-500">${escape(catLabel(m.category))} · ${escape(m.uploaded_by_name || m.uploaded_by_email || "익명")}</div>
          <p class="mt-2 text-sm text-slate-600 line-clamp-3">${escape(m.description || "")}</p>
          <div class="mt-3 flex flex-wrap gap-1">${(m.tags || []).map((t) => `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escape(t)}</span>`).join("")}</div>
          ${m.material_url ? `<a href="${escape(m.material_url)}" target="_blank" rel="noopener" class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">자료 열기 →</a>` : ""}
        </article>
      `).join("");
    } catch (err) {
      grid.innerHTML = `<p class="col-span-full text-sm text-red-600">오류: ${escape(err.message)}</p>`;
    }
  }

  async function attachUpload(currentUser) {
    const form = $("upload-form");
    $("show-upload").addEventListener("click", () => form.classList.toggle("hidden"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("upload-msg");
      try {
        const { error } = await supabase.from(TABLE).insert({
          title: $("m-title").value.trim(),
          description: $("m-desc").value.trim(),
          category: $("m-category").value,
          material_url: $("m-url").value.trim(),
          tags: $("m-tags").value.split(",").map((s) => s.trim()).filter(Boolean),
          uploaded_by_email: currentUser.email,
          uploaded_by_name: currentUser.user_metadata?.name || currentUser.email,
          visibility: "instructor-only",
          is_approved: false,
        });
        if (error) throw error;
        msg.textContent = "업로드 완료. 관리자 승인 후 공개됩니다.";
        msg.className = "text-sm text-center font-medium text-emerald-600";
        EM.toast("자료 업로드 완료.", "ok");
        form.reset();
      } catch (err) {
        msg.textContent = "업로드 실패: " + err.message;
        msg.className = "text-sm text-center font-medium text-red-600";
      }
    });
  }

  $("logout-btn").addEventListener("click", async () => {
    await EM.signOut();
    location.href = "./index.html";
  });

  (async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showGate("로그인이 필요합니다", "강사 전용 자료실입니다. 로그인 후 이용해주세요."); return; }
    userEmail.textContent = user.email;
    loginLink.classList.add("hidden");

    const { data: prof } = await supabase.from("profiles").select("*").eq("email", user.email).maybeSingle();
    if (!prof || prof.role !== "lecturer") {
      showGate("강사 회원만 이용 가능합니다", "강사 회원가입 후 관리자 승인 완료 시 접근할 수 있습니다.");
      return;
    }
    if (!prof.is_approved) {
      showGate("관리자 승인 대기 중", "강사 회원가입이 접수되었으나 아직 승인 전입니다.");
      return;
    }

    showRoot();
    attachUpload(user);
    loadMaterials();
  })();
})();
