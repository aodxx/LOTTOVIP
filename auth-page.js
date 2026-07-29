const form = document.querySelector("#auth-form");
const authScreen = document.querySelector("#auth-screen");
const dashboardScreen = document.querySelector("#dashboard-screen");
const entryScreen = document.querySelector("#entry-screen");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const displayNameInput = document.querySelector("#display-name");
const rememberEmailInput = document.querySelector("#remember-email");
const signInButton = document.querySelector("#sign-in");
const statusEl = document.querySelector("#auth-status");
const dashboardStatus = document.querySelector("#dashboard-status");
const signUpButton = document.querySelector("#sign-up");
const signOutButton = document.querySelector("#sign-out");
const roleLabels = { member:"สมาชิก", agent:"ตัวแทน", admin:"ผู้ดูแลระบบ" };
const statusLabels = { pending:"รอตรวจสอบ", active:"ใช้งานปกติ", suspended:"ระงับการใช้งาน" };
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits:2, maximumFractionDigits:2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Bangkok" });
const rememberedEmailKey = "lottovip.rememberedEmail";
const categoryMeta = {
  all:{label:"ทั้งหมด",icon:"◉"}, thai:{label:"รัฐบาลไทย",icon:"🇹🇭"},
  yeekee:{label:"ยี่กี",icon:"⚡"}, lao:{label:"ลาว",icon:"🇱🇦"},
  hanoi:{label:"ฮานอย",icon:"🇻🇳"}, quick:{label:"รอบด่วน",icon:"⏱"}
};
let dashboardRounds = [];
let activeCategory = "all";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[char]);

