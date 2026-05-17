// =========================================================
// Edu-match — 자유 게시판 (em_board_posts + em_board_comments)
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase client missing"); return; }
  const supabase = EM.client;
  const BUCKET = "em-posting-media";

  const $ = (id) => document.getElementById(id);
  const escape = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return Math.floor(diff / 60) + "분 전";
    if (diff < 86400) return Math.floor(diff / 3600) + "시간 전";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + "일 전";
    return d.toLocaleDateString("ko-KR");
  };

  // ---------- Tiny markdown (이미지 + YouTube 임베드) ----------
  function md(raw) {
    if (!raw) return "";
    let t = String(raw);
    const tokens = [];
    const push = (h) => { const k = `@@T${tokens.length}@@`; tokens.push(h); return k; };
    t = t.replace(/\[\[youtube:([a-zA-Z0-9_-]{11})\]\]/g, (_, id) =>
      push(`<div class="aspect-video my-3 rounded-xl overflow-hidden"><iframe src="https://www.youtube.com/embed/${id}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div>`));
    t = t.replace(/^(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:[^\s]*&)?v=[a-zA-Z0-9_-]{11}[^\s]*|youtu\.be\/[a-zA-Z0-9_-]{11}[^\s]*))$/gm, (url) => {
      const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return m ? push(`<div class="aspect-video my-3 rounded-xl overflow-hidden"><iframe src="https://www.youtube.com/embed/${m[1]}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div>`) : url;
    });
    t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, url) =>
      push(`<figure class="my-3"><img src="${escape(url)}" alt="${escape(alt)}" class="rounded-xl w-full max-h-96 object-cover" loading="lazy" referrerpolicy="no-referrer"/></figure>`));
    t = escape(t);
    t = t.replace(/@@T(\d+)@@/g, (_, i) => tokens[Number(i)] || "");
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand-600 hover:underline">$1</a>');
    t = t.replace(/^#{3}\s+(.+)$/gm, '<h4 class="mt-3 font-semibold">$1</h4>');
    t = t.replace(/^#{2}\s+(.+)$/gm, '<h3 class="mt-4 text-lg font-bold">$1</h3>');
    t = t.replace(/^#\s+(.+)$/gm,    '<h2 class="mt-4 text-xl font-extrabold">$1</h2>');
    t = t.replace(/^(?:-\s+.+(?:\n|$))+?/gm, (block) => {
      const items = block.trim().split("\n").map((l) => l.replace(/^-\s+/, "")).map((l) => `<li>${l}</li>`).join("");
      return `<ul class="list-disc ml-5 my-2 space-y-1">${items}</ul>`;
    });
    t = t.replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>");
    return t;
  }

  // ---------- State ----------
  let __me = null;        // 현재 로그인 프로필
  let __posts = [];

  async function refreshMe() {
    __me = await EM.getCurrentProfile();
    if (__me?.id) {
      $("me-label").textContent = __me.full_name || __me.email;
      $("login-link").classList.add("hidden");
      $("profile-link").classList.remove("hidden");
    } else {
      $("me-label").textContent = "비로그인";
      $("login-link").classList.remove("hidden");
      $("profile-link").classList.add("hidden");
    }
  }

  // ---------- List render ----------
  async function loadPosts() {
    const root = $("board-list");
    try {
      const { data, error } = await supabase
        .from("em_board_posts")
        .select("*")
        .eq("is_deleted", false)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      __posts = data || [];
      render();
    } catch (err) {
      root.innerHTML = `<div class="text-sm text-red-600 text-center py-12">오류: ${escape(err.message)}</div>`;
    }
  }

  function render() {
    const root = $("board-list");
    const q = ($("board-search").value || "").trim().toLowerCase();
    let list = __posts;
    if (q) {
      list = list.filter((p) => [p.title, p.body, p.author_name].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    if (!list.length) {
      root.innerHTML = `
        <div class="rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <div class="text-4xl">💬</div>
          <h3 class="mt-3 font-bold">아직 게시글이 없습니다</h3>
          <p class="mt-1 text-sm text-slate-500">첫 번째 글을 작성해보세요!</p>
          <button type="button" data-open-compose class="mt-4 px-5 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700">새 글 쓰기</button>
        </div>`;
      return;
    }
    root.innerHTML = list.map((p) => {
      const isMine = __me?.id === p.author_id;
      const canEdit = isMine || __me?.role === "admin";
      const avatar = p.author_avatar_url
        ? `<img src="${escape(p.author_avatar_url)}" class="w-9 h-9 rounded-full object-cover" referrerpolicy="no-referrer"/>`
        : `<div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">${escape((p.author_name || "?").charAt(0))}</div>`;
      return `
        <article class="bg-white rounded-2xl border border-slate-200 hover:border-brand-200 transition shadow-sm">
          <header class="px-5 py-4 flex items-center gap-3">
            ${avatar}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                ${p.is_pinned ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">📌 고정</span>' : ''}
                <span class="font-semibold text-sm">${escape(p.author_name || "익명")}</span>
                <span class="text-xs text-slate-400">· ${escape(fmtTime(p.created_at))}</span>
              </div>
            </div>
            <button data-toggle-post="${escape(p.id)}" class="text-xs text-slate-500 hover:text-slate-900 font-semibold">상세 ▾</button>
          </header>
          <div class="px-5 pb-4 cursor-pointer" data-toggle-post="${escape(p.id)}">
            <h3 class="font-bold text-lg leading-snug">${escape(p.title)}</h3>
            <p class="mt-1 text-sm text-slate-600 line-clamp-2">${escape(p.body).slice(0, 200)}</p>
            <div class="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>👁 ${p.view_count || 0}</span>
              <span>💬 ${p.comment_count || 0}</span>
            </div>
          </div>
          <div data-detail="${escape(p.id)}" class="hidden border-t border-slate-100 px-5 py-4 space-y-4">
            <div class="prose-sm text-slate-800 leading-relaxed">${md(p.body)}</div>
            <div class="flex items-center gap-2 pt-2">
              ${canEdit ? `<button data-edit-post="${escape(p.id)}" class="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold">수정</button>` : ''}
              ${canEdit ? `<button data-delete-post="${escape(p.id)}" class="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 font-semibold">삭제</button>` : ''}
              ${__me?.role === "admin" ? `<button data-pin-post="${escape(p.id)}" data-pinned="${p.is_pinned ? '1' : '0'}" class="text-xs px-3 py-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold">${p.is_pinned ? '고정 해제' : '📌 고정'}</button>` : ''}
            </div>
            <div data-comments-root="${escape(p.id)}" class="pt-3 border-t border-slate-100"></div>
          </div>
        </article>`;
    }).join("");
  }

  $("board-search").addEventListener("input", render);

  // ---------- Post toggle + view increment ----------
  document.body.addEventListener("click", async (e) => {
    const tog = e.target.closest("[data-toggle-post]");
    if (tog) {
      const id = tog.getAttribute("data-toggle-post");
      const detail = document.querySelector(`[data-detail="${CSS.escape(id)}"]`);
      if (!detail) return;
      const opening = detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      if (opening) {
        // 조회수 증가 (논블로킹)
        supabase.rpc.bind(null);
        supabase.from("em_board_posts").update({ view_count: (__posts.find((p) => p.id === id)?.view_count || 0) + 1 }).eq("id", id).then();
        // 댓글 로드
        loadComments(id);
      }
      return;
    }
    const opn = e.target.closest("[data-open-compose]");
    if (opn) openCompose();
  });

  // ---------- Compose modal ----------
  const composeModal = $("modal-compose");
  function openCompose(post) {
    if (!__me?.id) { EM.toast("로그인이 필요합니다.", "warn"); location.href = "./login.html"; return; }
    $("compose-id").value = post?.id || "";
    $("compose-title-input").value = post?.title || "";
    $("compose-body").value = post?.body || "";
    $("compose-title").textContent = post ? "글 수정" : "새 글 쓰기";
    $("compose-msg").textContent = "";
    composeModal.classList.remove("hidden");
    composeModal.classList.add("flex");
  }
  function closeCompose() { composeModal.classList.add("hidden"); composeModal.classList.remove("flex"); }
  document.querySelectorAll("[data-close-compose]").forEach((b) => b.addEventListener("click", closeCompose));
  composeModal.addEventListener("click", (e) => { if (e.target === composeModal) closeCompose(); });
  $("btn-new-post").addEventListener("click", () => openCompose());

  // ---------- Compose: paste image + YouTube helpers ----------
  const bodyEl = $("compose-body");
  function insertAt(textarea, txt) {
    const s = textarea.selectionStart || 0, e = textarea.selectionEnd || 0;
    textarea.value = textarea.value.slice(0, s) + txt + textarea.value.slice(e);
    textarea.selectionStart = textarea.selectionEnd = s + txt.length;
    textarea.focus();
  }
  function ytId(url) {
    const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  async function uploadImage(file) {
    if (!file.type.startsWith("image/")) throw new Error("이미지만 업로드 가능");
    if (file.size > 8 * 1024 * 1024) throw new Error("8MB 이하로 업로드해주세요");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
    const path = `board/${new Date().toISOString().slice(0, 10)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  bodyEl.addEventListener("paste", async (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const items = Array.from(cd.items || []);
    const imgItem = items.find((i) => i.kind === "file" && i.type.startsWith("image/"));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      const ph = `\n![업로드 중…](uploading)\n`;
      insertAt(bodyEl, ph);
      $("compose-hint").textContent = "📤 이미지 업로드 중…";
      try {
        const url = await uploadImage(file);
        bodyEl.value = bodyEl.value.replace(ph.trim(), `\n![이미지](${url})\n`);
        $("compose-hint").textContent = "✅ 이미지 업로드 완료";
      } catch (err) {
        bodyEl.value = bodyEl.value.replace(ph.trim(), `\n[이미지 업로드 실패: ${err.message}]\n`);
        $("compose-hint").textContent = "❌ 업로드 실패: " + err.message;
      }
      return;
    }
    const text = cd.getData("text");
    const id = ytId(text);
    if (id) { e.preventDefault(); insertAt(bodyEl, `\n[[youtube:${id}]]\n`); $("compose-hint").textContent = "🎥 YouTube 임베드 삽입"; }
  });

  $("compose-img-btn").addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.addEventListener("change", async () => {
      const f = inp.files?.[0]; if (!f) return;
      $("compose-hint").textContent = "📤 이미지 업로드 중…";
      try {
        const url = await uploadImage(f);
        insertAt(bodyEl, `\n![${f.name.replace(/\.[^.]+$/, "")}](${url})\n`);
        $("compose-hint").textContent = "✅ 이미지 삽입 완료";
      } catch (err) { $("compose-hint").textContent = "❌ " + err.message; }
    });
    inp.click();
  });
  $("compose-yt-btn").addEventListener("click", () => {
    const url = prompt("YouTube 영상 URL을 붙여넣으세요");
    if (!url) return;
    const id = ytId(url);
    if (!id) { $("compose-hint").textContent = "❌ 올바른 YouTube URL 이 아닙니다"; return; }
    insertAt(bodyEl, `\n[[youtube:${id}]]\n`);
    $("compose-hint").textContent = "🎥 YouTube 임베드 삽입";
  });

  // ---------- Compose submit ----------
  $("compose-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("compose-id").value || null;
    const title = $("compose-title-input").value.trim();
    const body = $("compose-body").value.trim();
    if (title.length < 2 || body.length < 2) {
      $("compose-msg").textContent = "제목과 본문을 모두 입력해주세요.";
      $("compose-msg").className = "text-sm text-center font-medium text-red-600";
      return;
    }
    if (!__me?.id) { EM.toast("로그인이 필요합니다.", "warn"); return; }

    $("compose-msg").textContent = "저장 중…";
    $("compose-msg").className = "text-sm text-center font-medium text-emerald-600";

    try {
      if (id) {
        // 수정
        const { data: rows, error } = await supabase
          .from("em_board_posts")
          .update({ title, body, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select();
        if (error) throw error;
        if (!rows?.length) throw new Error("수정 권한이 없습니다.");
      } else {
        // 신규
        const { error } = await supabase.from("em_board_posts").insert({
          author_id: __me.id,
          author_name: __me.full_name || __me.email,
          author_avatar_url: __me.avatar_url || null,
          title, body,
        });
        if (error) throw error;
      }
      $("compose-msg").textContent = "✓ 저장되었습니다.";
      EM.toast(id ? "게시글이 수정되었습니다." : "게시글이 등록되었습니다.", "ok");
      closeCompose();
      loadPosts();
    } catch (err) {
      $("compose-msg").textContent = "저장 실패: " + err.message;
      $("compose-msg").className = "text-sm text-center font-medium text-red-600";
    }
  });

  // ---------- Edit / delete / pin ----------
  document.body.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit-post]");
    if (edit) {
      const id = edit.getAttribute("data-edit-post");
      const p = __posts.find((x) => x.id === id); if (!p) return;
      openCompose(p);
      return;
    }
    const del = e.target.closest("[data-delete-post]");
    if (del) {
      if (!confirm("이 게시글을 삭제할까요?")) return;
      const id = del.getAttribute("data-delete-post");
      const { error } = await supabase.from("em_board_posts").delete().eq("id", id);
      if (error) return EM.toast("삭제 실패: " + error.message, "err");
      EM.toast("삭제되었습니다.", "ok");
      loadPosts();
      return;
    }
    const pin = e.target.closest("[data-pin-post]");
    if (pin) {
      const id = pin.getAttribute("data-pin-post");
      const isPinned = pin.getAttribute("data-pinned") === "1";
      const { error } = await supabase.from("em_board_posts").update({ is_pinned: !isPinned }).eq("id", id);
      if (error) return EM.toast("실패: " + error.message, "err");
      EM.toast(!isPinned ? "글이 고정되었습니다." : "고정이 해제되었습니다.", "ok");
      loadPosts();
      return;
    }
  });

  // ---------- Comments ----------
  async function loadComments(postId) {
    const root = document.querySelector(`[data-comments-root="${CSS.escape(postId)}"]`);
    if (!root) return;
    root.innerHTML = `<div class="text-xs text-slate-400">댓글 로딩 중…</div>`;
    const { data, error } = await supabase
      .from("em_board_comments")
      .select("*")
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });
    if (error) { root.innerHTML = `<div class="text-xs text-red-600">오류: ${escape(error.message)}</div>`; return; }
    const list = (data || []).map((c) => {
      const canDel = __me?.id === c.author_id || __me?.role === "admin";
      const av = c.author_avatar_url
        ? `<img src="${escape(c.author_avatar_url)}" class="w-7 h-7 rounded-full object-cover" referrerpolicy="no-referrer"/>`
        : `<div class="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">${escape((c.author_name || "?").charAt(0))}</div>`;
      return `
        <div class="flex items-start gap-2 py-2">
          ${av}
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 text-xs">
              <span class="font-semibold">${escape(c.author_name || "익명")}</span>
              <span class="text-slate-400">· ${escape(fmtTime(c.created_at))}</span>
              ${canDel ? `<button data-delete-comment="${escape(c.id)}" data-post="${escape(postId)}" class="ml-auto text-red-500 hover:text-red-700">삭제</button>` : ''}
            </div>
            <p class="mt-0.5 text-sm whitespace-pre-wrap">${escape(c.body)}</p>
          </div>
        </div>`;
    }).join("") || `<div class="text-xs text-slate-400">아직 댓글이 없습니다.</div>`;

    const composer = __me?.id ? `
      <form class="mt-3 flex gap-2" data-comment-form data-post="${escape(postId)}">
        <input type="text" required minlength="1" maxlength="500" placeholder="댓글을 입력하세요" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"/>
        <button type="submit" class="px-3 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700">등록</button>
      </form>` : `
      <p class="mt-3 text-xs text-slate-500"><a href="./login.html" class="text-brand-600 hover:underline font-semibold">로그인</a> 후 댓글을 작성할 수 있습니다.</p>`;

    root.innerHTML = `
      <div class="text-xs font-bold text-slate-700 mb-1">💬 댓글 (${(data || []).length})</div>
      <div class="divide-y divide-slate-100">${list}</div>
      ${composer}
    `;
  }

  document.body.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-comment-form]");
    if (!form) return;
    e.preventDefault();
    if (!__me?.id) return;
    const postId = form.getAttribute("data-post");
    const input = form.querySelector("input[type='text']");
    const body = input.value.trim();
    if (!body) return;
    const { error } = await supabase.from("em_board_comments").insert({
      post_id: postId,
      author_id: __me.id,
      author_name: __me.full_name || __me.email,
      author_avatar_url: __me.avatar_url || null,
      body,
    });
    if (error) return EM.toast("댓글 실패: " + error.message, "err");
    input.value = "";
    loadComments(postId);
    // comment_count 트리거가 동기화하지만 로컬 카드도 즉시 +1
    const p = __posts.find((x) => x.id === postId);
    if (p) { p.comment_count = (p.comment_count || 0) + 1; }
  });

  document.body.addEventListener("click", async (e) => {
    const delC = e.target.closest("[data-delete-comment]");
    if (!delC) return;
    if (!confirm("댓글을 삭제할까요?")) return;
    const id = delC.getAttribute("data-delete-comment");
    const postId = delC.getAttribute("data-post");
    const { error } = await supabase.from("em_board_comments").delete().eq("id", id);
    if (error) return EM.toast("삭제 실패: " + error.message, "err");
    loadComments(postId);
    const p = __posts.find((x) => x.id === postId);
    if (p) { p.comment_count = Math.max(0, (p.comment_count || 0) - 1); }
  });

  // ---------- init ----------
  (async () => {
    await refreshMe();
    await loadPosts();
  })();
})();
