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

    const { data: prof, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) { setMsg("프로필 조회 실패: " + error.message, "err"); }
    currentProfile = prof || { id: user.id, email: user.email };

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

      // profiles 에 즉시 반영
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", currentUser.id);
      if (pErr) throw pErr;

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
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", currentUser.id);
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
    try {
      const { error } = await supabase.from("profiles").update(payload).eq("id", currentUser.id);
      if (error) throw error;
      Object.assign(currentProfile, payload);
      setMsg("✓ 프로필이 저장되었습니다.", "ok");
      EM.toast("프로필이 저장되었습니다.", "ok");
    } catch (err) {
      setMsg("저장 실패: " + err.message, "err");
    }
  });

  $("btn-signout").addEventListener("click", async () => {
    await EM.signOut();
    location.href = "./index.html";
  });

  loadProfile();
})();
