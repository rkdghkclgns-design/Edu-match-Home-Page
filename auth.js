// =========================================================
// Edu-match — Authentication (Signup / Login)
// =========================================================
// Supabase Auth + em_profiles 테이블 연동
// 관리자 로그인은 em-admin-auth Edge Function (HMAC 세션 토큰) 으로 검증
// =========================================================

(function () {
  const em = window.EduMatch || {};
  const supabase = em.supabase;
  const TABLES = em.TABLES || { profiles: "em_profiles" };

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = "auth-message is-shown auth-message--" + (type || "error");
  }

  // ---------- 회원가입 ----------
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("signup-message");
      const data = new FormData(signupForm);
      const name = (data.get("name") || "").toString().trim();
      const email = (data.get("email") || "").toString().trim();
      const phone = (data.get("phone") || "").toString().trim();
      const role = (data.get("role") || "user").toString();
      const category = (data.get("category") || "").toString();
      const password = (data.get("password") || "").toString();
      const password2 = (data.get("password2") || "").toString();

      if (password.length < 6) {
        showMessage(msg, "비밀번호는 6자 이상이어야 합니다.", "error");
        return;
      }
      if (password !== password2) {
        showMessage(msg, "비밀번호가 일치하지 않습니다.", "error");
        return;
      }

      if (!supabase) {
        showMessage(msg, "Supabase 설정이 필요합니다. supabase-config.js 를 확인해주세요.", "error");
        return;
      }

      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role, category } },
        });
        if (signUpError) throw signUpError;

        const user = signUpData.user;
        const { error: profileError } = await supabase
          .from(TABLES.profiles)
          .insert({
            user_id: user ? user.id : null,
            email,
            name,
            phone,
            role,
            category,
          });
        if (profileError) console.warn("profile insert error:", profileError);

        // 강사 가입의 경우 em_instructors 에 승인 대기 상태로 등록
        if (role === "instructor" && em.TABLES?.instructors) {
          const { error: insErr } = await supabase
            .from(em.TABLES.instructors)
            .insert({
              user_id: user ? user.id : null,
              name,
              title: "강사 회원 (심사 대기)",
              bio: "관리자 승인 대기 중입니다.",
              category,
              is_approved: false,
              is_featured: false,
            });
          if (insErr) console.warn("instructor insert error:", insErr);
        }

        const successMsg = role === "instructor"
          ? "강사 회원가입이 접수되었습니다. 관리자 승인 후 자료실 이용이 가능합니다."
          : "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다…";
        showMessage(msg, successMsg, "success");
        signupForm.reset();
        setTimeout(() => (window.location.href = "./login.html"), 1800);
      } catch (err) {
        showMessage(msg, "회원가입 실패: " + (err.message || err), "error");
      }
    });
  }

  // ---------- 로그인 탭 전환 ----------
  const tabs = document.querySelectorAll(".auth-tab");
  const panels = document.querySelectorAll("[data-panel]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.getAttribute("data-tab");
      tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      panels.forEach((p) => {
        if (p.getAttribute("data-panel") === key) p.style.display = "";
        else if (p.classList.contains("auth-form")) p.style.display = "none";
      });
    });
  });

  // ---------- 일반 로그인 ----------
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("login-message");
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      if (!supabase) {
        showMessage(msg, "Supabase 설정이 필요합니다.", "error");
        return;
      }

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showMessage(msg, "로그인 성공! 홈으로 이동합니다…", "success");
        setTimeout(() => (window.location.href = "./index.html"), 1200);
      } catch (err) {
        showMessage(msg, "로그인 실패: " + (err.message || err), "error");
      }
    });
  }

  // ---------- 관리자 로그인 (Supabase Edge Function 경유) ----------
  const adminForm = document.getElementById("admin-login-form");
  if (adminForm) {
    adminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("admin-login-message");
      const submitBtn = adminForm.querySelector("button[type=submit]");
      const id = document.getElementById("admin-id").value.trim();
      const pw = document.getElementById("admin-pw").value;

      if (typeof em.adminLogin !== "function") {
        showMessage(msg, "관리자 인증 엔드포인트가 설정되지 않았습니다.", "error");
        return;
      }

      try {
        submitBtn.disabled = true;
        showMessage(msg, "인증 중…", "success");
        await em.adminLogin(id, pw);
        showMessage(msg, "관리자 인증 성공. 관리자 페이지로 이동합니다…", "success");
        setTimeout(() => (window.location.href = "./admin.html"), 800);
      } catch (err) {
        showMessage(msg, (err && err.message) ? err.message : "관리자 인증 실패", "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
})();
