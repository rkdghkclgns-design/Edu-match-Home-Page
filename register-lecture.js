// =========================================================
// Edu-match — 의뢰자용 강의 공고 등록
// =========================================================

(function () {
  const em = window.EduMatch;
  if (!em?.supabase) {
    alert("Supabase 설정이 누락되었습니다.");
    return;
  }
  const supabase = em.supabase;
  const TABLES = em.TABLES;

  const form = document.getElementById("register-form");
  const msg = document.getElementById("reg-msg");
  const shareCheckbox = document.getElementById("j-share");
  const shareBlock = document.getElementById("share-block");

  shareCheckbox?.addEventListener("change", () => {
    shareBlock.style.display = shareCheckbox.checked ? "" : "none";
  });

  function show(text, type) {
    msg.textContent = text;
    msg.className = "auth-message is-shown auth-message--" + type;
  }

  function getTravelFee() {
    const picked = form.querySelector('input[name="travel_fee_region"]:checked');
    if (!picked) return { region: null, amount: 0 };
    return {
      region: picked.value,
      amount: Number(picked.dataset.amount) || 0,
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const org = document.getElementById("r-org").value.trim();
    const contact = document.getElementById("r-contact").value.trim();
    const email = document.getElementById("r-email").value.trim();
    const phone = document.getElementById("r-phone").value.trim();

    const isShared = shareCheckbox.checked;
    const shareName = document.getElementById("j-share-name").value.trim();
    const shareEmail = document.getElementById("j-share-email").value.trim();
    const travel = getTravelFee();

    const descBase = document.getElementById("j-desc").value.trim();
    const description = [
      descBase,
      "",
      `— 담당자: ${contact} (${email}${phone ? " · " + phone : ""})`,
      isShared ? `— 강사 등록 · 수익 10% 쉐어 → ${shareName || "강사 미지정"} (${shareEmail || "-"})` : "",
    ].filter(Boolean).join("\n");

    const payload = {
      organization: org,
      title: document.getElementById("j-title").value.trim(),
      description,
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
    if (error) {
      show("등록 실패: " + error.message, "error");
      return;
    }
    show(`공고가 등록되었습니다. (공고번호: ${data.id.slice(0, 8)}) 강사 지원이 들어오면 담당자 이메일로 알려드립니다.`, "success");
    form.reset();
    if (shareBlock) shareBlock.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
