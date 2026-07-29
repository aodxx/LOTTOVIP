(() => {
  const client = window.lottovipSupabase;
  const money = new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const dt = new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"});
  const esc = (v) => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  async function load(){
    const status=document.querySelector("#results-status"),list=document.querySelector("#recent-results");
    if(!status||!list)return;
    status.textContent="กำลังโหลดผลจำลอง...";
    const {data,error}=await client.from("round_results")
      .select("id,first_prize,two_bottom,published_at,settled_at,rounds(title,category)")
      .order("published_at",{ascending:false}).limit(10);
    if(error){status.textContent=`โหลดผลไม่สำเร็จ: ${error.message}`;return;}
    if(!data?.length){list.innerHTML='<p class="muted empty-state">ยังไม่มีผลรางวัลจำลอง</p>';status.textContent="";return;}
    list.innerHTML=data.map(r=>`<article class="result-card"><div><small>${esc(r.rounds?.title||"งวดจำลอง")}</small><b>${esc(r.first_prize)}</b></div><div><small>2 ตัวล่าง</small><strong>${esc(r.two_bottom)}</strong><time>${dt.format(new Date(r.published_at))}</time></div></article>`).join("");
    status.textContent=`แสดง ${data.length} ผลล่าสุด`;
  }
  window.LOTTOVIP_RESULTS={load};
  window.addEventListener("lottovip:dashboard-loaded",load);
})();