function setStatus(message,isError=false){ statusEl.textContent=message; statusEl.style.color=isError?"#ff8296":""; }
function setAuthBusy(busy){
  signInButton.disabled=busy;
  signUpButton.disabled=busy;
  emailInput.readOnly=busy;
  passwordInput.readOnly=busy;
}
function translateAuthError(error){
  const message=String(error?.message||"");
  if(message.includes("Invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if(message.includes("Email not confirmed")) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
  if(message.includes("Failed to fetch")) return "เชื่อมต่อระบบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
  return message||"เกิดข้อผิดพลาด กรุณาลองใหม่";
}
function saveRememberedEmail(){
  if(rememberEmailInput.checked) localStorage.setItem(rememberedEmailKey,emailInput.value.trim());
  else localStorage.removeItem(rememberedEmailKey);
}
function restoreRememberedEmail(){
  const email=localStorage.getItem(rememberedEmailKey);
  if(email){emailInput.value=email;rememberEmailInput.checked=true;passwordInput.focus();}
}
function showScreen(signedIn){
  authScreen.classList.toggle("active",!signedIn);
  dashboardScreen.classList.toggle("active",signedIn);
  entryScreen.classList.remove("active");
}
function renderCategoryTabs(rounds){
  const categories=["all",...new Set(rounds.map((round)=>round.category))];
  const tabs=document.querySelector("#category-tabs");
  tabs.innerHTML=categories.map((category)=>`<button type="button" data-category="${escapeHtml(category)}" class="${category===activeCategory?"active":""}"><span>${categoryMeta[category]?.icon||"🎯"}</span>${escapeHtml(categoryMeta[category]?.label||category)}</button>`).join("");
  tabs.querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{
    activeCategory=button.dataset.category;
    renderCategoryTabs(dashboardRounds);
    renderRounds(dashboardRounds);
  }));
}
function renderRounds(rounds){
  const list=document.querySelector("#round-list");
  document.querySelector("#open-round-count").textContent=String(rounds.length);
  const filtered=activeCategory==="all"?rounds:rounds.filter((round)=>round.category===activeCategory);
  if(!filtered.length){ list.innerHTML='<p class="muted empty-state">ยังไม่มีงวดที่เปิดอยู่ในหมวดนี้</p>'; return; }
  list.innerHTML=filtered.map((round)=>{const index=rounds.indexOf(round);const meta=categoryMeta[round.category]||{icon:"🎯",label:round.category};return `<button class="round-card" data-round-index="${index}" type="button"><span class="round-icon category-icon" aria-hidden="true">${meta.icon}</span><span class="grow round-copy"><strong>${escapeHtml(round.title)}</strong><small>${escapeHtml(meta.label)} · ${escapeHtml(round.code)}</small><time class="countdown">ปิด ${dateTime.format(new Date(round.closes_at))}</time></span><span class="status open entry-action">เลือกเลข</span></button>`;}).join("");
  list.querySelectorAll(".round-card").forEach((button)=>button.addEventListener("click",async()=>{
    button.disabled=true;
    try { await window.LOTTOVIP_ENTRY_BUILDER.open(rounds[Number(button.dataset.roundIndex)]); }
    catch(error){ dashboardStatus.textContent=`เปิดหน้ากรอกเลขไม่สำเร็จ: ${error.message}`; }
    finally { button.disabled=false; }
  }));
}
function renderRecentEntries(entries){
  const list=document.querySelector("#recent-entries");
  if(!entries.length){list.innerHTML='<p class="muted empty-state">ยังไม่มีโพยของคุณ</p>';return;}
  const statusText={draft:"แบบร่าง",submitted:"รอตรวจผล",settled:"ตรวจผลแล้ว",cancelled:"ยกเลิก"};
  list.innerHTML=entries.map((entry)=>`<article class="recent-entry"><div><b>${escapeHtml(entry.rounds?.title||"ไม่ทราบงวด")}</b><small>${escapeHtml(entry.reference_code||"ยังไม่มีเลขอ้างอิง")} · ${dateTime.format(new Date(entry.updated_at))}</small></div><div><strong>${money.format(Number(entry.total_amount))}</strong><span class="entry-state ${escapeHtml(entry.status)}">${statusText[entry.status]||entry.status}</span>${entry.status==="settled"?`<span class="prize-amount">${Number(entry.prize_amount)>0?`ถูกรางวัล +${money.format(Number(entry.prize_amount))}`:"ไม่ถูกรางวัล"}</span>`:""}</div></article>`).join("");
}
function renderLedger(entries){
  const list=document.querySelector("#ledger-list"); document.querySelector("#ledger-count").textContent=String(entries.length);
  if(!entries.length){ list.innerHTML='<p class="muted empty-state">ยังไม่มีประวัติการเคลื่อนไหว</p>'; return; }
  list.innerHTML=entries.map((entry)=>{const positive=Number(entry.amount)>=0;return `<article class="ledger-row"><div class="ledger-icon ${positive?"positive":"negative"}">${positive?"+":"−"}</div><div class="grow"><b>${escapeHtml(entry.description)}</b><time>${dateTime.format(new Date(entry.created_at))}</time></div><div class="ledger-amount ${positive?"positive-text":"negative-text"}">${positive?"+":""}${money.format(Number(entry.amount))}<small>คงเหลือ ${money.format(Number(entry.balance_after))}</small></div></article>`;}).join("");
}
async function loadDashboard(user){
  dashboardStatus.textContent="กำลังโหลดข้อมูลบัญชี..."; const client=window.lottovipSupabase;
  const results=await Promise.all([
    client.from("profiles").select("display_name,role,account_status").eq("id",user.id).single(),
    client.from("wallets").select("balance,updated_at").eq("user_id",user.id).single(),
    client.from("rounds").select("id,code,title,category,status,closes_at").eq("status","open").order("closes_at"),
    client.from("wallet_ledger").select("id,entry_type,amount,balance_after,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10),
    client.from("entries").select("id,status,total_amount,prize_amount,reference_code,updated_at,settled_at,rounds(title,category)").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(8)
  ]);
  const failure=results.find((result)=>result.error);
  if(failure){dashboardStatus.textContent=`โหลดข้อมูลไม่สำเร็จ: ${failure.error.message}`;return;}
  const [profileResult,walletResult,roundsResult,ledgerResult,entriesResult]=results; const profile=profileResult.data,wallet=walletResult.data;
  document.querySelector("#member-name").textContent=profile.display_name; document.querySelector("#member-avatar").textContent=profile.display_name.slice(0,2).toUpperCase();
  document.querySelector("#member-role").textContent=roleLabels[profile.role]||profile.role; document.querySelector("#account-status").textContent=statusLabels[profile.account_status]||profile.account_status;
  document.querySelector("#wallet-balance").textContent=money.format(Number(wallet.balance)); document.querySelector("#wallet-updated").textContent=`อัปเดตล่าสุด ${dateTime.format(new Date(wallet.updated_at))}`;
  dashboardRounds=roundsResult.data||[];
  renderCategoryTabs(dashboardRounds); renderRounds(dashboardRounds); renderRecentEntries(entriesResult.data||[]);
  renderLedger(ledgerResult.data||[]); dashboardStatus.textContent=""; window.dispatchEvent(new CustomEvent("lottovip:dashboard-loaded"));
}
async function refreshDashboard(){
  const {data}=await window.LOTTOVIP_AUTH.getSession();
  if(data.session?.user) await loadDashboard(data.session.user);
}
async function renderSession(session){const signedIn=Boolean(session?.user);showScreen(signedIn);if(signedIn)await loadDashboard(session.user);}

form.addEventListener("submit",async(event)=>{
  event.preventDefault(); setAuthBusy(true); setStatus("กำลังเข้าสู่ระบบ...");
  try {
    const {data,error}=await window.LOTTOVIP_AUTH.signIn(emailInput.value.trim(),passwordInput.value);
    if(error) return setStatus(translateAuthError(error),true);
    saveRememberedEmail(); passwordInput.value=""; setStatus(""); await renderSession(data.session);
  } finally { setAuthBusy(false); }
});
signUpButton.addEventListener("click",async()=>{
  if(!form.reportValidity())return; setAuthBusy(true); setStatus("กำลังสร้างบัญชี...");
  try {
    const{data,error}=await window.LOTTOVIP_AUTH.signUp(emailInput.value.trim(),passwordInput.value,displayNameInput.value);
    if(error)return setStatus(translateAuthError(error),true);
    saveRememberedEmail();
    if(!data.session)setStatus("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");else await renderSession(data.session);
  } finally { setAuthBusy(false); }
});
signOutButton.addEventListener("click",async()=>{
  dashboardStatus.textContent="กำลังออกจากระบบ..."; signOutButton.disabled=true;
  try {
    const{error}=await window.LOTTOVIP_AUTH.signOut();
    if(error){dashboardStatus.textContent=error.message;return;}
    showScreen(false);setStatus("ออกจากระบบแล้ว");passwordInput.value="";
  } finally { signOutButton.disabled=false; }
});
document.querySelector("#refresh-entries").addEventListener("click",refreshDashboard);

restoreRememberedEmail();
window.LOTTOVIP_AUTH.getSession().then(({data,error})=>{
  if(error){setStatus("ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ",true);showScreen(false);return;}
  renderSession(data.session);
});
window.lottovipSupabase.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_OUT"||!session)showScreen(false);
});
window.LOTTOVIP_DASHBOARD={refresh:refreshDashboard,categoryMeta};
