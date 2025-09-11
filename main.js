/* =========================
     * 1) Supabase 프로젝트 연결 (실제 값 입력)
     * ========================= */
    // 무엇을 변경하든: 본인 프로젝트 URL/키로 교체할 것 (이미 사용된 값 적용)
    const SUPABASE_URL = "https://vdcjlatwtiyolipidial.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkY2psYXR3dGl5b2xpcGlkaWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MzMzOTEsImV4cCI6MjA3MjAwOTM5MX0.ByedRcuojknx3WBGKaQhWunxtPFO8OLoLX0ndU_W3aA";
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    /* =========================
     * 2) DOM 참조
     * ========================= */
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const qEl = document.getElementById('q');
    const locEl = document.getElementById('loc');
    const catEl = document.getElementById('cat');
    const rewardEl = document.getElementById('reward');
    const btnSearch = document.getElementById('btn-search');
    const sortEl = document.getElementById('sort');

    const listEl = document.getElementById('list');
    const resultCountEl = document.getElementById('result-count');
    const prevEl = document.getElementById('prev');
    const nextEl = document.getElementById('next');
    const pageEl = document.getElementById('page');

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');
    const btnApply = document.getElementById('btn-apply');

    const recentEl = document.getElementById('recent');

    /* =========================
     * 3) 로그인/로그아웃 (매직링크)
     * ========================= */
    async function refreshAuthUI(){
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { btnLogin.classList.add('hidden'); btnLogout.classList.remove('hidden'); }
      else { btnLogout.classList.add('hidden'); btnLogin.classList.remove('hidden'); }
    }

    btnLogin?.addEventListener('click', async () => {
      const email = prompt('로그인할 이메일을 입력하세요');
      if (!email) return;
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) alert('로그인 메일 전송 실패: ' + error.message);
      else alert('이메일로 로그인 링크를 보냈습니다.');
    });

    btnLogout?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      refreshAuthUI();
    });

    /* =========================
     * 4) 데이터 로딩/검색/페이징
     * ========================= */
    let page = 1;
    const PAGE_SIZE = 12;

    async function fetchJobs(){
      let query = supabase.from('jobs').select('*', { count: 'exact' }).eq('is_published', true);

      const q = qEl.value?.trim();
      if (q) query = query.or(`title.ilike.%${q}%,company.ilike.%${q}%,desc.ilike.%${q}%`);

      const loc = locEl.value; if (loc) query = query.eq('location', loc);
      const cat = catEl.value; if (cat) query = query.eq('category', cat);
      const rew = rewardEl.value; if (rew) query = query.eq('reward_type', rew);

      const from = (page-1) * PAGE_SIZE; const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await query.order('created_at', { ascending:false }).range(from, to);
      if (error){ listEl.innerHTML = `<div class='rounded-xl border bg-white p-4 text-rose-700 text-sm'>불러오기 실패: ${error.message}</div>`; return; }

      renderList(data || []);
      resultCountEl.textContent = count ?? 0;
      pageEl.textContent = String(page);
      prevEl.disabled = page <= 1;
      nextEl.disabled = (page * PAGE_SIZE) >= (count || 0);
    }

    function renderList(rows){
      if (!rows.length){
        listEl.innerHTML = `<div class='rounded-xl border bg-white p-6 text-center text-sm text-gray-600'>조건에 맞는 공고가 없습니다.</div>`; return;
      }
      listEl.innerHTML = rows.map(row => JobCard(row)).join('');
      document.querySelectorAll('[data-job]')?.forEach(el => {
        el.addEventListener('click', (e) => {
          const row = JSON.parse(el.dataset.job);
          openModal(row);
          addRecent(row);
        });
      });
      document.querySelectorAll('[data-fav]')?.forEach(el => {
        el.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(el.dataset.fav); });
      });
      hydrateFavs();
    }

    function pill(reward){ return reward==='share'?'수익셰어':reward==='bounty'?'건당 보너스':'하이브리드'; }

    function JobCard(row){
      const isFav = getFavs().includes(row.id);
      return `
        <article class="group rounded-2xl border bg-white p-4 hover:shadow-sm cursor-pointer" data-job='${jsonEscape(row)}'>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-gray-500">${escapeHtml(row.category||'기타')} 쨌 ${escapeHtml(row.duration||'-')} 쨌 ${escapeHtml(row.location||'온라인')}</div>
              <h3 class="mt-0.5 text-base font-bold group-hover:text-rose-700">${escapeHtml(row.title)}</h3>
              <p class="mt-1 text-sm text-gray-700 line-clamp-2">${escapeHtml(row.short||row.desc||'')}</p>
              <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                <span class="badge">${pill(row.reward_type)}</span>
                ${row.share?`<span class="badge">${escapeHtml(row.share)}</span>`:''}
                ${row.cap?`<span class="badge">캡 ${escapeHtml(row.cap)}</span>`:''}
                ${row.trigger?`<span class="badge">트리거 ${escapeHtml(row.trigger)}</span>`:''}
              </div>
            </div>
            <div class="text-right min-w-28">
              <button class="text-gray-400 hover:text-rose-600" title="즐겨찾기" data-fav="${row.id}">
                ${isFav? '❤️' : '🤍'}
              </button>
              <div class="text-xs text-gray-500 mt-2">${escapeHtml(row.company||'')}</div>
              <div class="text-xs text-gray-400">${new Date(row.created_at).toLocaleDateString('ko-KR')}</div>
              <button class="mt-2 btn btn-primary">상세보기</button>
            </div>
          </div>
        </article>`;
    }

    // 유틸: XSS 방지 및 데이터 직렬화
    function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"}[s])); }
    function jsonEscape(obj){ return escapeHtml(JSON.stringify(obj)); }

    /* =========================
     * 5) 상세 모달 + 지원
     * ========================= */
    function openModal(row){
      modalTitle.textContent = row.title;
      modalBody.innerHTML = `
        <div class="text-sm text-gray-700">
          <div class="text-gray-500">${escapeHtml(row.company||'')} 쨌 ${escapeHtml(row.location||'온라인')}</div>
          <div class="mt-2 whitespace-pre-wrap">${escapeHtml(row.desc||'')}</div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            ${row.reward_type?`<span class='badge'>${pill(row.reward_type)}</span>`:''}
            ${row.share?`<span class='badge'>수익셰어 ${escapeHtml(row.share)}</span>`:''}
            ${row.cap?`<span class='badge'>캡 ${escapeHtml(row.cap)}</span>`:''}
            ${row.trigger?`<span class='badge'>지급 트리거 ${escapeHtml(row.trigger)}</span>`:''}
          </div>
        </div>`;
      btnApply.onclick = () => applyJob(row);
      modal.classList.remove('hidden'); modal.classList.add('flex');
    }
    modalClose?.addEventListener('click', ()=>{ modal.classList.add('hidden'); modal.classList.remove('flex'); });

    async function applyJob(row){
      const { data: { session } } = await supabase.auth.getSession();
      if (!session){ alert('로그인이 필요해요.'); return; }
      const email = prompt('연락받을 이메일/포트폴리오 링크를 입력하세요');
      if (!email) return;
      const { error } = await supabase.from('applications').insert({ job_id: row.id, applicant_email: email, note: '베타 간편지원' });
      if (error) alert('지원 실패: ' + error.message); else alert('지원이 접수되었습니다.');
    }

    /* =========================
     * 6) 즐겨찾기/최근 본 공고 (로컬스토리지)
     * ========================= */
    function getFavs(){ try{ return JSON.parse(localStorage.getItem('favJobs')||'[]'); }catch{ return []; } }
    function setFavs(arr){ localStorage.setItem('favJobs', JSON.stringify(arr)); }
    function toggleFav(id){ const cur=getFavs(); const i=cur.indexOf(id); if(i>-1) cur.splice(i,1); else cur.unshift(id); setFavs(cur); hydrateFavs(); }
    function hydrateFavs(){
      document.querySelectorAll('[data-fav]')?.forEach(btn=>{
        const id = btn.dataset.fav; const isFav = getFavs().includes(id);
        btn.textContent = isFav ? '❤️' : '🤍';
      });
    }

    function addRecent(row){
      let rec = [];
      try{ rec = JSON.parse(localStorage.getItem('recentJobs')||'[]'); }catch{}
      rec = rec.filter(r=>r.id!==row.id);
      rec.unshift({ id: row.id, title: row.title });
      rec = rec.slice(0,6);
      localStorage.setItem('recentJobs', JSON.stringify(rec));
      renderRecent();
    }
    function renderRecent(){
      let rec=[]; try{ rec=JSON.parse(localStorage.getItem('recentJobs')||'[]'); }catch{}
      if (!rec.length){ recentEl.innerHTML = '<div class="text-xs text-gray-500">아직 없음</div>'; return; }
      recentEl.innerHTML = rec.map(r=>`<div class='truncate'>- ${escapeHtml(r.title)}</div>`).join('');
    }

    /* =========================
     * 8) 광고 팝업
     * ========================= */
    const adPopup = document.getElementById('ad-popup');
    const adCloseBtn = document.getElementById('ad-close');
    const adCloseTodayBtn = document.getElementById('ad-close-today');

    function handleAdPopup() {
      const hideUntil = localStorage.getItem('hideAdUntil');
      if (hideUntil && new Date().getTime() < parseInt(hideUntil)) {
        return; // Do not show popup if it's suppressed
      }
      adPopup.classList.remove('hidden');
      adPopup.classList.add('flex');
    }

    adCloseBtn?.addEventListener('click', () => {
      adPopup.classList.add('hidden');
      adPopup.classList.remove('flex');
    });

    adCloseTodayBtn?.addEventListener('click', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Set to midnight
      localStorage.setItem('hideAdUntil', tomorrow.getTime().toString());
      adPopup.classList.add('hidden');
      adPopup.classList.remove('flex');
    });

    /* =========================
     * 7) 이벤트 바인딩 & 초기 실행
     * ========================= */
    btnSearch?.addEventListener('click', ()=>{ page=1; fetchJobs(); });
    document.querySelectorAll('.tag[data-q]')?.forEach(t=> t.addEventListener('click', ()=>{ qEl.value=t.dataset.q; page=1; fetchJobs(); }));
    document.querySelectorAll('.tag[data-cat]')?.forEach(t=> t.addEventListener('click', ()=>{ catEl.value=t.dataset.cat; page=1; fetchJobs(); }));
    prevEl?.addEventListener('click', ()=>{ if(page>1){ page--; fetchJobs(); }});
    nextEl?.addEventListener('click', ()=>{ page++; fetchJobs(); });

    refreshAuthUI();
    renderRecent();
    fetchJobs();
    handleAdPopup(); // Handle the ad popup on load