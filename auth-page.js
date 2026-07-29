const form = document.querySelector("#auth-form");
const authScreen = document.querySelector("#auth-screen");
const dashboardScreen = document.querySelector("#dashboard-screen");
const entryScreen = document.querySelector("#entry-screen");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const displayNameInput = document.querySelector("#display-name");
const statusEl = document.querySelector("#auth-status");
const dashboardStatus = document.querySelector("#dashboard-status");
const signUpButton = document.querySelector("#sign-up");
const signOutButton = document.querySelector("#sign-out");
const roleLabels = { member:"สมาชิก", agent:"ตัวแทน", admin:"ผู้ดูแลระบบ" };
const statusLabels = { pending:"รอตรวจสอบ", active:"ใช้งานปกติ", suspended:"ระงับการใช้งาน" };
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits:2, maximumFractionDigits:2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Bangkok" });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[char]);
function setStatus(message,isError=false){ statusEl.textContent=message; statusEl.style.color=isError?"#ff8296":""; }
function showScreen(signedIn){ authScreen.classList.toggle("active",!signedIn); dashboardScreen.classList.toggle("active",signedIn); entryScreen.classList.remove("active"); }
function renderRounds(rounds){
  const list=document.querySelector("#round-list"); document.querySelector("#open-round-count").textContent=String(rounds.length);
  if(!rounds.length){ list.innerHTML='<p class="muted empty-state">ยังไม่มีงวดที่เปิดอยู่</p>'; return; }
  list.innerHTML=rounds.map((round,index)=>`<article class="round-card" data-round-index="${index}" tabindex="0"><div class="round-icon gold">LV</div><div class="grow"><h3>${escapeHtml(round.title)}</h3><p>รหัส ${escapeHtml(round.code)}</p><time class="countdown">ปิด ${dateTime.format(new Date(round.closes_at))}</time></div><span class="status open entry-action">กรอกเลข</span></article>`).join("");
  list.querySelectorAll(".round-card").forEach((card)=>card.addEventListener("click",()=>window.LOTTOVIP_ENTRY_BUILDER.open(rounds[Number(card.dataset.roundIndex)])));
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
    client.from("wallet_ledger").select("id,entry_type,amount,balance_after,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10)
  ]);
  const failure=results.find((result)=>result.error); if(failure){dashboardStatus.textContent=`โหลดข้อมูลไม่สำเร็จ: ${failure.error.message}`;return;}
  const [profileResult,walletResult,roundsResult,ledgerResult]=results; const profile=profileResult.data,wallet=walletResult.data;
  document.querySelector("#member-name").textContent=profile.display_name; document.querySelector("#member-avatar").textContent=profile.display_name.slice(0,2).toUpperCase();
  document.querySelector("#member-role").textContent=roleLabels[profile.role]||profile.role; document.querySelector("#account-status").textContent=statusLabels[profile.account_status]||profile.account_status;
  document.querySelector("#wallet-balance").textContent=money.format(Number(wallet.balance)); document.querySelector("#wallet-updated").textContent=`อัปเดตล่าสุด ${dateTime.format(new Date(wallet.updated_at))}`;
  renderRounds(roundsResult.data||[]); renderLedger(ledgerResult.data||[]); dashboardStatus.textContent="";
}
async function renderSession(session){const signedIn=Boolean(session?.user);showScreen(signedIn);if(signedIn)await loadDashboard(session.user);}
form.addEventListener("submit",async(event)=>{event.preventDefault();setStatus("กำลังเข้าสู่ระบบ...");const{data,error}=await window.LOTTOVIP_AUTH.signIn(emailInput.value,passwordInput.value);if(error)return setStatus(error.message,true);passwordInput.value="";setStatus("");await renderSession(data.session);});
signUpButton.addEventListener("click",async()=>{if(!form.reportValidity())return;setStatus("กำลังสร้างบัญชี...");const{data,error}=await window.LOTTOVIP_AUTH.signUp(emailInput.value,passwordInput.value,displayNameInput.value);if(error)return setStatus(error.message,true);if(!data.session)setStatus("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");else await renderSession(data.session);});
signOutButton.addEventListener("click",async()=>{dashboardStatus.textContent="กำลังออกจากระบบ...";const{error}=await window.LOTTOVIP_AUTH.signOut();if(error){dashboardStatus.textContent=error.message;return;}showScreen(false);setStatus("ออกจากระบบแล้ว");});
window.LOTTOVIP_AUTH.getSession().then(({data})=>renderSession(data.session)); window.lottovipSupabase.auth.onAuthStateChange((_event,session)=>{if(!session)showScreen(false);});

