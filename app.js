(function(){

  // ---------------- Data ----------------
  // Klassifisering skjer direkte på forventet varighet (under/over ca. 4 min), per
  // Olympiatoppens grense — ikke via distansenavn. Distanse er kun input til den valgfrie
  // startlistekalkulatoren (tid per par), og påvirker ikke resten av verktøyet.

  // "Typisk brukt" = erfaringsbasert, ikke et forskningskrav. Vises nøytralt (blått).
  const TYPICAL = {
    general: [10,20],
    activation: [8,15],
    priming: { sprint: [5,10], lange: [8,15] }
  };

  // Det ENESTE strengt forskningsbaserte vinduet: tiden fra priming er avsluttet til start
  // (dekker skifte + tid på isen samlet). Kilde: McGowan et al. 2015; Olympiatoppen fagstoff.
  // Vinduet er det SAMME inne og ute — forskningen gir ikke grunnlag for et kortere vindu i
  // kulde. Det som endres i kulde er HVORDAN tiden brukes (mer i varmt tøy, mindre bar is),
  // ikke hvor lang tid som er tilgjengelig.
  const TRANSITION_BAND = [9, 20];

  const DEFAULTS = {
    sprint: { general: 15, activation: 10, priming: 7, change: 14, ice: 6 },
    lange:  { general: 20, activation: 10, priming: 10, change: 14, ice: 6 }
  };

  // Foreslåtte fordelinger av "skifte" og "is-tid" per miljø — flytter minutter fra
  // "på isen" til "skifte" (i varmt tøy) ved kulde, uten å endre selve totalen for mye.
  const ENV_SPLIT = {
    indoor:  { change: 14, ice: 6 },
    outdoor: { change: 14, ice: 4 }
  };

  const state = {
    type: "sprint",
    env: "indoor",
    raceStart: "14:00",
    general: 15, activation: 10, priming: 7, change: 14, ice: 6
  };

  // ---------------- DOM refs ----------------
  const $ = id => document.getElementById(id);
  const typeToggle = $("typeToggle");
  const envToggle = $("envToggle");
  const raceStart = $("raceStart");

  // ---------------- Helpers ----------------
  function parseTime(hhmm){ const [h,m] = hhmm.split(":").map(Number); return h*60+m; }
  function minutesToClock(mins){
    mins = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0");
  }
  function secToMMSS(sec){
    const m = Math.floor(sec/60), s = Math.round(sec%60);
    return String(m) + ":" + String(s).padStart(2,"0");
  }
  function mmssToSec(str){
    const parts = str.split(":").map(Number);
    if(parts.length !== 2 || parts.some(isNaN)) return null;
    return parts[0]*60 + parts[1];
  }
  function inBand(val, band){ return val >= band[0] && val <= band[1]; }
  function setToggle(group, attr, value){
    [...group.children].forEach(btn=> btn.classList.toggle("active", btn.dataset[attr] === value));
  }

  // ---------------- Lagrede preferanser (localStorage) ----------------
  // Lagres per kombinasjon av type + miljø. Faller tilbake til DEFAULTS/ENV_SPLIT
  // hvis ingenting er lagret ennå, eller hvis localStorage ikke er tilgjengelig
  // (f.eks. i Claudes egen forhåndsvisning — fungerer normalt når siden er
  // publisert på GitHub Pages).
  function presetKey(){ return `oppvarming-preset-${state.type}-${state.env}`; }
  function loadPreset(){
    try{
      const raw = localStorage.getItem(presetKey());
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }
  function savePreset(){
    try{
      localStorage.setItem(presetKey(), JSON.stringify({
        general: state.general, activation: state.activation,
        priming: state.priming, change: state.change, ice: state.ice
      }));
      return true;
    } catch(e){ return false; }
  }
  function clearPreset(){
    try{ localStorage.removeItem(presetKey()); return true; } catch(e){ return false; }
  }
  function typeLabel(t){ return t === "sprint" ? "under 4 min" : "4 min eller mer"; }
  function envLabel(e){ return e === "indoor" ? "innendørs" : "utendørs/kaldt"; }

  // ---------------- Sliders ----------------
  const sliders = { general: $("s-general"), activation: $("s-activation"), priming: $("s-priming"), change: $("s-change"), ice: $("s-ice") };

  function colorSlider(el, band, absMin, absMax){
    const p1 = ((band[0]-absMin)/(absMax-absMin))*100;
    const p2 = ((band[1]-absMin)/(absMax-absMin))*100;
    const outside = "#5f7c8c33";
    el.style.background = `linear-gradient(to right, ${outside} 0%, ${outside} ${p1}%, #3fd0e055 ${p1}%, #3fd0e055 ${p2}%, ${outside} ${p2}%, ${outside} 100%)`;
  }

  function updateSliderVisuals(){
    colorSlider(sliders.general, TYPICAL.general, +sliders.general.min, +sliders.general.max);
    colorSlider(sliders.activation, TYPICAL.activation, +sliders.activation.min, +sliders.activation.max);
    colorSlider(sliders.priming, TYPICAL.priming[state.type], +sliders.priming.min, +sliders.priming.max);
    colorSlider(sliders.change, [10,20], +sliders.change.min, +sliders.change.max);
    colorSlider(sliders.ice, [4,10], +sliders.ice.min, +sliders.ice.max);

    $("val-general").textContent = state.general + " min";
    $("val-activation").textContent = state.activation + " min";
    $("val-priming").textContent = state.priming + " min";
    $("val-change").textContent = state.change + " min";
    $("val-ice").textContent = state.ice + " min";

    const primingBand = TYPICAL.priming[state.type];
    $("note-general").textContent = `Typisk: ${TYPICAL.general[0]}–${TYPICAL.general[1]} min. Erfaringsbasert, ikke en forskningsgrense.`;
    $("note-activation").textContent = `Typisk: ${TYPICAL.activation[0]}–${TYPICAL.activation[1]} min. Dynamisk — ikke statisk tøying.`;
    $("note-priming").textContent = `Typisk for ${state.type === "sprint" ? "sprint" : "lange løp"}: ${primingBand[0]}–${primingBand[1]} min. Forskningen sier optimal varighet her fortsatt er uklar.`;
    $("note-change").textContent = state.env === "outdoor"
      ? "I kulde: bruk gjerne mer av vinduet her, i varmt tøy, fremfor på bar is."
      : "Individuelt — spriker fra ca. 10 til 20 min blant erfarne løpere.";
    $("note-ice").textContent = state.env === "outdoor"
      ? "Hold denne kort i kulde — resten av vinduet dekkes av skifte-fasen i varmt tøy."
      : "Innendørs er dette mindre tidskritisk isolert sett.";
  }

  // ---------------- Schedule ----------------
  // Rekkefølge: Generell oppvarming -> Aktivering/mobilisering -> PRIMING -> [skifte + is-tid = overgang] -> Start
  // Overgangen (skifte + is-tid) er det forskningsbaserte vinduet, IKKE is-tiden alene.
  function computeSchedule(){
    const start = parseTime(state.raceStart);
    const tIceOut = start - state.ice;
    const tChangeStart = tIceOut - state.change;   // = slutten på priming
    const tPrimingStart = tChangeStart - state.priming;
    const tActivationStart = tPrimingStart - state.activation;
    const tWarmupStart = tActivationStart - state.general;
    const transitionTotal = state.change + state.ice; // priming -> start
    return { start, tIceOut, tChangeStart, tPrimingStart, tActivationStart, tWarmupStart, transitionTotal };
  }

  function render(){
    updateSliderVisuals();
    const s = computeSchedule();
    const band = TRANSITION_BAND;
    const ok = inBand(s.transitionTotal, band);

    // Big stat callout
    const callout = $("transitionCallout");
    callout.className = "stat-callout" + (ok ? "" : " bad");
    $("transitionBig").textContent = s.transitionTotal + " min";
    $("transitionDesc").textContent = ok
      ? `Innenfor anbefalt vindu fra priming til start (${band[0]}–${band[1]} min). Vinduet er det samme inne og ute.`
      : `⚠ Utenfor anbefalt vindu (${band[0]}–${band[1]} min). ${s.transitionTotal > band[1] ? "For lang pause svekker priming-effekten (O2-kinetikk/PAP rekker å avta)." : "For kort pause gir for lite restitusjon av fosfat/hydrogen-ion-balanse."}`;
    $("envAdvice").textContent = state.env === "outdoor"
      ? "I kulde: behold full lengde på vinduet, men skyv mest mulig av tiden over til skifte-fasen i varmt tøy — hold selve is-tiden kort."
      : "";

    // Rail — window sized to fit the actual schedule, with ticks every 15 min so the
    // labels are always at their true proportional position (not just evenly spaced text).
    const rawSpan = s.start - s.tWarmupStart;
    const totalWindow = Math.max(45, Math.ceil((rawSpan + 10) / 15) * 15);
    function pct(mins){
      const delta = s.start - mins;
      return 100 - Math.min(100, Math.max(0, (delta/totalWindow)*100));
    }
    const rail = $("rail");
    rail.innerHTML = "";
    // segment: priming end -> start, colored by band status
    const seg = document.createElement("div");
    seg.className = "seg";
    const pA = pct(s.tChangeStart), pB = pct(s.start);
    seg.style.left = Math.min(pA,pB) + "%";
    seg.style.width = Math.abs(pB-pA) + "%";
    seg.style.background = ok ? "rgba(52,211,153,0.55)" : "rgba(239,91,91,0.55)";
    rail.appendChild(seg);

    [s.tWarmupStart, s.tActivationStart, s.tPrimingStart, s.tChangeStart, s.tIceOut, s.start].forEach((m,i)=>{
      const marker = document.createElement("div");
      marker.className = "marker" + (i===5 ? " gun" : "");
      marker.style.left = pct(m) + "%";
      const dot = document.createElement("div"); dot.className = "dot";
      marker.appendChild(dot);
      rail.appendChild(marker);
    });

    const scale = $("railScale");
    scale.innerHTML = "";
    for(let t = 0; t <= totalWindow; t += 15){
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.style.left = pct(s.start - t) + "%";
      tick.textContent = t === 0 ? "0" : "−" + t;
      scale.appendChild(tick);
    }

    // Plan list
    const primingDesc = state.type === "sprint"
      ? "Kort, hard bolk nær eller over maks innsats (eksplosive drag/akselerasjoner). Trigger raskere O2-opptakskinetikk og nevromuskulær aktivering før start."
      : "Kort bolk opp mot terskel, mer submaksimal enn ved sprint (rolige oppkjøringsdrag). Målet er å heve baseline-VO2 uten å tømme energilagre.";

    const phases = [
      { t: s.tWarmupStart, name: "Generell oppvarming", desc: "Rolig jogg/sykkel — hever muskel- og kjernetemperatur (RAMP: «Raise»).", tag: null },
      { t: s.tActivationStart, name: "Aktivering / mobilisering", desc: "Dynamisk bevegelighet og teknikkdrill — ikke statisk tøying (RAMP: «Activate/Mobilize»).", tag: null },
      { t: s.tPrimingStart, name: "Priming", desc: primingDesc, tag: state.type === "sprint" ? "Sprint" : "Lange løp" },
      { t: s.tChangeStart, name: "Skifte til trikot / skøyter", desc: state.env === "outdoor" ? "Priming er nå avsluttet. I kulde: bli i varmt tøy så lenge som mulig av denne og neste fase." : "Priming er nå avsluttet — denne og neste fase utgjør sammen «hvileintervallet» ned mot start.", tag: null },
      { t: s.tIceOut, name: "Gå ut på isen", desc: state.env === "indoor" ? "Innendørs — mindre tidskritisk å stå lenge på isen før start." : "Utendørs/kaldt — hold denne korte for å unngå å miste kroppsvarme før start.", tag: null },
      { t: s.start, name: "Løpsstart", desc: "Klar.", tag: ok ? "good" : "warn", tagText: ok ? "Vindu OK" : "Utenfor vindu", gun: true }
    ];

    const list = $("planList");
    list.innerHTML = "";
    phases.forEach(p=>{
      const li = document.createElement("li");
      li.className = "plan-item" + (p.gun ? " gun" : "");
      let tagHtml = "";
      if(p.tag === "warn") tagHtml = `<span class="tag warn">${p.tagText}</span>`;
      else if(p.tag === "good") tagHtml = `<span class="tag good">${p.tagText}</span>`;
      else if(p.tag) tagHtml = `<span class="tag">${p.tag}</span>`;
      li.innerHTML = `<span class="t mono">${minutesToClock(p.t)}</span><span class="connector"></span>
        <span><span class="phase-name">${p.name}${tagHtml}</span><span class="phase-desc">${p.desc}</span></span>`;
      list.appendChild(li);
    });

    // Context note
    const noteBox = $("distanceNote");
    let note = "";
    if(state.type === "sprint"){
      note += "<strong>Under 4 min:</strong> grundig generell oppvarming ser ut til å telle ekstra mye her — ikke kutt ned på den generelle delen selv om selve løpet er kort. ";
    } else {
      note += "<strong>4 min eller mer:</strong> total oppvarmingstid rundt 25 minutter er vist å kunne gi bedre prestasjon — prioriter å bevare energi fremfor høy topp-intensitet i priming-bolken. Ved svært lange løp (5000/10000m): begrens høyintensivt arbeid i oppvarmingen til maks ca. 10 minutter samlet, for å ikke tappe glykogenlagre unødig. ";
    }
    if(state.env === "outdoor"){
      note += "<strong>Kulde:</strong> hele 9–20-minuttersvinduet gjelder fortsatt — flytt mest mulig av det til skifte-fasen i varmt tøy, og hold selve is-tiden kort.";
    } else {
      note += "<strong>Innendørs:</strong> hele vinduet 9–20 min er tilgjengelig — bruk det som passer din rutine best.";
    }
    noteBox.innerHTML = note;
  }

  // ---------------- Event wiring ----------------
  function applyDefaultsForCurrentSelection(){
    const base = {
      general: DEFAULTS[state.type].general,
      activation: DEFAULTS[state.type].activation,
      priming: DEFAULTS[state.type].priming,
      change: ENV_SPLIT[state.env].change,
      ice: ENV_SPLIT[state.env].ice
    };
    const saved = loadPreset();
    const values = saved || base;
    state.general = values.general; state.activation = values.activation; state.priming = values.priming;
    state.change = values.change; state.ice = values.ice;
    sliders.general.value = state.general;
    sliders.activation.value = state.activation;
    sliders.priming.value = state.priming;
    sliders.change.value = state.change;
    sliders.ice.value = state.ice;
  }

  typeToggle.addEventListener("click", e=>{
    const btn = e.target.closest(".toggle-btn");
    if(!btn) return;
    state.type = btn.dataset.type;
    setToggle(typeToggle, "type", state.type);
    applyDefaultsForCurrentSelection();
    $("presetStatus").textContent = "";
    render();
  });

  envToggle.addEventListener("click", e=>{
    const btn = e.target.closest(".toggle-btn");
    if(!btn) return;
    state.env = btn.dataset.env;
    setToggle(envToggle, "env", state.env);
    applyDefaultsForCurrentSelection();
    $("presetStatus").textContent = "";
    render();
  });

  $("savePresetBtn").addEventListener("click", ()=>{
    const ok = savePreset();
    $("presetStatus").textContent = ok
      ? `Lagret som standard for «${typeLabel(state.type)} / ${envLabel(state.env)}».`
      : "Kunne ikke lagre (localStorage utilgjengelig her — fungerer når siden er publisert).";
  });

  $("resetPresetBtn").addEventListener("click", ()=>{
    clearPreset();
    applyDefaultsForCurrentSelection();
    render();
    $("presetStatus").textContent = `Tilbakestilt til fabrikkverdier for «${typeLabel(state.type)} / ${envLabel(state.env)}».`;
  });

  raceStart.addEventListener("input", ()=>{ state.raceStart = raceStart.value || "00:00"; render(); });

  Object.entries(sliders).forEach(([key, el])=>{
    el.addEventListener("input", ()=>{ state[key] = +el.value; render(); });
  });

  $("applyCalc").addEventListener("click", ()=>{
    const session = parseTime($("sessionStart").value || "00:00");
    const pos = +$("pairNum").value || 1;
    const perPair = +$("pairTime").value || 0;
    const buffer = +$("falseStarts").value || 0;
    const quartet = +$("quartetExtra").value || 0;
    const est = session + (pos-1)*perPair + buffer + quartet;
    raceStart.value = minutesToClock(est);
    state.raceStart = raceStart.value;
    render();
  });

  // ---------------- Notifications: browser (tab open, tab or app in background) ----------------
  // Android Chrome/Vivaldi (and most mobile browsers) don't support the plain
  // `new Notification()` constructor — they require a Service Worker registration and
  // `registration.showNotification()` instead. We register a minimal service worker and
  // use that when available, falling back to the plain constructor on desktop browsers
  // that don't need one.
  let swRegistration = null;
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").then(reg => { swRegistration = reg; }).catch(()=>{});
  }

  $("notifBtn").addEventListener("click", async ()=>{
    const notifStatus = $("notifStatus");
    if(!("Notification" in window)){
      notifStatus.textContent = "Denne nettleseren støtter ikke varsler i det hele tatt — bruk kalenderfilen i stedet.";
      return;
    }
    const perm = await Notification.requestPermission();
    if(perm !== "granted"){ notifStatus.textContent = "Varsling ble ikke tillatt."; return; }

    let reg = swRegistration;
    if(!reg && "serviceWorker" in navigator){
      reg = await navigator.serviceWorker.ready.catch(()=>null);
    }

    const s = computeSchedule();
    const now = new Date();
    const base = new Date(new Date().toISOString().slice(0,10) + "T00:00:00");
    let scheduled = 0;
    [
      {m:s.tWarmupStart, label:"Start generell oppvarming"},
      {m:s.tActivationStart, label:"Gå i gang med aktivering/mobilisering"},
      {m:s.tPrimingStart, label:"Start priming-bolken"},
      {m:s.tChangeStart, label:"Skift til trikot/skøyter nå"},
      {m:s.tIceOut, label:"Gå ut på isen nå"},
      {m:s.start, label:"Løpsstart!"}
    ].forEach(ev=>{
      const target = new Date(base); target.setMinutes(ev.m);
      const ms = target - now;
      if(ms > 0){
        setTimeout(()=>{
          if(reg && reg.showNotification){
            reg.showNotification("Oppvarmingsplan", {body: ev.label});
          } else {
            try{ new Notification("Oppvarmingsplan", {body: ev.label}); }catch(e){ /* ingen støtte her */ }
          }
        }, ms);
        scheduled++;
      }
    });
    notifStatus.textContent = scheduled > 0
      ? `${scheduled} varsler planlagt. Hold fanen/appen åpen (kan ligge i bakgrunnen) frem til løpsstart.`
      : "Alle tidspunkt er allerede passert i dag — juster klokkeslettet.";
  });

  // ---------------- ICS export ----------------
  $("icsBtn").addEventListener("click", ()=>{
    const s = computeSchedule();
    const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
    function dt(mins){
      const h = Math.floor(((mins%1440)+1440)%1440/60);
      const m = Math.round(mins%60);
      return `${today}T${String(h).padStart(2,"0")}${String(Math.abs(m)).padStart(2,"0")}00`;
    }
    const events = [
      {m:s.tWarmupStart, title:"Start generell oppvarming"},
      {m:s.tActivationStart, title:"Aktivering / mobilisering"},
      {m:s.tPrimingStart, title:"Priming"},
      {m:s.tChangeStart, title:"Skifte til trikot/skøyter"},
      {m:s.tIceOut, title:"Gå ut på isen"},
      {m:s.start, title:"LØPSSTART"}
    ];
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Oppvarmingsplanlegger//NO\r\n";
    events.forEach((ev,i)=>{
      const startStr = dt(ev.m), endStr = dt(ev.m + 1);
      ics += "BEGIN:VEVENT\r\n";
      ics += `UID:oppvarming-${i}-${Date.now()}@planlegger\r\n`;
      ics += `DTSTAMP:${dt(s.start)}Z\r\n`;
      ics += `DTSTART:${startStr}\r\n`;
      ics += `DTEND:${endStr}\r\n`;
      ics += `SUMMARY:${ev.title}\r\n`;
      ics += "BEGIN:VALARM\r\nTRIGGER:-PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:" + ev.title + "\r\nEND:VALARM\r\n";
      ics += "END:VEVENT\r\n";
    });
    ics += "END:VCALENDAR\r\n";
    const blob = new Blob([ics], {type:"text/calendar"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "oppvarming.ics";
    a.click();
  });

  // ---------------- Init ----------------
  setToggle(typeToggle, "type", state.type);
  setToggle(envToggle, "env", state.env);
  applyDefaultsForCurrentSelection();
  render();

})();
