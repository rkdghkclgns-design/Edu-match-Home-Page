// =========================================================
// Edu-match — Supabase Client (shared init + Auth helpers)
// =========================================================
// 새 Tailwind 기반 페이지(index.html, admin-dashboard.html) 에서 공용으로 사용합니다.
// 기존 supabase-config.js 는 legacy em_* 페이지용으로 유지됩니다.
// =========================================================

(function () {
  const SUPABASE_URL = "https://pkwbqbxuujpcvndpacsc.supabase.co";
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
  // - profiles 행은 auth.users insert 트리거(`handle_new_auth_user`)가 자동 생성
  // - 세션이 즉시 발급되면(이메일 확인 비활성) 클라이언트에서도 한 번 더 upsert 해 최신값 보장
  // - 이메일 확인이 켜진 환경에서는 인증 완료 후 로그인 시점에 풀필 됨
  async function signUp({ email, password, fullName, role }) {
    const safeRole = (role === "lecturer" || role === "client" || role === "admin") ? role : "client";
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || "", role: safeRole } },
    });
    if (error) throw error;

    // 즉시 로그인된 경우만 client-side upsert (RLS: auth.uid() = id 필요)
    // 트리거가 이미 row 를 생성했더라도 onConflict 로 안전하게 갱신
    if (data?.session && data.user) {
      const { error: pErr } = await client.from("profiles").upsert({
        id: data.user.id,
        email,
        full_name: fullName || "",
        role: safeRole,
        membership: "basic",
      }, { onConflict: "id" });
      if (pErr) {
        toast("프로필 동기화 실패: " + pErr.message + " (관리자 문의 필요)", "warn");
      }
    }

    return {
      ...data,
      // UI 가 분기 처리할 수 있도록 명확한 플래그 제공
      needsEmailConfirmation: !data?.session && !!data?.user,
    };
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

  // 멤버십 업그레이드 (Pro 구독) — BETA 에서는 호출 자체를 차단
  // 운영 시에는 Edge Function 에서 결제 검증 후 service_role 로 update 하는 흐름으로 교체
  async function upgradeToPro() {
    if (window.EM_BETA_PAID_DISABLED === true) {
      throw new Error("결제 기능은 정식 오픈 시 활성화됩니다.");
    }
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

  // 이력서 업로드 → public URL (MIME guard 포함)
  const RESUME_MIME_ALLOW = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/jpg", "image/png",
  ]);
  async function uploadResume(file, applicantEmail) {
    if (!file) return null;
    if (file.size > 10 * 1024 * 1024) throw new Error("파일은 10MB 이하만 업로드 가능합니다.");
    if (file.type && !RESUME_MIME_ALLOW.has(file.type)) {
      throw new Error("PDF · DOC · DOCX · JPG · PNG 형식만 업로드 가능합니다.");
    }
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

  // =========================================================
  // 베타 안내 배너 (오늘 하루 보지 않기)
  // =========================================================
  const BETA_DISMISS_KEY = "em_beta_dismissed_date";
  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function mountBetaBanner() {
    if (document.getElementById("em-beta-banner")) return;
    if (localStorage.getItem(BETA_DISMISS_KEY) === todayKey()) return;

    const wrap = document.createElement("div");
    wrap.id = "em-beta-banner";
    wrap.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:60",
      "background:linear-gradient(90deg,#4f46e5 0%,#0891b2 100%)",
      "color:#fff", "font-family:Pretendard,system-ui,sans-serif",
      "padding:10px 16px", "font-size:13px", "font-weight:600",
      "display:flex", "align-items:center", "gap:12px",
      "box-shadow:0 2px 10px rgba(0,0,0,0.10)",
    ].join(";");
    wrap.innerHTML = `
      <span style="background:rgba(255,255,255,0.18);padding:3px 8px;border-radius:999px;font-weight:800;letter-spacing:0.05em;font-size:11px;">BETA</span>
      <span style="flex:1;line-height:1.5;">
        현재 Edu-match 는 <strong>베타 운영 중</strong> 입니다 — <strong>강의 공고 등록 · 강사 매칭</strong> 기능만 제공됩니다. 결제 · Pro 멤버십 · 정산 기능은 정식 오픈 시 공개됩니다.
      </span>
      <button id="em-beta-dismiss" type="button" style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">오늘 하루 보지 않기</button>
      <button id="em-beta-close" type="button" aria-label="닫기" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px;">×</button>
    `;
    document.body.prepend(wrap);

    // 콘텐츠가 가려지지 않도록 본문 상단 패딩 추가 (헤더 sticky 와 함께 동작)
    // 첫 페인트 후 실제 높이로 재조정 (offsetHeight 가 0 인 초기 측정 보완)
    let h = wrap.offsetHeight;
    if (!h) h = 56; // 안전 기본값
    document.body.style.paddingTop = h + "px";
    requestAnimationFrame(() => {
      const real = wrap.offsetHeight || h;
      document.body.style.paddingTop = real + "px";
      document.querySelectorAll("header.sticky, header.fixed").forEach((el) => { el.style.top = real + "px"; });
    });
    // sticky 헤더가 있으면 top 위치를 배너 아래로 내림
    document.querySelectorAll("header.sticky, header.fixed").forEach((el) => {
      el.dataset.emOriginalTop = el.style.top || "";
      el.style.top = h + "px";
    });

    function close(persist) {
      wrap.remove();
      document.body.style.paddingTop = "";
      document.querySelectorAll("header.sticky, header.fixed").forEach((el) => {
        el.style.top = el.dataset.emOriginalTop || "";
      });
      if (persist) localStorage.setItem(BETA_DISMISS_KEY, todayKey());
    }
    wrap.querySelector("#em-beta-dismiss").addEventListener("click", () => {
      close(true);
      toast("오늘 하루 베타 배너를 숨깁니다.", "ok");
    });
    wrap.querySelector("#em-beta-close").addEventListener("click", () => close(false));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountBetaBanner);
  } else {
    mountBetaBanner();
  }

  // BETA: 결제 비활성 플래그 (upgradeToPro 가 참조)
  window.EM_BETA_PAID_DISABLED = true;

  // =========================================================
  // 운영자 알림 (PBL/슬라이드 의뢰 → rkdghkclgns@naver.com)
  // =========================================================
  const NOTIFY_TO = "rkdghkclgns@naver.com";
  const NOTIFY_URL = `${SUPABASE_URL}/functions/v1/em-notify-request`;

  // 1) Edge Function 비동기 호출 (best-effort, 실패해도 사용자 흐름 차단 X)
  async function notifyOps(payload) {
    try {
      const resp = await fetch(NOTIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      return { ok: resp.ok && data?.ok, data };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // 2) 사용자 이메일 클라이언트 mailto: (확실한 백업 — 클릭만 하면 전송)
  function openMailto({ subject, body }) {
    const url = `mailto:${encodeURIComponent(NOTIFY_TO)}?subject=${encodeURIComponent(subject || "[Edu-match] 의뢰 접수")}&body=${encodeURIComponent(body || "")}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  }

  // 3) 한 번에 사용하는 헬퍼 — Edge fn 시도 + mailto 백업 + 토스트 안내
  async function notifyAndMail({ type, subject, summary, fields, request_id, requester_name, requester_email }) {
    const result = await notifyOps({ type, subject, summary, fields, request_id, requester_name, requester_email });

    // mailto 백업 본문 (line 길이 적당히 정리)
    const lines = [];
    lines.push(`[Edu-match] ${type === "slide" ? "슬라이드" : type === "pbl" ? "PBL" : "의뢰"} 접수 알림`);
    if (subject) lines.push(`${subject}`);
    lines.push("");
    if (request_id) lines.push(`의뢰번호: ${request_id}`);
    if (requester_name) lines.push(`의뢰자: ${requester_name}`);
    if (requester_email) lines.push(`이메일: ${requester_email}`);
    if (summary) { lines.push(""); lines.push(summary); }
    if (fields) {
      lines.push("");
      for (const [k, v] of Object.entries(fields)) {
        if (v != null && v !== "") lines.push(`- ${k}: ${v}`);
      }
    }
    openMailto({ subject, body: lines.join("\n") });

    return result;
  }

  window.EM = {
    client,
    SUPABASE_URL,
    toast,
    signUp,
    signIn,
    signOut,
    getCurrentProfile,
    upgradeToPro,
    uploadResume,
    mountBetaBanner,
    notifyOps,
    notifyAndMail,
    openMailto,
    NOTIFY_TO,
  };
})();
