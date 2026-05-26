// =========================================================
// Edu-match Landing — app logic (monetization + legacy rich features)
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { console.error("Supabase client missing"); return; }
  const supabase = EM.client;

  const qs  = (s, r) => (r || document).querySelector(s);
  const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const escape = (v) => v == null ? "" : String(v)
    .replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const KRW = (n) => n && Number(n) > 0 ? Number(n).toLocaleString("ko-KR") + "원" : "협의";

  const CATEGORIES = [
    { key:"corporate-lecture", label:"기업출강 워크샵", icon:"🏢", desc:"임직원 대상 전문 강사 출강" },
    { key:"teambuilding",      label:"팀빌딩 프로그램", icon:"🤝", desc:"조직 결속·협업 강화" },
    { key:"craft-experience",  label:"공방체험",       icon:"🎨", desc:"도예·가죽·플라워 오감 클래스" },
    { key:"diy-kit",           label:"DIY키트",        icon:"📦", desc:"재택·원격 체험 패키지" },
    { key:"it-ai",             label:"IT · AI 교육",   icon:"💻", desc:"ChatGPT·데이터·클라우드" },
    { key:"leadership",        label:"리더십 · 조직",  icon:"👥", desc:"팀장·관리자 리더십" },
    { key:"design",            label:"디자인 · UX",    icon:"🎯", desc:"Figma·서비스 기획" },
    { key:"data",              label:"데이터 분석",    icon:"📊", desc:"SQL·태블로·A/B 테스트" },
  ];
  const catLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key || "";

  // ---------- Tiny markdown (images + YouTube embed supported) ----------
  function md(raw) {
    if (!raw) return "";
    // 1) 원본 보존하여 임베드 요소를 먼저 토큰으로 치환
    let t = String(raw);
    const tokens = [];
    function pushToken(html) {
      const k = `@@TOKEN_${tokens.length}@@`;
      tokens.push(html);
      return k;
    }

    // YouTube 임베드: [[youtube:VIDEO_ID]]
    t = t.replace(/\[\[youtube:([a-zA-Z0-9_-]{11})\]\]/g, (_, id) =>
      pushToken(`<div class="aspect-video my-3 rounded-xl overflow-hidden border border-slate-100"><iframe src="https://www.youtube.com/embed/${id}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`)
    );

    // raw YouTube URL (한 줄에 단독일 때) 자동 임베드
    t = t.replace(/^(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:[^\s]*&)?v=[a-zA-Z0-9_-]{11}[^\s]*|youtu\.be\/[a-zA-Z0-9_-]{11}[^\s]*))$/gm, (url) => {
      const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return m ? pushToken(`<div class="aspect-video my-3 rounded-xl overflow-hidden border border-slate-100"><iframe src="https://www.youtube.com/embed/${m[1]}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`) : url;
    });

    // 이미지: ![alt](https://...) - URL 도 escape 하여 attribute 탈출 차단
    t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, url) =>
      pushToken(`<figure class="my-3"><img src="${escape(url)}" alt="${escape(alt)}" class="rounded-xl w-full max-h-96 object-cover border border-slate-100" loading="lazy" referrerpolicy="no-referrer"/>${alt ? `<figcaption class="mt-1 text-xs text-slate-500">${escape(alt)}</figcaption>` : ""}</figure>`)
    );

    // 2) 나머지 텍스트는 escape 후 마크다운 치환
    t = escape(t);
    // 토큰 복원 (escape 는 @@ 건드리지 않으므로 안전)
    t = t.replace(/@@TOKEN_(\d+)@@/g, (_, i) => tokens[Number(i)] || "");

    // 굵게
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // 링크 [text](url)
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand-600 hover:underline">$1</a>');
    // 제목
    t = t.replace(/^#{3}\s+(.+)$/gm, '<h4 class="mt-3 font-semibold">$1</h4>');
    t = t.replace(/^#{2}\s+(.+)$/gm, '<h3 class="mt-4 text-lg font-bold">$1</h3>');
    t = t.replace(/^#\s+(.+)$/gm,    '<h2 class="mt-4 text-xl font-extrabold">$1</h2>');
    // 리스트
    t = t.replace(/^(?:-\s+.+(?:\n|$))+?/gm, (block) => {
      const items = block.trim().split("\n").map((l) => l.replace(/^-\s+/, "")).map((l) => `<li>${l}</li>`).join("");
      return `<ul class="list-disc ml-5 my-2 space-y-1">${items}</ul>`;
    });
    // 줄바꿈
    t = t.replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>");
    return t;
  }

  // ---------- Modal helpers ----------
  function openModal(id) { const m = qs("#" + id); if (!m) return; m.classList.remove("hidden"); m.classList.add("flex"); }
  function closeModal(el) { el.classList.add("hidden"); el.classList.remove("flex"); }
  qsa('[id^="modal-"]').forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModal(m); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") qsa('[id^="modal-"]:not(.hidden)').forEach(closeModal);
  });

  // ---------- KPIs ----------
  async function loadKpis() {
    try {
      const [lec, pro, jobs, share] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "lecturer"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("membership", "pro"),
        supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("job_postings").select("id", { count: "exact", head: true }).gt("revenue_share_percent", 0),
      ]);
      qs("#kpi-lecturers").textContent = lec.count ?? 0;
      qs("#kpi-pros").textContent = pro.count ?? 0;
      qs("#kpi-jobs").textContent = jobs.count ?? 0;
      qs("#kpi-share").textContent = share.count ?? 0;
    } catch (err) { console.warn(err); }
  }

  // --- 플랫폼 수수료 계산 (5% 또는 platform_fee_percent) ---
  function feeLineFor(j) {
    const amount = j.matched_amount || j.budget_amount || j.budget || 0;
    const pct = Number(j.platform_fee_percent) || 5;
    const fee = j.platform_fee_amount != null
      ? Number(j.platform_fee_amount)
      : Math.floor(Number(amount) * pct / 100);
    return { amount: Number(amount), pct, fee, payout: Math.max(0, Number(amount) - fee) };
  }

  // ---------- Categories ----------
  function renderCategories() {
    qs("#cat-grid").innerHTML = CATEGORIES.map((c) => `
      <button class="text-left p-5 rounded-2xl bg-white border border-slate-100 hover:border-brand-200 hover:shadow-md transition" data-cat="${c.key}">
        <div class="text-2xl">${c.icon}</div>
        <div class="mt-2 font-bold">${c.label}</div>
        <div class="mt-1 text-xs text-slate-500">${c.desc}</div>
      </button>
    `).join("");
  }

  document.body.addEventListener("click", (e) => {
    const catBtn = e.target.closest("[data-cat]");
    if (!catBtn) return;
    qs("#jf-category").value = catBtn.getAttribute("data-cat");
    applyFilters();
    qs("#jobs").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Jobs ----------
  let __jobs = [];
  let __bookmarks = new Set();

  function ddayLabel(deadline) {
    if (!deadline) return null;
    const d = new Date(deadline + "T23:59:59");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - today) / 86400000);
    if (diff < 0) return { text: "마감", cls: "bg-slate-200 text-slate-600" };
    if (diff === 0) return { text: "오늘 마감", cls: "bg-red-100 text-red-700" };
    if (diff <= 3) return { text: `D-${diff}`, cls: "bg-red-50 text-red-700 border border-red-200" };
    if (diff <= 7) return { text: `D-${diff}`, cls: "bg-amber-50 text-amber-700 border border-amber-200" };
    return { text: `D-${diff}`, cls: "bg-slate-50 text-slate-600 border border-slate-200" };
  }

  async function loadBookmarks() {
    const prof = await EM.getCurrentProfile();
    if (!prof?.id) return;
    const { data } = await supabase.from("em_job_bookmarks").select("job_id").eq("user_id", prof.id);
    __bookmarks = new Set((data || []).map((b) => b.job_id));
  }

  async function loadJobs() {
    try {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("status", "open")
        .eq("match_status", "open")  // 매칭 완료 공고는 공개 그리드에서 항상 제외
        .order("is_premium", { ascending: false })
        .order("is_urgent", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      __jobs = data || [];
      await loadBookmarks();
      await loadMyCities();
      applyFilters();
    } catch (err) {
      qs("#jobs-grid").innerHTML = `<div class="col-span-full text-sm text-red-600">오류: ${escape(err.message)}</div>`;
    }
  }

  function computeTotals(j) {
    const sc = Number(j.session_count) || 0;
    const sh = Number(j.session_hours_each) || 0;
    const rate = Number(j.hourly_rate) || 0;
    const totalHours = sc * sh;
    const totalPay = rate * totalHours * (Number(j.headcount) || 1);
    return { sc, sh, rate, totalHours, totalPay };
  }
  function regionLabel(j) {
    const bits = [j.city, j.district].filter(Boolean);
    const main = bits.join(" ");
    return j.venue ? (main ? `${main} · ${j.venue}` : j.venue) : main;
  }
  function deadlineFull(j) {
    if (!j.deadline) return "";
    try {
      const d = new Date(j.deadline + "T" + (j.deadline_time || "23:59"));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `마감 ${yyyy}.${mm}.${dd}. ${hh}:${mi}`;
    } catch { return ""; }
  }
  async function matchesMyArea(j) {
    if (!j.city) return false;
    const prof = await EM.getCurrentProfile();
    if (!prof?.id) return false;
    const cities = Array.isArray(prof.active_cities) ? prof.active_cities : [];
    if (cities.length === 0 && prof.location) cities.push(prof.location);
    return cities.some((c) => c && (c.includes(j.city) || j.city.includes(c)));
  }
  // 한 번 계산해서 캐싱 (렌더에서 동기 조회용)
  let __myCities = [];
  async function loadMyCities() {
    const prof = await EM.getCurrentProfile();
    if (!prof?.id) { __myCities = []; return; }
    const list = Array.isArray(prof.active_cities) ? prof.active_cities.slice() : [];
    if (list.length === 0 && prof.location) list.push(prof.location);
    __myCities = list.filter(Boolean);
  }
  function isMyArea(j) {
    if (!j.city || !__myCities.length) return false;
    return __myCities.some((c) => c && (c.includes(j.city) || j.city.includes(c)));
  }

  function applyFilters() {
    const q = (qs("#jf-q").value || "").trim().toLowerCase();
    const cat = qs("#jf-category").value;
    const fmt = qs("#jf-format").value;
    const urg = qs("#jf-urgent").checked;
    const shr = qs("#jf-share").checked;
    const myArea = qs("#jf-myarea")?.checked;
    const sort = qs("#jf-sort").value;

    let list = __jobs.slice();
    if (q)   list = list.filter((j) => [j.title, j.organization, j.description, j.body_content, (j.tags||[]).join(" ")].filter(Boolean).join(" ").toLowerCase().includes(q));
    if (cat) list = list.filter((j) => j.category === cat);
    if (fmt) list = list.filter((j) => j.format === fmt);
    if (urg) list = list.filter((j) => j.is_urgent);
    if (shr) list = list.filter((j) => Number(j.revenue_share_percent) > 0);
    if (myArea) list = list.filter((j) => isMyArea(j));

    if (sort === "recent") list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === "premium") list.sort((a,b) => Number(b.is_premium) - Number(a.is_premium) || new Date(b.created_at) - new Date(a.created_at));
    else if (sort === "budget-high") list.sort((a,b) => (b.budget_amount || b.budget || 0) - (a.budget_amount || a.budget || 0));
    else if (sort === "budget-low")  list.sort((a,b) => (a.budget_amount || a.budget || 0) - (b.budget_amount || b.budget || 0));

    qs("#jf-count").textContent = `총 ${__jobs.length}건 중 ${list.length}건 표시`;
    renderJobs(list);
  }

  function budgetLabel(j) {
    if (j.budget_type === "per_hour" && j.budget_amount) return `시간당 ${KRW(j.budget_amount)}`;
    if (j.budget_type === "per_course" && j.budget_amount) return `과정당 ${KRW(j.budget_amount)}`;
    if (j.budget_type === "negotiable") return "예산 협의";
    return j.budget_amount ? KRW(j.budget_amount) : (j.budget ? KRW(j.budget) : "협의");
  }

  function renderJobs(list) {
    const grid = qs("#jobs-grid");
    if (!list.length) {
      const filterActive = !!(qs("#jf-q").value.trim() || qs("#jf-category").value || qs("#jf-format").value || qs("#jf-urgent").checked || qs("#jf-share").checked);
      if (filterActive) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-16">
            <div class="text-4xl">🔎</div>
            <p class="mt-3 text-sm text-slate-500">조건에 맞는 공고가 없습니다.</p>
            <button type="button" id="jf-reset-empty" class="mt-3 inline-flex items-center px-4 py-2 text-sm font-semibold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100">필터 초기화</button>
          </div>`;
        qs("#jf-reset-empty")?.addEventListener("click", () => qs("#jf-reset").click());
      } else {
        grid.innerHTML = `
          <div class="col-span-full">
            <div class="rounded-3xl border border-slate-200 bg-gradient-to-br from-brand-50 to-cyan-50 p-10 md:p-14 text-center">
              <div class="text-5xl">📝</div>
              <h3 class="mt-4 text-2xl font-extrabold">아직 등록된 공고가 없습니다</h3>
              <p class="mt-2 text-slate-600">첫 번째 강의 공고를 등록하고 Edu-match 강사진의 지원을 받아보세요.<br/>등록 후 즉시 강사들에게 공개됩니다.</p>
              <div class="mt-6 flex flex-wrap justify-center gap-3">
                <a href="./register-lecture.html" class="inline-flex items-center px-6 py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 shadow-sm">
                  지금 바로 등록하기 →
                </a>
                <a href="./pbl-request.html" class="inline-flex items-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:border-brand-300">
                  PBL 문서 의뢰
                </a>
                <a href="./slide-request.html" class="inline-flex items-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:border-brand-300">
                  슬라이드 의뢰
                </a>
              </div>
              <p class="mt-4 text-xs text-slate-500">🧪 베타 운영 중 · 공고 등록 · 매칭 기능만 제공</p>
            </div>
          </div>`;
      }
      return;
    }
    grid.innerHTML = list.map((j) => {
      const imgs = Array.isArray(j.body_images) ? j.body_images : [];
      const premium = j.is_premium
        ? '<span class="chip bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900">⭐ PREMIUM</span>' : '';
      const matched = j.match_status === 'matched';
      const urgent = matched
        ? '<span class="chip bg-slate-100 text-slate-700">✓ 매칭 완료</span>'
        : (j.is_urgent
            ? '<span class="chip bg-red-100 text-red-700">긴급</span>'
            : '<span class="chip bg-emerald-50 text-emerald-700">모집 중</span>');
      const dd = ddayLabel(j.deadline);
      const ddayChip = dd ? `<span class="chip ${dd.cls}">⏰ ${dd.text}</span>` : '';
      const isBookmarked = __bookmarks.has(j.id);
      const bookmarkBtn = `<button type="button" data-bookmark-id="${escape(j.id)}" class="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition ${isBookmarked ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white/80 text-slate-400 hover:text-red-500 hover:bg-red-50'} border border-slate-200 shadow-sm" title="${isBookmarked ? '북마크 해제' : '북마크'}" aria-label="bookmark">${isBookmarked ? '♥' : '♡'}</button>`;
      const share  = Number(j.revenue_share_percent) > 0
        ? `<span class="chip bg-yellow-50 text-yellow-800 border border-yellow-200" title="품앗이 쉐어">🤝 품앗이 ${j.revenue_share_percent}%${j.posted_by_name ? ` · ${escape(j.posted_by_name)}` : ""}</span>` : "";
      const travel = j.travel_fee_region
        ? `<span class="chip bg-cyan-50 text-cyan-800 border border-cyan-200" title="출장비">✈ ${escape(j.travel_fee_region)} · ${escape(KRW(j.travel_fee_amount))}</span>` : "";
      const budget = `<span class="chip bg-emerald-50 text-emerald-800 border border-emerald-200">💰 ${escape(budgetLabel(j))}</span>`;
      const feePct = Number(j.platform_fee_percent) || 5;
      const feeChip = `<span class="chip bg-indigo-50 text-indigo-800 border border-indigo-200" title="공고 매칭 성사 시 플랫폼 알선 수수료">📌 알선 수수료 ${feePct}%</span>`;
      const hero = imgs[0]?.url
        ? `<div class="aspect-[16/9] w-full -mt-6 -mx-6 mb-4 overflow-hidden rounded-t-2xl"><img src="${escape(imgs[0].url)}" class="w-full h-full object-cover" referrerpolicy="no-referrer" loading="lazy"/></div>` : "";
      return `
        <article class="relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col">
          ${hero}
          ${bookmarkBtn}
          <div class="flex items-start justify-between gap-2 pr-12">
            <span class="text-xs font-semibold text-brand-600">${escape(catLabel(j.category))}</span>
            <div class="flex gap-1 flex-wrap justify-end">${premium}${urgent}${ddayChip}</div>
          </div>
          <div class="mt-1 text-xs text-slate-500 flex items-center justify-between gap-2">
            <span class="truncate">${escape(j.organization || "기관 미지정")}</span>
            ${j.posted_by_email ? `<a href="mailto:${escape(j.posted_by_email)}" onclick="event.stopPropagation()" class="text-brand-600 hover:underline text-[11px] whitespace-nowrap">✉ 연락</a>` : ""}
          </div>
          <!-- ppleedu 스타일 메타 태그 행 -->
          <div class="mt-2 flex items-center gap-1 flex-wrap text-[11px] font-semibold">
            ${isMyArea(j) ? '<span class="chip bg-brand-100 text-brand-700 border border-brand-200">📍 내 활동지역</span>' : ''}
            ${j.subject_tag ? `<span class="chip bg-violet-50 text-violet-700 border border-violet-200">${escape(j.subject_tag)}</span>` : ''}
            ${j.target_grade ? `<span class="chip bg-slate-100 text-slate-700">${escape(j.target_grade)}</span>` : ''}
          </div>
          <h3 class="mt-2 font-bold text-lg leading-snug line-clamp-2">${escape(j.title)}</h3>
          ${regionLabel(j) ? `<div class="mt-1 text-xs text-slate-600">📍 ${escape(regionLabel(j))}</div>` : ''}
          ${(() => {
            const T = computeTotals(j);
            const sched = j.period || (T.sc ? `총 ${T.sc}회` : '');
            const wd = (j.weekdays || []).length ? ` · 매주 ${(j.weekdays || []).join('·')}` : '';
            const time = (j.time_start && j.time_end) ? ` · ${j.time_start}–${j.time_end}` : '';
            return sched ? `<div class="mt-1 text-xs text-slate-600">🗓 ${escape(sched)}${escape(wd)}${escape(time)}</div>` : '';
          })()}
          <div class="mt-2 flex flex-wrap gap-1.5">${budget}${feeChip}${share}${travel}</div>
          ${(() => {
            const T = computeTotals(j);
            if (!T.totalHours || !T.totalPay) return '';
            return `<div class="mt-2 text-xs px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900">
              ${T.rate ? `주 시급 <strong>${T.rate.toLocaleString('ko-KR')}원</strong>${j.headcount > 1 ? ` × ${j.headcount}명` : ''} · ` : ''}
              합산 <strong>${T.totalHours.toFixed(1)}h</strong> · 주강사 총 <strong>${T.totalPay.toLocaleString('ko-KR')}원</strong>
            </div>`;
          })()}
          <p class="mt-3 text-sm text-slate-600 line-clamp-3">${escape(j.description || "")}</p>
          ${deadlineFull(j) ? `<div class="mt-2 text-[11px] text-slate-500">⏱ ${escape(deadlineFull(j))}</div>` : ''}
          <div class="mt-auto pt-4 flex gap-2">
            <button data-detail-id="${escape(j.id)}" class="flex-1 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition">자세히 보기</button>
            <button data-apply-id="${escape(j.id)}" data-apply-title="${escape(j.title)}" class="flex-1 px-3 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition">지원하기 →</button>
          </div>
        </article>`;
    }).join("");
  }

  // Filter bindings
  ["jf-q","jf-category","jf-format","jf-urgent","jf-share","jf-myarea","jf-sort"].forEach((id) => {
    const el = qs("#" + id);
    if (!el) return;
    const ev = el.tagName === "INPUT" && el.type === "search" ? "input" : "change";
    el.addEventListener(ev, applyFilters);
  });
  qs("#jf-reset").addEventListener("click", () => {
    qs("#jf-q").value = ""; qs("#jf-category").value = "";
    qs("#jf-format").value = ""; qs("#jf-urgent").checked = false;
    qs("#jf-share").checked = false;
    const ma = qs("#jf-myarea"); if (ma) ma.checked = false;
    qs("#jf-sort").value = "recent";
    applyFilters();
  });

  // Detail modal
  document.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-detail-id]");
    if (!b) return;
    const job = __jobs.find((j) => j.id === b.getAttribute("data-detail-id"));
    if (!job) return;
    const imgs = Array.isArray(job.body_images) ? job.body_images : [];
    const hero = imgs[0]?.url
      ? `<img src="${escape(imgs[0].url)}" class="w-full max-h-80 object-cover rounded-xl" referrerpolicy="no-referrer"/>`
      : "";
    const premiumLine = job.is_premium ? `<span class="chip bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900">⭐ PREMIUM</span>` : "";
    const urgentLine  = job.is_urgent ? `<span class="chip bg-red-100 text-red-700">긴급</span>` : "";
    const shareLine   = Number(job.revenue_share_percent) > 0
      ? `<span class="chip bg-yellow-50 text-yellow-800 border border-yellow-200">🤝 품앗이 ${job.revenue_share_percent}% · ${escape(job.posted_by_name || "-")}</span>` : "";
    const travelLine  = job.travel_fee_region
      ? `<span class="chip bg-cyan-50 text-cyan-800 border border-cyan-200">✈ ${escape(job.travel_fee_region)} · ${escape(KRW(job.travel_fee_amount))}</span>` : "";
    const tags = (job.tags || []).map((t) => `<span class="chip bg-slate-100 text-slate-700">#${escape(t)}</span>`).join(" ");

    qs("#detail-body").innerHTML = `
      ${hero}
      <div class="mt-4 text-xs text-slate-500">${escape(job.organization || "—")}</div>
      <h2 class="mt-1 text-2xl font-extrabold leading-snug">${escape(job.title)}</h2>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <span class="chip bg-brand-50 text-brand-700">${escape(catLabel(job.category))}</span>
        <span class="chip bg-emerald-50 text-emerald-800 border border-emerald-200">💰 ${escape(budgetLabel(job))}</span>
        ${premiumLine}${urgentLine}${shareLine}${travelLine}
      </div>

      <div class="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><div class="text-xs text-slate-500">기간</div><div class="font-semibold">${escape(job.period || "협의")}</div></div>
        <div><div class="text-xs text-slate-500">형태</div><div class="font-semibold">${escape(job.format || "offline")}</div></div>
        <div><div class="text-xs text-slate-500">대상</div><div class="font-semibold">${escape(job.target_audience || "—")}</div></div>
        <div><div class="text-xs text-slate-500">출장비</div><div class="font-semibold">${escape(job.travel_fee_region || "미선택")} · ${escape(KRW(job.travel_fee_amount))}</div></div>
      </div>

      ${(job.posted_by_email || job.posted_by_phone || job.posted_by_name) ? `
      <div class="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
        <div class="font-bold text-slate-900">📇 공고 등록자 연락처</div>
        <div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          ${job.posted_by_name  ? `<div><div class="text-xs text-slate-500">담당자</div><div class="font-semibold">${escape(job.posted_by_name)}</div></div>` : ""}
          ${job.posted_by_email ? `<div><div class="text-xs text-slate-500">이메일</div><a href="mailto:${escape(job.posted_by_email)}" class="font-semibold text-brand-600 hover:underline break-all">${escape(job.posted_by_email)}</a></div>` : ""}
          ${job.posted_by_phone ? `<div><div class="text-xs text-slate-500">연락처</div><a href="tel:${escape(job.posted_by_phone)}" class="font-semibold text-brand-600 hover:underline">${escape(job.posted_by_phone)}</a></div>` : ""}
        </div>
        <p class="mt-2 text-xs text-slate-500">베타 운영 중에는 등록자에게 직접 연락하여 협의 진행해주세요.</p>
      </div>` : ""}

      ${(() => {
        const f = feeLineFor(job);
        const betaNote = `
          <div class="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            <span class="text-xs font-bold">🧪 BETA</span>
            <p class="text-xs leading-relaxed">베타 운영 중에는 <strong>개인간 협의하여 진행</strong>하시면 됩니다. (수수료 자동 정산은 정식 오픈 시 활성화)</p>
          </div>`;
        if (!f.amount) {
          return `
          <div class="mt-5 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-sm">
            <div class="flex items-center gap-2 font-bold text-indigo-900">📌 공고 알선 수수료 정책</div>
            <p class="mt-1 text-slate-700">공고가 성사되면 <strong>게시 금액의 ${f.pct}%</strong> 가 Edu-match 플랫폼 알선 수수료로 차감됩니다. 게시 금액이 '협의' 인 경우 매칭 확정 후 계산합니다.</p>
            ${betaNote}
          </div>`;
        }
        return `
          <div class="mt-5 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-sm">
            <div class="flex items-center gap-2 font-bold text-indigo-900">📌 공고 알선 수수료 정책</div>
            <div class="mt-2 grid grid-cols-3 gap-3">
              <div><div class="text-xs text-slate-500">게시 금액</div><div class="font-bold">${escape(KRW(f.amount))}</div></div>
              <div><div class="text-xs text-slate-500">플랫폼 수수료 (${f.pct}%)</div><div class="font-bold text-indigo-700">− ${escape(KRW(f.fee))}</div></div>
              <div><div class="text-xs text-slate-500">실 지급 예상</div><div class="font-bold text-emerald-700">${escape(KRW(f.payout))}</div></div>
            </div>
            ${job.match_status === 'matched' ? `<p class="mt-2 text-xs text-slate-600">✓ 매칭 완료 · ${new Date(job.matched_at).toLocaleDateString("ko-KR")} 정산 반영</p>` : `<p class="mt-2 text-xs text-slate-500">공고 매칭이 확정되는 시점에 자동 정산됩니다.</p>`}
            ${betaNote}
          </div>`;
      })()}

      <div class="mt-6">
        <h3 class="font-bold">개요</h3>
        <p class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">${escape(job.description || "")}</p>
      </div>

      ${job.body_content ? `<div class="mt-6"><h3 class="font-bold">본문</h3><div class="mt-2 text-sm text-slate-700 leading-relaxed">${md(job.body_content)}</div></div>` : ""}

      ${imgs.length > 0 ? `<div class="mt-6"><h3 class="font-bold">첨부 이미지 (${imgs.length}장)</h3>
        <div class="mt-2 grid grid-cols-3 gap-2">${imgs.map((m) => `<a href="${escape(m.url)}" target="_blank" rel="noopener" class="aspect-[4/3] block rounded-lg overflow-hidden border border-slate-100"><img src="${escape(m.url)}" class="w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer"/></a>`).join("")}</div></div>` : ""}

      ${tags ? `<div class="mt-6"><h3 class="font-bold">태그</h3><div class="mt-2">${tags}</div></div>` : ""}

      <div class="mt-8 text-xs text-slate-500">
        단가 참고: <a href="https://www.hrd.go.kr" target="_blank" rel="noopener" class="text-brand-600 hover:underline">고용노동부 HRD-Net →</a>
        · <a href="https://www.law.go.kr/LSW/admRulSc.do?menuId=1&subMenuId=15&query=%EC%A7%81%EC%97%85%EB%8A%A5%EB%A0%A5%EA%B0%9C%EB%B0%9C%ED%9B%88%EB%A0%A8+%EC%8B%A4%EC%8B%9C%EA%B8%B0%EC%A4%80" target="_blank" rel="noopener" class="text-brand-600 hover:underline">국가법령정보센터 「직업능력개발훈련 실시기준」 →</a>
      </div>

      <div class="mt-6 flex gap-2">
        <button data-apply-id="${escape(job.id)}" data-apply-title="${escape(job.title)}" class="flex-1 px-4 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700">지원하기 →</button>
        <button type="button" data-close class="px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">닫기</button>
      </div>
    `;
    openModal("modal-detail");
  });

  // Bookmark toggle
  document.body.addEventListener("click", async (e) => {
    const bm = e.target.closest("[data-bookmark-id]");
    if (!bm) return;
    e.preventDefault(); e.stopPropagation();
    const prof = await EM.getCurrentProfile();
    if (!prof?.id) {
      EM.toast("로그인 후 북마크할 수 있습니다.", "warn");
      openModal("modal-auth"); syncAuthMode();
      return;
    }
    const jobId = bm.getAttribute("data-bookmark-id");
    const has = __bookmarks.has(jobId);
    try {
      if (has) {
        const { error } = await supabase.from("em_job_bookmarks").delete()
          .eq("user_id", prof.id).eq("job_id", jobId);
        if (error) throw error;
        __bookmarks.delete(jobId);
        EM.toast("북마크가 해제되었습니다.", "ok");
      } else {
        const { error } = await supabase.from("em_job_bookmarks").insert({ user_id: prof.id, job_id: jobId });
        if (error) throw error;
        __bookmarks.add(jobId);
        EM.toast("♥ 북마크에 추가되었습니다.", "ok");
      }
      applyFilters();
    } catch (err) {
      EM.toast("북마크 실패: " + err.message, "err");
    }
  });

  // Apply
  document.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-apply-id]");
    if (!b) return;
    // 상세 모달 안에서 클릭한 경우 상세 모달 먼저 닫기
    closeModal(qs("#modal-detail"));
    qs("#apply-job-id").value = b.getAttribute("data-apply-id");
    qs("#apply-job-title").textContent = "대상 공고: " + b.getAttribute("data-apply-title");
    openModal("modal-apply");
  });

  qs("#apply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const job_id = qs("#apply-job-id").value;
    const applicant_name = String(fd.get("applicant_name") || "").trim();
    const applicant_email = String(fd.get("applicant_email") || "").trim();
    const proposal = String(fd.get("proposal") || "").trim();
    const file = fd.get("resume");
    if (!fd.get("consent")) return EM.toast("개인정보 동의가 필요합니다.", "warn");
    if (applicant_name.length < 2) return EM.toast("강사 성함을 입력해주세요.", "warn");
    if (!/.+@.+\..+/.test(applicant_email)) return EM.toast("이메일을 확인해주세요.", "warn");
    if (proposal.length < 10) return EM.toast("제안서를 10자 이상 작성해주세요.", "warn");

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "제출 중…";
    try {
      let resume_url = null;
      if (file && file.size > 0) {
        if (file.size > 10 * 1024 * 1024) throw new Error("이력서는 10MB 이하여야 합니다.");
        resume_url = await EM.uploadResume(file, applicant_email);
      }
      const { error } = await supabase.from("applications").insert({
        job_id, applicant_name, applicant_email, resume_url, proposal, status: "pending",
      });
      if (error) throw error;
      EM.toast("지원서가 접수되었습니다.", "ok");
      form.reset();
      closeModal(qs("#modal-apply"));
    } catch (err) {
      EM.toast("제출 실패: " + err.message, "err");
    } finally {
      btn.disabled = false; btn.textContent = "지원서 제출";
    }
  });

  // ---------- Matching modal (공통 + 강사 타겟) ----------
  qs("#btn-open-match")?.addEventListener("click",   () => { qs("#match-target-instructor").value = ""; qs("#match-title").textContent = "매칭 문의"; qs("#match-context").textContent = "강의 주제·규모·예산을 알려주시면 매니저가 회신드립니다."; openModal("modal-match"); });
  qs("#btn-open-match-2")?.addEventListener("click", () => { qs("#match-target-instructor").value = ""; qs("#match-title").textContent = "매칭 문의"; qs("#match-context").textContent = "강의 주제·규모·예산을 알려주시면 매니저가 회신드립니다."; openModal("modal-match"); });

  qs("#match-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const target = qs("#match-target-instructor").value; // profile.id or empty
    const payload = {
      client_name: String(fd.get("client_name") || "").trim(),
      company: String(fd.get("company") || "").trim(),
      category: String(fd.get("category") || "").trim(),
      budget: Number(fd.get("budget")) || null,
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      status: "pending",
      consent_agreed: fd.get("consent") === "on",
    };
    if (!payload.consent_agreed) return EM.toast("개인정보 동의가 필요합니다.", "warn");
    if (payload.client_name.length < 2) return EM.toast("담당자 성함을 입력해주세요.", "warn");
    if (!/.+@.+\..+/.test(payload.email)) return EM.toast("이메일을 확인해주세요.", "warn");
    if (payload.message.length < 10) return EM.toast("요청 내용을 10자 이상 작성해주세요.", "warn");

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "제출 중…";
    try {
      const { error } = await supabase.from("matching_requests").insert(payload);
      if (error) throw error;

      // 강사 타겟팅된 경우 해당 강사 이메일로 mailto 연결
      if (target) {
        const ins = __instructors.find((i) => i.id === target);
        if (ins?.contact_email || ins?.email) {
          const addr = ins.contact_email || ins.email;
          const subject = `[Edu-match] ${payload.category} 매칭 문의`;
          const body =
            `안녕하세요 ${ins.full_name || ins.email} 강사님,\n\n` +
            `• 담당자: ${payload.client_name}${payload.company ? ` (${payload.company})` : ""}\n` +
            `• 회신 이메일: ${payload.email}\n` +
            `• 연락처: ${payload.phone || "-"}\n` +
            `• 분야: ${payload.category}\n` +
            `• 예산: ${payload.budget ? KRW(payload.budget) : "협의"}\n\n` +
            payload.message;
          window.location.href = `mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      }

      EM.toast("매칭 문의가 접수되었습니다.", "ok");
      form.reset();
      closeModal(qs("#modal-match"));
      loadKpis();
    } catch (err) {
      EM.toast("제출 실패: " + err.message, "err");
    } finally {
      btn.disabled = false; btn.textContent = "문의 제출";
    }
  });

  // ---------- Instructors (Peer Network) ----------
  let __instructors = [];
  async function loadInstructors() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "lecturer")
        .eq("is_approved", true)
        .order("is_featured", { ascending: false })
        .order("rating", { ascending: false })
        .limit(9);
      if (error) throw error;
      __instructors = data || [];
      renderInstructors();
    } catch (err) {
      qs("#ins-grid").innerHTML = `<div class="col-span-full text-sm text-red-600">강사 목록 오류: ${escape(err.message)}</div>`;
    }
  }

  function renderInstructors() {
    const grid = qs("#ins-grid");
    if (!__instructors.length) {
      grid.innerHTML = `
        <div class="col-span-full">
          <div class="rounded-3xl border border-slate-200 bg-gradient-to-br from-brand-50 to-cyan-50 p-10 md:p-14 text-center">
            <div class="text-5xl">🎓</div>
            <h3 class="mt-4 text-2xl font-extrabold">아직 등록된 강사가 없습니다</h3>
            <p class="mt-2 text-slate-600">Edu-match 의 첫 번째 강사가 되어주세요. 가입 후 관리자 승인이 완료되면<br/>강사진 섹션에 프로필이 노출되고 공고 매칭에 우선 추천됩니다.</p>
            <div class="mt-6 flex flex-wrap justify-center gap-3">
              <a href="./signup.html" class="inline-flex items-center px-6 py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 shadow-sm">
                첫번째 강사 등록하기 →
              </a>
              <a href="./materials.html" class="inline-flex items-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:border-brand-300">
                강사 자료실
              </a>
              <a href="#jobs" class="inline-flex items-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:border-brand-300">
                공고 둘러보기
              </a>
            </div>
            <p class="mt-4 text-xs text-slate-500">🧪 베타 운영 중 · 강사 가입 무료 · 수수료 무료</p>
          </div>
        </div>`;
      return;
    }
    grid.innerHTML = __instructors.map((p) => {
      const pro = p.membership === "pro";
      const tags = (p.expertise || []).slice(0, 4).map((t) => `<span class="chip bg-slate-100 text-slate-700">${escape(t)}</span>`).join(" ");
      const avatar = p.avatar_url
        ? `<img src="${escape(p.avatar_url)}" class="w-14 h-14 rounded-full object-cover border border-slate-200" referrerpolicy="no-referrer"/>`
        : `<div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">${escape((p.full_name || "?").charAt(0))}</div>`;
      return `
        <article class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div class="flex items-start gap-3">
            ${avatar}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h3 class="font-bold truncate">${escape(p.full_name || "—")}</h3>
                ${pro ? '<span class="chip bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900">PRO</span>' : ''}
              </div>
              <p class="text-xs text-slate-500 truncate">${escape(p.title || "")}</p>
              <div class="text-xs text-yellow-600 mt-0.5">★ ${escape(p.rating ?? "—")} <span class="text-slate-400">(리뷰 ${escape(p.review_count ?? 0)})</span></div>
            </div>
          </div>
          <p class="mt-3 text-sm text-slate-600 line-clamp-3">${escape(p.bio || "")}</p>
          <div class="mt-3 flex flex-wrap gap-1.5">${tags}</div>
          <div class="mt-auto pt-4 flex items-center justify-between">
            <span class="text-xs text-slate-500">경력 ${escape(p.experience_years ?? 0)}년</span>
            <div class="flex gap-1.5">
              <button data-ins-detail="${escape(p.id)}" class="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 hover:border-brand-300 hover:text-brand-600">상세정보</button>
              <button data-ins-inquiry="${escape(p.id)}" class="px-3 py-1.5 text-xs font-bold rounded-full text-white bg-brand-600 hover:bg-brand-700">매칭 문의 →</button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  // Instructor buttons
  document.body.addEventListener("click", async (e) => {
    const detail = e.target.closest("[data-ins-detail]");
    const inquiry = e.target.closest("[data-ins-inquiry]");
    if (!detail && !inquiry) return;
    const id = (detail || inquiry).getAttribute(detail ? "data-ins-detail" : "data-ins-inquiry");
    const ins = __instructors.find((p) => p.id === id);
    if (!ins) return;

    if (inquiry) {
      qs("#match-target-instructor").value = id;
      qs("#match-title").textContent = `매칭 문의: ${ins.full_name}`;
      qs("#match-context").textContent = `입력한 내용이 ${ins.contact_email || ins.email} 로 전달됩니다.`;
      openModal("modal-match");
      return;
    }

    // detail
    const { data: posted } = await supabase
      .from("job_postings")
      .select("*")
      .or(`posted_by_instructor_id.eq.${ins.id},posted_by_email.eq.${ins.contact_email || ins.email || "__none__"}`)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    const pro = ins.membership === "pro";
    const tags = (ins.expertise || []).map((t) => `<span class="chip bg-slate-100 text-slate-700">${escape(t)}</span>`).join(" ");

    const postedHtml = (posted && posted.length > 0) ? posted.map((j) => `
      <article class="p-4 rounded-xl bg-slate-50 border border-slate-100">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="text-xs text-slate-500">${escape(j.organization || "—")}</div>
            <h4 class="font-bold mt-0.5">${escape(j.title)}</h4>
          </div>
          ${j.is_urgent ? '<span class="chip bg-red-100 text-red-700">긴급</span>' : '<span class="chip bg-emerald-100 text-emerald-700">모집 중</span>'}
        </div>
        <p class="mt-2 text-sm text-slate-600 line-clamp-2">${escape(j.description || "")}</p>
        <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span class="chip bg-emerald-50 text-emerald-800 border border-emerald-200">💰 ${escape(budgetLabel(j))}</span>
          ${Number(j.revenue_share_percent) > 0 ? `<span class="chip bg-yellow-50 text-yellow-800 border border-yellow-200">🤝 ${j.revenue_share_percent}%</span>` : ""}
          ${j.travel_fee_region ? `<span class="chip bg-cyan-50 text-cyan-800 border border-cyan-200">✈ ${escape(j.travel_fee_region)}</span>` : ""}
        </div>
      </article>`).join("") : `<p class="text-sm text-slate-400 text-center py-6">해당 강사가 등록한 공고가 없습니다.</p>`;

    qs("#ins-body").innerHTML = `
      <div class="flex items-start gap-4">
        ${ins.avatar_url ? `<img src="${escape(ins.avatar_url)}" class="w-20 h-20 rounded-full object-cover border border-slate-200" referrerpolicy="no-referrer"/>` : `<div class="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-2xl">${escape((ins.full_name || "?").charAt(0))}</div>`}
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl font-extrabold">${escape(ins.full_name)}</h2>
            ${pro ? '<span class="chip bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900">PRO</span>' : ''}
          </div>
          <p class="text-sm text-slate-600">${escape(ins.title || "")}</p>
          <p class="text-xs text-yellow-600">★ ${escape(ins.rating ?? "—")} · 리뷰 ${escape(ins.review_count ?? 0)} · 경력 ${escape(ins.experience_years ?? 0)}년</p>
          <p class="text-xs text-slate-500 mt-1">${escape(ins.contact_email || ins.email || "")}</p>
        </div>
      </div>

      <div class="mt-5">
        <h3 class="font-bold">프로필</h3>
        <p class="mt-2 text-sm text-slate-700">${escape(ins.bio || "—")}</p>
      </div>

      ${tags ? `<div class="mt-4"><h3 class="font-bold">전문 키워드</h3><div class="mt-2">${tags}</div></div>` : ""}

      <div class="mt-6">
        <h3 class="font-bold">이 강사가 등록한 공고 (${posted?.length || 0}건)</h3>
        <div class="mt-2 space-y-2">${postedHtml}</div>
      </div>

      <div class="mt-6 flex gap-2">
        <button data-ins-inquiry="${escape(ins.id)}" class="flex-1 px-4 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700">매칭 문의 →</button>
        <button type="button" data-close class="px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">닫기</button>
      </div>
    `;
    openModal("modal-ins");
  });

  // ---------- Auth ----------
  const authBtn = qs("#nav-auth-btn");
  const authForm = qs("#auth-form");
  let authMode = "signin";
  function syncAuthMode() {
    qsa("[data-auth-tab]").forEach((t) => {
      const active = t.getAttribute("data-auth-tab") === authMode;
      t.classList.toggle("bg-white", active);
      t.classList.toggle("shadow-sm", active);
      t.classList.toggle("text-slate-600", !active);
    });
    qsa("[data-auth-only]").forEach((el) => {
      el.classList.toggle("hidden", el.getAttribute("data-auth-only") !== authMode);
    });
    qs("#auth-title").textContent = authMode === "signup" ? "회원가입" : "로그인";
    qs("#auth-submit").textContent = authMode === "signup" ? "회원가입" : "로그인";
  }
  qsa("[data-auth-tab]").forEach((t) => t.addEventListener("click", () => { authMode = t.getAttribute("data-auth-tab"); syncAuthMode(); }));

  let __isLoggedIn = false;
  async function refreshAuthUI() {
    const prof = await EM.getCurrentProfile();
    __isLoggedIn = !!(prof && prof.id);
    if (!__isLoggedIn) { authBtn.textContent = "로그인"; authBtn.title = ""; return; }
    const badge = prof.membership === "pro"
      ? '<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900 text-[10px] font-bold">PRO</span>'
      : "";
    authBtn.innerHTML = `${escape(prof.full_name || prof.email)}${badge}`;
    authBtn.title = "클릭하여 프로필 꾸미기 (Shift+클릭: 로그아웃)";
  }
  authBtn.addEventListener("click", async (e) => {
    if (!__isLoggedIn) {
      openModal("modal-auth"); syncAuthMode();
      return;
    }
    if (e.shiftKey) {
      await EM.signOut(); EM.toast("로그아웃 완료", "ok"); refreshAuthUI(); return;
    }
    // 일반 클릭 → 프로필 꾸미기 페이지
    location.href = "./profile.html";
  });
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(authForm);
    try {
      if (authMode === "signup") {
        const fullName = String(fd.get("full_name") || "").trim();
        const NAME_OK = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s\.\-_'()]{2,40}$/;
        const NAME_BAD = /[�<>{}\[\]\\\/\^\$\*\+=|@#!?]/;
        if (!NAME_OK.test(fullName) || NAME_BAD.test(fullName)) {
          return EM.toast("이름에 특수문자·이모지는 사용할 수 없습니다. (한글·영문·숫자만)", "warn");
        }
        const phone = String(fd.get("phone") || "").replace(/[\s-]/g, "");
        if (!/^01[0-9]\d{7,8}$/.test(phone)) {
          return EM.toast("휴대폰 번호 형식을 확인해주세요. (010-1234-5678)", "warn");
        }
        await EM.signUp({
          email: fd.get("email"),
          password: fd.get("password"),
          fullName,
          role: fd.get("role"),
          phone,
        });
        EM.toast("회원가입 완료. 자동 로그인 되었습니다.", "ok");
      } else {
        await EM.signIn({ email: fd.get("email"), password: fd.get("password") });
        EM.toast("로그인 성공", "ok");
      }
      closeModal(qs("#modal-auth"));
      refreshAuthUI();
    } catch (err) {
      EM.toast("실패: " + err.message, "err");
    }
  });

  // ---------- Pro upgrade (BETA: 결제 미연동 · 호출 시 즉시 안내) ----------
  const BETA_PAID_DISABLED = true;
  qs("#btn-upgrade-pro").addEventListener("click", async () => {
    if (BETA_PAID_DISABLED) {
      EM.toast("결제 · Pro 멤버십은 정식 오픈 시 활성화됩니다. 현재는 공고 등록/매칭만 사용 가능합니다.", "warn");
      return;
    }
    const prof = await EM.getCurrentProfile();
    if (!prof || !prof.id) {
      EM.toast("Pro 구독은 로그인 후 가능합니다.", "warn");
      openModal("modal-auth"); syncAuthMode(); return;
    }
    if (prof.membership === "pro") return EM.toast("이미 Pro 멤버입니다.", "ok");
    if (!confirm("Pro 멤버십을 시작하시겠습니까?\n(데모 환경 — 실제 결제는 이루어지지 않습니다.)")) return;
    try {
      await EM.upgradeToPro();
      EM.toast("Pro 멤버십이 활성화되었습니다.", "ok");
      refreshAuthUI(); loadKpis(); loadInstructors();
    } catch (err) {
      EM.toast("업그레이드 실패: " + err.message, "err");
    }
  });

  // ---------- init ----------
  renderCategories();
  loadKpis();
  loadJobs();
  loadInstructors();
  refreshAuthUI();
})();
