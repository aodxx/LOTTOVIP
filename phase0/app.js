const screens = [...document.querySelectorAll("[data-screen]")];
const bottomNav = document.querySelector("#bottom-nav");
const selected = new Set();
let digits = 3;
let currentInput = "";
let secondsLeft = 522;

function navigate(name) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === name));
  bottomNav.classList.toggle("hidden", name === "login" || name === "receipt");
  [...bottomNav.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", button.dataset.go === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  navigate("dashboard");
  showToast("เข้าสู่ Prototype สำเร็จ");
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.go));
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

function buildKeypad() {
  const keypad = document.querySelector("#keypad");
  ["1","2","3","4","5","6","7","8","9","ล้าง","0","⌫"].forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key;
    button.addEventListener("click", () => {
      if (key === "ล้าง") currentInput = "";
      else if (key === "⌫") currentInput = currentInput.slice(0,-1);
      else if (currentInput.length < digits) currentInput += key;
      renderDigits();
    });
    keypad.appendChild(button);
  });
}

function renderDigits() {
  const display = document.querySelector("#digit-display");
  display.innerHTML = "";
  for (let i = 0; i < digits; i += 1) {
    const span = document.createElement("span");
    span.textContent = currentInput[i] ?? "—";
    display.appendChild(span);
  }
  document.querySelector("#add-number").disabled = currentInput.length !== digits;
  document.querySelector(".manual-entry .eyebrow").textContent = `กรอกเลข ${digits} หลัก`;
}

function buildNumberGrid(filter = "") {
  const grid = document.querySelector("#number-grid");
  const max = digits === 3 ? 1000 : digits === 2 ? 100 : 10;
  grid.innerHTML = "";
  for (let i = 0; i < max; i += 1) {
    const value = String(i).padStart(digits, "0");
    if (!value.includes(filter)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value;
    button.classList.toggle("selected", selected.has(value));
    button.addEventListener("click", () => toggleNumber(value, button));
    grid.appendChild(button);
  }
}

function toggleNumber(value, button) {
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  button?.classList.toggle("selected", selected.has(value));
  updateCart();
}

function updateCart() {
  const total = selected.size * 10;
  document.querySelector("#selected-count").textContent = selected.size;
  document.querySelector("#total-credit").textContent = `${total.toLocaleString("th-TH")} เครดิต`;
  document.querySelector("#confirm-entry").disabled = selected.size === 0;
}

document.querySelector("#add-number").addEventListener("click", () => {
  if (!selected.has(currentInput)) {
    selected.add(currentInput);
    showToast(`เพิ่มเลข ${currentInput} แล้ว`);
  } else showToast(`เลข ${currentInput} อยู่ในรายการแล้ว`);
  currentInput = "";
  renderDigits();
  updateCart();
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const gridMode = button.dataset.mode === "grid";
    document.querySelector("#manual-entry").classList.toggle("hidden", gridMode);
    document.querySelector("#number-grid-wrap").classList.toggle("hidden", !gridMode);
    if (gridMode) buildNumberGrid(document.querySelector("#number-search").value);
  });
});

document.querySelectorAll("[data-digits]").forEach((button) => {
  button.addEventListener("click", () => {
    digits = Number(button.dataset.digits);
    currentInput = "";
    selected.clear();
    document.querySelectorAll("[data-digits]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderDigits();
    buildNumberGrid();
    updateCart();
  });
});

document.querySelector("#number-search").addEventListener("input", (event) => {
  buildNumberGrid(event.target.value.replace(/\D/g, "").slice(0,digits));
});

document.querySelector("#confirm-entry").addEventListener("click", () => {
  const values = [...selected];
  const total = values.length * 10;
  document.querySelector("#receipt-numbers").textContent =
    values.slice(0,6).join(", ") + (values.length > 6 ? ` +${values.length - 6}` : "");
  document.querySelector("#receipt-total").textContent = `${total.toLocaleString("th-TH")} เครดิต`;
  document.querySelector("#receipt-balance").textContent =
    `${(10000 - total).toLocaleString("th-TH")} เครดิต`;
  document.querySelector("#receipt-id").textContent =
    `NL-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${String(Math.floor(Math.random()*9999)).padStart(4,"0")}`;
  navigate("receipt");
});

setInterval(() => {
  if (secondsLeft <= 0) return;
  secondsLeft -= 1;
  const value = `${String(Math.floor(secondsLeft/60)).padStart(2,"0")}:${String(secondsLeft%60).padStart(2,"0")}`;
  document.querySelectorAll("[data-seconds], [data-countdown-copy]").forEach((el) => { el.textContent = value; });
},1000);

buildKeypad();
renderDigits();
buildNumberGrid();
navigate("login");
