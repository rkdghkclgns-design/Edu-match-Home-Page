// =========================================================
// Edu-match — Supabase Client (shared init + Auth helpers)
// =========================================================
// 새 Tailwind 기반 페이지(index.html, admin-dashboard.html) 에서 공용으로 사용합니다.
// 기존 supabase-config.js 는 legacy em_* 페이지용으로 유지됩니다.
// =========================================================

(function () {
  const SUPABASE_URL = "https://pkwbqbxuujpcvndpacsc.supabase.co";
  const SUPABASE_ANON_KEY = "sb-publishable-key-placeholder";

  // Publishable key (공개용 anon key) — RLS 가 안전장치 역할
  const PUBLISHABLE_KEY = "sb_publishable_09z4u2K4XVU5fUl2e532Fg_kqct0zez";

  if (!window.supabase) {
    console.error("[Edu-match] @supabase/supabase-js CDN 이 로드되지 않았습니다.");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Toast 알림 (전역)
  function toast(text, type) {
    type = type || "ok";
    let box = document.getElementById("em-toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "em-toast-box";
      box.style.cssText =
        "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    const base = "padding:12px 16px;border-radius:12px;color:#fff;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.15);min-width:260px;max-width:360px;";
    const styles = {
      ok:   "background:linear-gradient(135deg,#4f46e5,#06b6d4);",
      warn: "background:linear-gradient(135deg,#f59e0b,#f97316);",
      err:  "background:linear-gradient(135deg,#ef4444,#b91c1c);",
    };
    t.style.cssText = base + (styles[type] || styles.ok);
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .4s ease, transform .4s ease"; t.style.opacity = "0"; t.style.transform = "translateY(8px)"; }, 2800);
    setTimeout(() => t.remove(), 3400);
  }

  // Auth 편의 함수
  async function signUp({ email, password, fullName, role }) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) throw error;

    // profiles upsert (id = auth.users.id)
    if (data.user) {
      const { error: pErr } = await client.from("profiles").upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: role || "client",
        membership: "basic",
      }, { onConflict: "id" });
      if (pErr) console.warn("profile upsert warning:", pErr);
    }
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function getCurrentProfile() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;
    const { data } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    return data || { id: user.id, email: user.email, full_name: "", role: "client", membership: "basic" };
  }

  // 멤버십 업그레이드 (Pro 구독)
  async function upgradeToPro() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error("로그인이 필요합니다.");
    const { data, error } = await client
      .from("profiles")
      .update({ membership: "pro", pro_since: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // 이력서 업로드 → public URL
  async function uploadResume(file, applicantEmail) {
    if (!file) return null;
    const safeEmail = (applicantEmail || "anon").replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "pdf";
    const path = `${new Date().toISOString().slice(0, 10)}/${safeEmail}-${Date.now().toString(36)}.${ext}`;
    const { error } = await client.storage.from("resumes").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
    const { data } = client.storage.from("resumes").getPublicUrl(path);
    return data.publicUrl;
  }

  window.EM = {
    client,
    SUPABASE_URL,
    PUBLISHABLE_KEY,
    toast,
    signUp,
    signIn,
    signOut,
    getCurrentProfile,
    upgradeToPro,
    uploadResume,
  };
})();
