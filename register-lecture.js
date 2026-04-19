// =========================================================
// Edu-match — 의뢰자용 강의 공고 등록 (Tailwind rebuild)
// =========================================================

(function () {
  const EM = window.EM;
  if (!EM?.client) { alert("Supabase 설정이 누락되었습니다."); return; }
  const supabase = EM.client;

  const BUCKET = "em-posting-media";
  const MAX_IMAGES = 6;
  const MAX_SIZE = 8 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);
  const KRW = (n) => n && Number(n) > 0 ? Number(n).toLocaleString("ko-KR") + "원" : "협의";

  const form = $("register-form");
  const msg  = $("reg-msg");
  const shareCheckbox = $("j-share");
  const shareBlock = $("share-block");
  const fileInput = $("j-body-files");
  const gallery = $("j-body-gallery");

  function show(text, type) {
    msg.textContent = text;
    msg.className = "text-sm font-medium text-center " + (type === "ok" ? "text-emerald-600" : type === "warn" ? "text-amber-600" : "text-red-600");
  }

  // --- share toggle
  shareCheckbox.addEventListener("change", () => {
    shareBlock.classList.toggle("hidden", !shareCheckbox.checked);
  });

  // --- budget type toggle + fee preview
  const budgetType = $("j-budget-type");
  const budgetAmount = $("j-budget-amount");
  const feeNumbers = $("fee-numbers");
  const feeAmount = $("fee-amount");
  const feeFee = $("fee-fee");
  const feePayout = $("fee-payout");

  function syncBudget() {
    const isNeg = budgetType.value === "negotiable";
    budgetAmount.disabled = isNeg;
    budgetAmount.classList.toggle("bg-slate-100", isNeg);
    if (isNeg) budgetAmount.value = "";
    renderFee();
  }
  function renderFee() {
    const amount = Number(budgetAmount.value) || 0;
    if (amount <= 0) { feeNumbers.classList.add("hidden"); return; }
    const fee = Math.floor(amount * 5 / 100);
    feeAmount.textContent = KRW(amount);
    feeFee.textContent = "− " + KRW(fee);
    feePayout.textContent = KRW(amount - fee);
    feeNumbers.classList.remove("hidden");
  }
  budgetType.addEventListener("change", syncBudget);
  budgetAmount.addEventListener("input", renderFee);
  syncBudget();

  function validateRequired(fields) {
    for (const [id, label, min] of fields) {
      const el = $(id);
      const v = (el?.value || "").trim();
      if (!v) { el?.focus(); return `${label} 을(를) 입력해주세요.`; }
      if (min && v.length < min) { el?.focus(); return `${label} 은(는) 최소 ${min}자 이상 입력해주세요.`; }
    }
    return null;
  }
  function getTravelFee() {
    const picked = form.querySelector('input[name="travel_fee_region"]:checked');
    if (!picked) return { region: null, amount: 0 };
    return { region: picked.value, amount: Number(picked.dataset.amount) || 0 };
  }

  // --- image upload
  const pendingImages = [];

  function renderGallery() {
    gallery.innerHTML = pendingImages.map((img, idx) => `
      <div class="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        <img src="${img.previewUrl}" class="w-full h-full object-cover" />
        ${img.status === "uploading" ? '<div class="absolute inset-0 flex items-center justify-center text-xs text-white bg-black/50">업로드 중…</div>' : ""}
        ${img.status === "error" ? '<div class="absolute inset-0 flex items-center justify-center text-xs text-white bg-red-600/70">실패</div>' : ""}
        <button type="button" data-remove="${idx}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm flex items-center justify-center">×</button>
      </div>
    `).join("");
  }

  function randomName(file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  }

  async function uploadOne(img) {
    img.status = "uploading";
    renderGallery();
    const path = `jobs/${new Date().toISOString().slice(0, 10)}/${randomName(img.file)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, img.file, {
      cacheControl: "3600", upsert: false, contentType: img.file.type,
    });
    if (error) { img.status = "error"; renderGallery(); return; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    img.path = path;
    img.publicUrl = data.publicUrl;
    img.status = "done";
    renderGallery();
  }

  fileInput.addEventListener("change", () => {
    for (const f of Array.from(fileInput.files || [])) {
      if (pendingImages.length >= MAX_IMAGES) { EM.toast(`이미지는 최대 ${MAX_IMAGES}장까지.`, "warn"); break; }
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_SIZE) { EM.toast(`'${f.name}' 8MB 초과`, "warn"); continue; }
      const img = { file: f, previewUrl: URL.createObjectURL(f), status: "uploading" };
      pendingImages.push(img);
      uploadOne(img);
    }
    fileInput.value = "";
  });

  gallery.addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const idx = Number(b.getAttribute("data-remove"));
    const img = pendingImages[idx];
    if (img?.path) supabase.storage.from(BUCKET).remove([img.path]).catch(() => {});
    pendingImages.splice(idx, 1);
    renderGallery();
  });

  // --- submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const err = validateRequired([
      ["r-org",     "기관명 / 기업명", 2],
      ["r-contact", "담당자 성함",       2],
      ["r-email",   "담당자 이메일",     5],
      ["j-title",   "공고 제목",         4],
      ["j-desc",    "강의 상세 설명",   20],
      ["j-period",  "강의 기간",         2],
      ["j-target",  "수강 대상 · 규모",  2],
    ]);
    if (err) { show(err, "warn"); return; }

    if (pendingImages.some((i) => i.status === "uploading")) {
      show("이미지 업로드 완료를 기다려주세요.", "warn"); return;
    }
    if (pendingImages.some((i) => i.status === "error")) {
      show("업로드 실패한 이미지를 제거 후 재시도.", "warn"); return;
    }

    const btype = budgetType.value;
    const bamount = Number(budgetAmount.value) || 0;
    if (btype !== "negotiable" && bamount <= 0) {
      show("예산 금액을 입력하거나 '협의' 로 설정해주세요.", "warn");
      budgetAmount.focus(); return;
    }

    const contact = $("r-contact").value.trim();
    const email   = $("r-email").value.trim();
    const phone   = $("r-phone").value.trim();
    const isShared = shareCheckbox.checked;
    const shareName  = $("j-share-name").value.trim();
    const shareEmail = $("j-share-email").value.trim();
    if (isShared && (!shareName || !shareEmail)) {
      show("강사 쉐어 공고는 등록자 성함·이메일 필수.", "warn"); return;
    }
    const travel = getTravelFee();

    const descBase = $("j-desc").value.trim();
    const description = [
      descBase,
      "",
      `— 담당자: ${contact} (${email}${phone ? " · " + phone : ""})`,
      isShared ? `— 강사 등록 · 수익 5% 쉐어 → ${shareName} (${shareEmail})` : "",
    ].filter(Boolean).join("\n");

    const budgetDisplay = btype === "negotiable" ? "협의"
      : btype === "per_hour" ? `시간당 ${KRW(bamount)}`
      : `과정당 ${KRW(bamount)}`;

    const payload = {
      title: $("j-title").value.trim(),
      description,
      organization: $("r-org").value.trim(),
      category: $("j-category").value,
      format: $("j-format").value,
      period: $("j-period").value.trim(),
      target_audience: $("j-target").value.trim(),
      budget: bamount || null,
      budget_type: btype,
      budget_amount: btype === "negotiable" ? null : bamount,
      tags: $("j-tags").value.split(",").map((s) => s.trim()).filter(Boolean),
      is_urgent: $("j-urgent").checked,
      status: "open",
      match_status: "open",
      platform_fee_percent: 5,
      source: isShared ? "instructor-shared" : "client-registered",
      revenue_share_percent: isShared ? 5 : 0,
      posted_by_name: isShared ? shareName : null,
      posted_by_email: isShared ? shareEmail : null,
      travel_fee_region: travel.region,
      travel_fee_amount: travel.amount,
      min_price_ref_url: "https://www.hrd.go.kr",
      body_content: $("j-body").value.trim() || null,
      body_images: pendingImages.filter((i) => i.status === "done").map((i) => ({ url: i.publicUrl, path: i.path, name: i.file.name })),
      is_premium: false,
    };

    show("등록 중…", "ok");
    try {
      const { data, error } = await supabase.from("job_postings").insert(payload).select().single();
      if (error) throw error;
      show(`공고 등록 완료 (번호: ${data.id.slice(0, 8)}). 강사 지원이 들어오면 담당자 이메일로 알려드립니다.`, "ok");
      EM.toast("공고가 등록되었습니다.", "ok");
      form.reset();
      shareBlock.classList.add("hidden");
      pendingImages.length = 0;
      renderGallery();
      syncBudget();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      show("등록 실패: " + err.message, "err");
    }
  });
})();
