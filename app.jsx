const { useState, useEffect, useRef } = React;
const D = window.BM_DATA;

const Ico = {
  male: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="14" r="5"/><path d="M14 10l6-6M15 4h5v5"/></svg>,
  female: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/></svg>,
  front: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="6" r="3"/><path d="M7 21v-7a5 5 0 0110 0v7"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="6" r="3"/><path d="M7 21v-7a5 5 0 0110 0v7M12 11v10"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>,
};

function Gauge({ value, level }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 150); return () => clearTimeout(t); }, [value]);
  const col = ['var(--ok)', 'var(--warn)', 'var(--danger)'][level];
  const R = 95, C = Math.PI * R;
  const ang = Math.PI * (1 - v / 100);
  const nx = 115 + Math.cos(ang) * R, ny = 125 - Math.sin(ang) * R;
  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 230 150">
        <defs>
          <linearGradient id="gg" x1="0" x2="1">
            <stop offset="0" stopColor="oklch(0.74 0.14 160)" />
            <stop offset=".5" stopColor="oklch(0.8 0.14 80)" />
            <stop offset="1" stopColor="oklch(0.62 0.2 25)" />
          </linearGradient>
        </defs>
        <path d="M20 125 A95 95 0 0 1 210 125" stroke="var(--line)" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d="M20 125 A95 95 0 0 1 210 125" stroke="url(#gg)" strokeWidth="16" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }} />
        <circle cx={nx} cy={ny} r="11" fill="var(--card-solid)" stroke={col} strokeWidth="5" style={{ transition: 'all 1.4s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="gauge-val"><b style={{ color: col }}>{Math.round(v)}٪</b><span>درجة الخطورة</span></div>
    </div>
  );
}

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('bm_dark') === '1');
  const [gender, setGender] = useState('male');
  const [view, setView] = useState('front');
  const [screen, setScreen] = useState('home'); // home | pick | chat | result
  const [region, setRegion] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [typing, setTyping] = useState(false);
  const [picked, setPicked] = useState(null);
  const [alertFlag, setAlertFlag] = useState(null);
  const [flagged, setFlagged] = useState(null);
  const mount = useRef(null), body = useRef(null), logRef = useRef(null), sref = useRef(screen);
  sref.current = screen;

  useEffect(() => {
    body.current = BodyMap3D.createBody(mount.current, {
      onSelect: id => {
        if (sref.current === 'home' || sref.current === 'pick') startRegion(id);
      },
    });
    return () => body.current.dispose();
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); body.current && body.current.setDark(dark); localStorage.setItem('bm_dark', dark ? '1' : '0'); }, [dark]);
  useEffect(() => { body.current.setGender(gender); }, [gender]);
  useEffect(() => { body.current.setView(view); }, [view]);
  useEffect(() => {
    const b = body.current;
    b.setActive(screen === 'home' || screen === 'pick');
    b.setDim(screen === 'chat');
    b.focus(screen === 'chat' ? region : null, screen === 'chat' ? 'zoom' : 'full');
    if (screen !== 'chat' && screen !== 'result') b.setSelected(null);
  }, [screen, region]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 99999; }, [answers, typing, step]);

  // scale device to fit
  useEffect(() => {
    const fit = () => {
      const d = document.querySelector('.device'); if (!d) return;
      const s = Math.min(1, (window.innerHeight - 40) / 864, (window.innerWidth - 40) / 410);
      d.style.transform = `scale(${s})`;
    };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);

  function startRegion(id) {
    const r = D.regions[id];
    body.current.setSelected(id);
    body.current.faceRegion(id);
    setView(r.side === 'back' || BodyMap3D.HOTSPOTS[id].pos[2] < -0.05 ? 'back' : 'front');
    setRegion(id); setStep(0); setAnswers([]); setFlagged(null); setPicked(null);
    setTimeout(() => { setScreen('chat'); setTyping(true); setTimeout(() => setTyping(false), 700); }, 450);
  }

  function answer(opt, i) {
    if (picked !== null) return;
    setPicked(i);
    setTimeout(() => {
      const q = D.regions[region].qs[step];
      const next = [...answers, { q: q.q, opt }];
      setAnswers(next); setPicked(null);
      if (opt.flag) { setFlagged(opt.flag); setAlertFlag(opt.flag); if (navigator.vibrate) navigator.vibrate([120, 60, 120]); return; }
      if (step + 1 >= D.regions[region].qs.length) { setTyping(true); setTimeout(() => { setTyping(false); setScreen('result'); }, 1100); return; }
      setTyping(true); setStep(step + 1);
      setTimeout(() => setTyping(false), 750);
    }, 260);
  }

  function reset() { setScreen('home'); setRegion(null); setAnswers([]); setStep(0); setAlertFlag(null); setFlagged(null); setView('front'); }

  // scoring
  const qs = region ? D.regions[region].qs : [];
  const total = answers.reduce((a, x) => a + x.opt.s, 0);
  const max = qs.reduce((a, q) => a + Math.max(...q.opts.map(o => o.s)), 0) || 1;
  let pct = Math.round(8 + (total / max) * 80);
  let level = pct < 35 ? 0 : pct < 62 ? 1 : 2;
  if (flagged) { level = 2; pct = 94; }
  const res = region ? D.results[region][level] : null;
  const lvlName = ['بسيطة', 'متوسطة', 'عالية'][level];
  const lvlCol = ['var(--ok)', 'var(--warn)', 'var(--danger)'][level];

  const q = qs[step];

  return (
    <div className={'device s-' + screen}>
      <div className="statusbar"><span>9:41</span><div className="isl" /><div className="batt" /></div>

      <div className="stage" ref={mount} />

      <div className="top">
        {screen === 'home' ? (
          <div className="brand"><i>+</i>BodyMap</div>
        ) : (
          <button className="back-btn" onClick={reset} aria-label="رجوع">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        )}
        <div className="icons">
          {(screen === 'home' || screen === 'pick') && <>
            <button className={'ic' + (gender === 'male' ? ' on' : '')} onClick={() => setGender('male')} title="ذكر">{Ico.male}</button>
            <button className={'ic' + (gender === 'female' ? ' on' : '')} onClick={() => setGender('female')} title="أنثى">{Ico.female}</button>
            <button className="ic" onClick={() => setView(view === 'front' ? 'back' : 'front')} title={view === 'front' ? 'خلفي' : 'أمامي'}>{view === 'front' ? Ico.front : Ico.back}</button>
          </>}
          <button className="ic" onClick={() => setDark(!dark)} title="الوضع الليلي">{dark ? Ico.sun : Ico.moon}</button>
        </div>
      </div>

      {screen === 'home' && <>
        <div className="hero">
          <span className="pill"><b />مساعدك الطبي الذكي</span>
          <h1>اكتشف سبب ألمك<br />في <em>30 ثانية</em></h1>
        </div>
        <div className="hint-rot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5"/></svg>
          لِف الجسم ودوس على مكان الألم
        </div>
        <div className="bottom">
          <button className="cta" onClick={() => setScreen('pick')}>ابدأ الفحص الآن <span className="arr">←</span></button>
          <div className="trust">مبني على مراجع WHO و NIH <span className="dot" /> لا يغني عن استشارة الطبيب</div>
        </div>
      </>}

      {screen === 'pick' && <>
        <div className="pick-head"><h2>فين الألم؟</h2><p>دوس على أي نقطة مضيئة، أو اختار من تحت</p></div>
        <div className="chips">
          {Object.keys(D.regions).map(id => <button key={id} className="chip" onClick={() => startRegion(id)}>{D.regions[id].name}</button>)}
        </div>
      </>}

      {screen === 'chat' && region && (
        <div className="chat">
          <div className="region-tag"><b />{D.regions[region].name}</div>
          <div className="progress">{qs.map((_, i) => <span key={i} className={i < answers.length ? 'done' : i === step ? 'on' : ''} />)}</div>
          <div className="log" ref={logRef}>
            {answers.map((a, i) => <React.Fragment key={i}>
              <div className="bub bot" style={{ opacity: .7 }}>{a.q}</div>
              <div className="bub me">{a.opt.t}</div>
            </React.Fragment>)}
            {typing ? <div className="typing"><span /><span /><span /></div> : q && answers.length === step && (
              <div className="bub bot q" key={'q' + step}>
                {step === 0 && <small>تمام، هنسألك كام سؤال بسيط عن {D.regions[region].name}</small>}
                {q.q}
                {q.hint && <small>{q.hint}</small>}
              </div>
            )}
          </div>
          {!typing && q && answers.length === step && !alertFlag && (
            <div className="opts" key={'o' + step}>
              {q.opts.map((o, i) => (
                <button key={i} className={'opt' + (picked === i ? ' sel' : '')} style={{ animationDelay: i * 60 + 'ms' }} onClick={() => answer(o, i)}>
                  {o.ico && <span className="lvl">{o.ico}</span>}{o.t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {screen === 'result' && res && (
        <div className="result">
          <Gauge value={pct} level={level} />
          <div className="res-title">
            <small>النتيجة · {D.regions[region].name}</small>
            <h2>{res.title}</h2>
            <span className="lvl-badge" style={{ color: lvlCol, background: `color-mix(in oklch, ${lvlCol} 16%, transparent)` }}>خطورة {lvlName}</span>
          </div>
          <div className="cards">
            {[['الأعراض', res.symptoms, 'var(--teal)'], ['الإسعافات الأولية', res.aid, 'var(--accent)'], ['متى تروح للدكتور؟', res.doctor, lvlCol]].map(([h, p, c], i) => (
              <div className="rcard" key={i} style={{ animationDelay: 300 + i * 120 + 'ms' }}>
                <div className="n" style={{ background: `color-mix(in oklch, ${c} 18%, transparent)`, color: c }}>{i + 1}</div>
                <div><h4>{h}</h4><p>{p}</p></div>
              </div>
            ))}
          </div>
          {level === 2
            ? <button className="btn-danger">اتصل بالطوارئ ١٢٣</button>
            : <button className="btn-main">احجز مع دكتور</button>}
          <button className="again" onClick={reset}>فحص مكان تاني</button>
          <div className="foot">
            <div className="refs"><span>WHO</span><span>NIH</span><span>NHS</span></div>
            <p>هذا التطبيق مبني على مراجع طبية معتمدة</p>
            <div className="disc"><i>i</i>لا يغني عن استشارة الطبيب</div>
          </div>
        </div>
      )}

      {alertFlag && (
        <div className="alert">
          <div className="alert-card">
            <div className="siren">!</div>
            <h3>اتصل بالإسعاف فوراً</h3>
            <p>{D.flags[alertFlag]}</p>
            <button className="btn-danger">اتصل بالإسعاف ١٢٣</button>
            <button className="btn-ghost" onClick={() => { setAlertFlag(null); setScreen('result'); }}>شوف ملخص الحالة</button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
