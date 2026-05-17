// =========================================================
// Edu-match — 내 프로필 (사진 · 이력 · 어필 메시지)
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;

  const $ = (id) => document.getElementById(id);
  const gate = $("gate");
  const content = $("content");

  function showGate() { gate.classList.remove("hidden"); content.classList.add("hidden"); }
  function showContent() { gate.classList.add("hidden"); content.classList.remove("hidden"); }

  function setMsg(text, type) {
    const m = $("save-msg");
    m.textContent = text;
    m.className = "text-sm text-center font-medium " + (type === "ok" ? "text-emerald-600" : type === "warn" ? "text-amber-600" : "text-red-600");
  }

  function setAvatar(url) {
    const img = $("avatar-img");
    const ph  = $("avatar-placeholder");
    const remove = $("avatar-remove");
    if (url) {
      img.src = url;
      img.classList.remove("hidden");
      ph.classList.add("hidden");
      remove.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
      ph.classList.remove("hidden");
      remove.classList.add("hidden");
    }
  }

  let currentUser = null;
  let currentProfile = null;

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showGate(); return; }
    currentUser = user;

    let { data: prof, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) { setMsg("프로필 조회 실패: " + error.message, "err"); }

    // 트리거가 어떤 이유로 실패했거나 RLS 가 막은 경우: 즉시 안전망으로 행 생성
    if (!prof) {
      const meta = user.user_metadata || {};
      const seed = {
        id: user.id,
        email: user.email,
        full_name: meta.full_name || (user.email || "").split("@")[0],
        role: (meta.role === "lecturer" || meta.role === "admin") ? meta.role : "client",
        membership: "basic",
        phone: meta.phone || null,
      };
      const { data: created, error: upErr } = await supabase
        .from("profiles")
        .upsert(seed, { onConflict: "id" })
        .select()
        .maybeSingle();
      if (upErr) {
        setMsg("프로필 자동 생성 실패: " + upErr.message, "err");
      }
      prof = created || seed;
    }
    currentProfile = prof;

    // META
    $("meta-email").textContent = currentProfile.email || user.email;
    $("meta-joined").textContent = currentProfile.created_at
      ? new Date(currentProfile.created_at).toLocaleDateString("ko-KR")
      : new Date(user.created_at || Date.now()).toLocaleDateString("ko-KR");

    const membership = currentProfile.membership || "basic";
    $("meta-membership").textContent = membership === "pro" ? "Pro" : "Basic";
    if (membership === "pro") {
      $("meta-membership").className = "text-sm font-bold text-brand-700";
    }

    const role = currentProfile.role || "client";
    const roleEl = $("meta-role");
    roleEl.textContent = role;
    roleEl.className = "text-xs px-2 py-0.5 rounded-full " +
      (role === "admin" ? "bg-red-100 text-red-700" :
       role === "lecturer" ? "bg-blue-100 text-blue-700" :
       "bg-slate-100 text-slate-700");

    // FORM
    $("p-name").value           = currentProfile.full_name || "";
    $("p-title").value          = currentProfile.title || "";
    $("p-phone").value          = currentProfile.phone || "";
    $("p-location").value       = currentProfile.location || "";
    $("p-category").value       = currentProfile.category || "";
    $("p-website").value        = currentProfile.website_url || "";
    $("p-bio").value            = currentProfile.bio || "";
    $("p-career").value         = currentProfile.career_summary || "";
    $("p-appeal").value         = currentProfile.appeal_message || "";
    $("p-expertise").value      = Array.isArray(currentProfile.expertise) ? currentProfile.expertise.join(", ") : "";
    $("p-years").value          = currentProfile.experience_years || 0;
    $("p-contact-email").value  = currentProfile.contact_email || currentProfile.email || user.email;

    setAvatar(currentProfile.avatar_url || "");
    showContent();
  }

  // ---------- Avatar upload ----------
  function randomName(file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
    return `${currentUser.id}/${Date.now().toString(36)}.${ext}`;
  }

  $("avatar-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { EM.toast("이미지 파일만 업로드 가능합니다.", "warn"); return; }
    if (file.size > 5 * 1024 * 1024) { EM.toast("5MB 이하로 업로드해주세요.", "warn"); return; }

    $("avatar-status").textContent = "업로드 중…";
    try {
      const path = randomName(file);
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;

      // profiles 에 즉시 반영 (.select() 로 RLS silent-fail 차단)
      const { data: rows, error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", currentUser.id)
        .select();
      if (pErr) throw pErr;
      if (!rows || rows.length === 0) {
        const { error: upErr } = await supabase
          .from("profiles")
          .upsert({ id: currentUser.id, email: currentUser.email, avatar_url: url }, { onConflict: "id" });
        if (upErr) throw upErr;
      }

      currentProfile.avatar_url = url;
      setAvatar(url);
      $("avatar-status").textContent = "✓ 사진이 저장되었습니다";
      EM.toast("프로필 사진이 변경되었습니다.", "ok");
    } catch (err) {
      $("avatar-status").textContent = "❌ 업로드 실패: " + err.message;
      EM.toast("사진 업로드 실패: " + err.message, "err");
    } finally {
      e.target.value = "";
    }
  });

  $("avatar-remove").addEventListener("click", async () => {
    if (!confirm("프로필 사진을 제거할까요?")) return;
    try {
      const { data: rows, error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", currentUser.id)
        .select();
      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error("권한이 없거나 프로필을 찾을 수 없습니다.");
      currentProfile.avatar_url = null;
      setAvatar("");
      EM.toast("프로필 사진을 제거했습니다.", "ok");
    } catch (err) {
      EM.toast("실패: " + err.message, "err");
    }
  });

  // ---------- Save profile ----------
  $("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("p-name").value.trim();
    if (name.length < 2) { setMsg("이름을 입력해주세요.", "warn"); return; }

    const phoneRaw = $("p-phone").value.replace(/[\s-]/g, "");
    if (phoneRaw && !/^01[0-9]\d{7,8}$/.test(phoneRaw)) {
      setMsg("휴대폰 번호 형식이 올바르지 않습니다.", "warn");
      return;
    }

    const expertiseList = $("p-expertise").value
      .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);

    const payload = {
      full_name: name,
      title: $("p-title").value.trim() || null,
      phone: phoneRaw || null,
      location: $("p-location").value.trim() || null,
      category: $("p-category").value || null,
      website_url: $("p-website").value.trim() || null,
      bio: $("p-bio").value.trim() || null,
      career_summary: $("p-career").value.trim() || null,
      appeal_message: $("p-appeal").value.trim() || null,
      expertise: expertiseList,
      experience_years: Number($("p-years").value) || 0,
      contact_email: $("p-contact-email").value.trim() || currentProfile.email,
    };

    setMsg("저장 중…", "ok");

    // 세션 재검증 (저장 직전 토큰 만료 방지)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setMsg("세션이 만료되었습니다. 다시 로그인해주세요.", "err");
      setTimeout(() => (location.href = "./login.html"), 1500);
      return;
    }
    if (session.user.id !== currentUser.id) currentUser = session.user;

    try {
      // .select() 로 실제 업데이트된 행을 반환받아 RLS silent fail 차단
      const { data: rows, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", currentUser.id)
        .select();
      if (error) throw error;
      if (!rows || rows.length === 0) {
        // RLS 가 wite 를 거절 → 권한 문제. 트리거가 row 를 못 만들었을 가능성.
        // 안전망: upsert 시도
        const { data: upRows, error: upErr } = await supabase
          .from("profiles")
          .upsert({ id: currentUser.id, email: currentUser.email, ...payload }, { onConflict: "id" })
          .select();
        if (upErr) throw upErr;
        if (!upRows || upRows.length === 0) {
          throw new Error("프로필 권한이 없습니다. 로그인 상태를 확인해주세요.");
        }
        Object.assign(currentProfile, upRows[0]);
      } else {
        Object.assign(currentProfile, rows[0]);
      }
      setMsg("✓ 프로필이 저장되었습니다.", "ok");
      EM.toast("프로필이 저장되었습니다.", "ok");
      // DB 의 최종 상태로 폼 재로드 (트리거/제약/디폴트가 적용된 진실의 단일 소스)
      await loadProfile();
    } catch (err) {
      console.error("[profile save]", err);
      setMsg("저장 실패: " + err.message, "err");
    }
  });

  $("btn-signout").addEventListener("click", async () => {
    await EM.signOut();
    location.href = "./index.html";
  });

  loadProfile();
})();
