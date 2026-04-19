// =========================================================
// Edu-match — 의뢰자용 강의 공고 등록 (본문 + 이미지)
// =========================================================

(function () {
  const em = window.EduMatch;
  if (!em?.supabase) {
    alert("Supabase 설정이 누락되었습니다.");
    return;
  }
  const supabase = em.supabase;
  const TABLES = em.TABLES;
  const BUCKET = "em-posting-media";
  const MAX_IMAGES = 6;
  const MAX_SIZE = 8 * 1024 * 1024; // 8MB

  const form = document.getElementById("register-form");
  const msg = document.getElementById("reg-msg");
  const shareCheckbox = document.getElementById("j-share");
  const shareBlock = document.getElementById("share-block");
  const fileInput = document.getElementById("j-body-files");
  const gallery = document.getElementById("j-body-gallery");

  shareCheckbox?.addEventListener("change", () => {
    shareBlock.style.display = shareCheckbox.checked ? "" : "none";
  });

  function show(text, type) {
    msg.textContent = text;
    msg.className = "auth-message is-shown auth-message--" + type;
  }

  function validateRequired(fields) {
    for (const [id, label, min] of fields) {
      const el = document.getElementById(id);
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

  // ----- 이미지 업로드 -----
  // pendingImages: { file, previewUrl, publicUrl?, status, path }
  const pendingImages = [];

  function renderGallery() {
    gallery.innerHTML = pendingImages.map((img, idx) => `
      <div class="tile" data-idx="${idx}">
        <img src="${img.previewUrl}" alt="preview" />
        ${img.status === "uploading" ? '<div class="status">업로드 중…</div>' : ""}
        ${img.status === "error" ? '<div class="status">업로드 실패</div>' : ""}
        <button type="button" class="remove" aria-label="제거" data-idx="${idx}">×</button>
      </div>
    `).join("");
  }

  function randomName(file) {
    const ext = (file.name.split(".").pop() || "img").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
    const r = Math.random().toString(36).slice(2, 10);
    const d = Date.now().toString(36);
    return `${d}-${r}.${ext}`;
  }

  async function uploadOne(img) {
    img.status = "uploading";
    renderGallery();
    const path = `jobs/${new Date().toISOString().slice(0, 10)}/${randomName(img.file)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, img.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: img.file.type,
    });
    if (error) {
      img.status = "error";
      renderGallery();
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    img.path = path;
    img.publicUrl = data.publicUrl;
    img.status = "done";
    renderGallery();
  }

  fileInput?.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    for (const f of files) {
      if (pendingImages.length >= MAX_IMAGES) {
        show(`본문 이미지는 최대 ${MAX_IMAGES} 장까지 첨부 가능합니다.`, "error");
        break;
      }
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_SIZE) {
        show(`'${f.name}' 용량이 8MB 를 초과합니다.`, "error");
        continue;
      }
      const img = { file: f, previewUrl: URL.createObjectURL(f), status: "uploading" };
      pendingImages.push(img);
      renderGallery();
      uploadOne(img);
    }
    fileInput.value = "";
  });

  gallery?.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    const img = pendingImages[idx];
    if (img?.path) {
      supabase.storage.from(BUCKET).remove([img.path]).catch(() => {});
    }
    pendingImages.splice(idx, 1);
    renderGallery();
  });

  // ----- 제출 -----
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
      ["j-budget",  "예산 · 단가",       2],
    ]);
    if (err) { show(err, "error"); return; }

    // 업로드 중인 이미지 확인
    if (pendingImages.some((i) => i.status === "uploading")) {
      show("이미지 업로드가 완료될 때까지 잠시만 기다려주세요.", "error");
      return;
    }
    if (pendingImages.some((i) => i.status === "error")) {
      show("업로드 실패한 이미지가 있습니다. 제거 후 다시 시도해주세요.", "error");
      return;
    }

    const org = document.getElementById("r-org").value.trim();
    const contact = document.getElementById("r-contact").value.trim();
    const email = document.getElementById("r-email").value.trim();
    const phone = document.getElementById("r-phone").value.trim();

    const isShared = shareCheckbox.checked;
    const shareName = document.getElementById("j-share-name").value.trim();
    const shareEmail = document.getElementById("j-share-email").value.trim();
    if (isShared && (!shareName || !shareEmail)) {
      show("강사 쉐어 공고는 등록자 성함 · 이메일을 반드시 입력해주세요.", "error");
      document.getElementById(shareName ? "j-share-email" : "j-share-name").focus();
      return;
    }

    const travel = getTravelFee();
    const descBase = document.getElementById("j-desc").value.trim();
    const description = [
      descBase,
      "",
      `— 담당자: ${contact} (${email}${phone ? " · " + phone : ""})`,
      isShared ? `— 강사 등록 · 수익 10% 쉐어 → ${shareName} (${shareEmail})` : "",
    ].filter(Boolean).join("\n");

    const bodyContent = document.getElementById("j-body").value.trim();
    const bodyImages = pendingImages
      .filter((i) => i.status === "done" && i.publicUrl)
      .map((i) => ({ url: i.publicUrl, path: i.path, name: i.file.name }));

    const payload = {
      organization: org,
      title: document.getElementById("j-title").value.trim(),
      description,
      body_content: bodyContent || null,
      body_images: bodyImages,
      category: document.getElementById("j-category").value,
      format: document.getElementById("j-format").value,
      period: document.getElementById("j-period").value.trim(),
      target_audience: document.getElementById("j-target").value.trim(),
      budget: document.getElementById("j-budget").value.trim(),
      tags: document.getElementById("j-tags").value.split(",").map((s) => s.trim()).filter(Boolean),
      is_urgent: document.getElementById("j-urgent").checked,
      status: "open",
      source: isShared ? "instructor-shared" : "client-registered",
      revenue_share_percent: isShared ? 10 : 0,
      posted_by_name: isShared ? shareName : null,
      posted_by_email: isShared ? shareEmail : null,
      travel_fee_region: travel.region,
      travel_fee_amount: travel.amount,
      min_price_ref_url: "https://sssdbiz.co.kr/search?serviceId=550a5eef-073f-4152-adbf-cdc92f2f0aa3",
    };

    show("등록 중…", "success");
    const { data, error } = await supabase.from(TABLES.jobs).insert(payload).select().single();
    if (error) { show("등록 실패: " + error.message, "error"); return; }

    show(`공고가 등록되었습니다. (공고번호: ${data.id.slice(0, 8)}) 본문/이미지 ${bodyImages.length}장 포함. 강사 지원이 들어오면 담당자 이메일로 알려드립니다.`, "success");
    form.reset();
    if (shareBlock) shareBlock.style.display = "none";
    pendingImages.length = 0;
    renderGallery();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
