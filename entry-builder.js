(() => {
  const state = { round: null, rules: [], items: [], entryId: null };
  const client = window.lottovipSupabase;
  const screen = document.querySelector("#entry-screen");
  const dashboard = document.querySelector("#dashboard-screen");
  const numberInput = document.querySelector("#entry-number");
  const amountInput = document.querySelector("#entry-amount");
  const typeSelect = document.querySelector("#entry-type");
  const status = document.querySelector("#entry-status");
  const list = document.querySelector("#entry-items");
  const total = document.querySelector("#entry-total");
  const count = document.querySelector("#entry-count");

  const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);

  function currentRule() {
    return state.rules.find((rule) => rule.id === typeSelect.value);
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error-text", isError);
  }

  function syncInputs() {
    const rule = currentRule();
    numberInput.maxLength = rule?.digits || 3;
    numberInput.placeholder = rule ? `กรอกเลข ${rule.digits} หลัก` : "เลือกประเภทก่อน";
    amountInput.min = rule?.min_amount || 1;
    amountInput.max = rule?.max_amount || 1000;
  }

  function renderItems() {
    count.textContent = String(state.items.length);
    total.textContent = money.format(state.items.reduce((sum, item) => sum + Number(item.amount), 0));
    if (!state.items.length) {
      list.innerHTML = '<p class="muted empty-state">ยังไม่มีตัวเลขในรายการนี้</p>';
      return;
    }
    list.innerHTML = state.items.map((item) => `
      <article class="entry-item">
        <div><b>${escapeHtml(item.number_text)}</b><small>${escapeHtml(item.rule_name)}</small></div>
        <strong>${money.format(Number(item.amount))}</strong>
        <button type="button" data-remove="${item.id}" aria-label="ลบเลข ${escapeHtml(item.number_text)}">ลบ</button>
      </article>`).join("");
  }

  async function ensureDraft() {
    if (state.entryId) return state.entryId;
    const { data: existing, error: findError } = await client
      .from("entries").select("id").eq("round_id", state.round.id).eq("status", "draft")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (findError) throw findError;
    if (existing) state.entryId = existing.id;
    else {
      const { data, error } = await client.from("entries")
        .insert({ round_id: state.round.id, status: "draft" }).select("id").single();
      if (error) throw error;
      state.entryId = data.id;
    }
    return state.entryId;
  }

  async function loadItems() {
    if (!state.entryId) return;
    const { data, error } = await client.from("entry_items")
      .select("id,rule_id,number_text,amount,round_rules(display_name)")
      .eq("entry_id", state.entryId).order("created_at");
    if (error) throw error;
    state.items = (data || []).map((item) => ({
      ...item, rule_name: item.round_rules?.display_name || "ไม่ทราบประเภท"
    }));
    renderItems();
  }

  async function open(round) {
    state.round = round;
    state.entryId = null;
    state.items = [];
    document.querySelector("#entry-round-title").textContent = round.title;
    dashboard.classList.remove("active");
    screen.classList.add("active");
    setStatus("กำลังโหลดกติกาของงวด...");
    const { data, error } = await client.from("round_rules")
      .select("id,entry_type,display_name,digits,min_amount,max_amount,sort_order")
      .eq("round_id", round.id).eq("is_active", true).order("sort_order");
    if (error) return setStatus(error.message, true);
    state.rules = data || [];
    typeSelect.innerHTML = state.rules.map((rule) =>
      `<option value="${rule.id}">${escapeHtml(rule.display_name)}</option>`).join("");
    syncInputs();
    try {
      await ensureDraft();
      await loadItems();
      setStatus("แบบร่างจะบันทึกอัตโนมัติ ยังไม่มีการหักยอด");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  document.querySelector("#entry-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const rule = currentRule();
    const number = numberInput.value.replace(/\D/g, "");
    const amount = Number(amountInput.value);
    if (!rule || number.length !== rule.digits) return setStatus(`กรุณากรอกเลข ${rule?.digits || ""} หลักให้ครบ`, true);
    if (amount < Number(rule.min_amount) || amount > Number(rule.max_amount)) {
      return setStatus(`ยอดต้องอยู่ระหว่าง ${money.format(rule.min_amount)} - ${money.format(rule.max_amount)}`, true);
    }
    if (state.items.some((item) => item.rule_id === rule.id && item.number_text === number)) {
      return setStatus("เลขนี้มีอยู่แล้วในประเภทเดียวกัน", true);
    }
    setStatus("กำลังบันทึกแบบร่าง...");
    try {
      const entryId = await ensureDraft();
      const { error } = await client.from("entry_items").insert({
        entry_id: entryId, rule_id: rule.id, number_text: number, amount
      });
      if (error) throw error;
      numberInput.value = "";
      await loadItems();
      setStatus("บันทึกแบบร่างแล้ว");
      numberInput.focus();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  list.addEventListener("click", async (event) => {
    const id = event.target.dataset.remove;
    if (!id) return;
    setStatus("กำลังลบ...");
    const { error } = await client.from("entry_items").delete().eq("id", id);
    if (error) return setStatus(error.message, true);
    await loadItems();
    setStatus("ลบแล้ว");
  });

  typeSelect.addEventListener("change", syncInputs);
  numberInput.addEventListener("input", () => {
    numberInput.value = numberInput.value.replace(/\D/g, "").slice(0, currentRule()?.digits || 3);
  });
  document.querySelector("#entry-back").addEventListener("click", () => {
    screen.classList.remove("active");
    dashboard.classList.add("active");
  });

  window.LOTTOVIP_ENTRY_BUILDER = { open };
})();

