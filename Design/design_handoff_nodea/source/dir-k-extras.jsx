/* global React, K_T, K_Globals, K_Sidebar */

// DIRECTION K — extras pour la voie Sauge.
// Dark mode chaud (papier la nuit), états vides, composer ⌘K, vues Mood / Passages.
// Réutilise les tokens K_T et le composant K_Sidebar de dir-k.jsx.

const { useState: KX_useState, useEffect: KX_useEffect, useRef: KX_useRef } = React;

// — Tokens dark sauge (papier la nuit, pas tech-blue-black) -----------------
const KX_DARK = {
  bg:        '#1d1c18',
  bg2:       '#262520',
  ink:       '#ece9dc',
  inkSoft:   '#c5c2b3',
  muted:     '#7d7a6e',
  mutedSoft: '#4a4842',
  hair:      '#34322c',
  accent:    '#9bbf9f',
  accentSoft:'#2e3a30',
  accentDeep:'#bcd9bf',
  sync:      '#9bbf9f',
  sans:      '"Instrument Sans", "Inter", "SF Pro Text", system-ui, sans-serif',
  serif:     '"Instrument Serif", "Newsreader", Georgia, serif',
  mono:      '"JetBrains Mono", ui-monospace, monospace',
};

// Helper : on passe les tokens explicitement aux composants extras (pas via K_T()).
function KX_Globals({ t, ns }) {
  return (
    <style>{`
      @keyframes kx-fade-${ns} { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes kx-pulse-${ns} {
        0%   { box-shadow: 0 0 0 0 ${t.sync}80; }
        70%  { box-shadow: 0 0 0 6px ${t.sync}00; }
        100% { box-shadow: 0 0 0 0 ${t.sync}00; }
      }
      @keyframes kx-bar-${ns} { from { width: 0; } }
      @keyframes kx-cell-${ns} { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
      @keyframes kx-cursor-${ns} { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      @keyframes kx-overlay-${ns} { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kx-modal-${ns} { from { opacity: 0; transform: translateY(-12px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

      .kx-${ns} .kx-fade { animation: kx-fade-${ns} .42s cubic-bezier(.2,.7,.3,1) both; }
      .kx-${ns} .kx-side-item { display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: background .18s, transform .18s; font-size: 13.5px; color: ${t.inkSoft}; }
      .kx-${ns} .kx-side-item:hover { background: ${t.bg2}; transform: translateX(2px); }
      .kx-${ns} .kx-side-item[data-active="true"] { background: ${t.accent}; color: ${t.bg}; transform: none; font-weight: 600; }
      .kx-${ns} .kx-side-item[data-active="true"] .kx-side-count { color: ${t.bg}; opacity: .7; }
      .kx-${ns} .kx-side-count { font-size: 12px; color: ${t.muted}; font-variant-numeric: tabular-nums; }
      .kx-${ns} .kx-sync-dot { width: 7px; height: 7px; border-radius: 999px; background: ${t.sync}; animation: kx-pulse-${ns} 2.4s infinite; }
      .kx-${ns} .kx-link { color: ${t.accent}; cursor: pointer; transition: color .15s; }
      .kx-${ns} .kx-link:hover { color: ${t.accentDeep}; text-decoration: underline; }
      .kx-${ns} .kx-bar-fill { background: ${t.accent}; border-radius: 2px; animation: kx-bar-${ns} .9s cubic-bezier(.2,.7,.3,1) both; }
      .kx-${ns} .kx-cell { aspect-ratio: 1/1; border-radius: 2px; animation: kx-cell-${ns} .35s cubic-bezier(.2,.7,.3,1) both; }
      .kx-${ns} .kx-cursor::after { content: ''; display: inline-block; width: 1.5px; height: 1em; background: ${t.accent}; margin-left: 2px; vertical-align: text-bottom; animation: kx-cursor-${ns} 1s steps(1) infinite; }
      .kx-${ns} .kx-overlay { animation: kx-overlay-${ns} .25s cubic-bezier(.2,.7,.3,1) both; }
      .kx-${ns} .kx-modal { animation: kx-modal-${ns} .35s cubic-bezier(.2,.7,.3,1) both; }
      .kx-${ns} .kx-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 7px; border: 1px solid ${t.hair}; background: ${t.bg}; font-size: 14px; color: ${t.ink}; font-family: inherit; outline: none; transition: border-color .18s, box-shadow .18s; }
      .kx-${ns} .kx-input:focus { border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.accentSoft}; }
      .kx-${ns} .kx-btn { padding: 9px 16px; border-radius: 7px; border: 0; background: ${t.accent}; color: ${ns === 'dark' ? t.bg : '#fff'}; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .18s, transform .12s; }
      .kx-${ns} .kx-btn:hover { background: ${t.accentDeep}; }
      .kx-${ns} .kx-btn:active { transform: translateY(1px); }
    `}</style>
  );
}

// — Sidebar locale (utilise tokens locaux) ----------------------------------
function KX_Sidebar({ t, ns, active = 'today' }) {
  return (
    <aside style={{
      background: t.bg2, padding: '20px 12px',
      display: 'flex', flexDirection: 'column', gap: 2,
      borderRight: `1px solid ${t.hair}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 18px' }}>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: t.accent }}/>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, letterSpacing: '-0.01em' }}>Nodea</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>Alice</div>
      </div>

      {[
        { id: 'today',  l: 'Aujourd\'hui', n: '3'  },
        { id: 'mood',   l: 'Mood',        n: '116' },
        { id: 'pass',   l: 'Passages',    n: '42'  },
        { id: 'goals',  l: 'Goals',       n: '5'   },
        { id: 'habits', l: 'Habits',      n: '4'   },
      ].map((it) => (
        <div key={it.id} className="kx-side-item" data-active={it.id === active}>
          <span>{it.l}</span>
          <span className="kx-side-count">{it.n}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, padding: '20px 10px 6px', fontWeight: 600 }}>Library</div>
      {[
        { l: 'En cours', n: '3' }, { l: 'À lire', n: '14' }, { l: 'Terminés', n: '38' },
      ].map((it) => (
        <div key={it.l} className="kx-side-item">
          <span>{it.l}</span><span className="kx-side-count">{it.n}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, padding: '20px 10px 6px', fontWeight: 600 }}>Review</div>
      {[{ l: 'Cette semaine' }, { l: 'Ce mois' }, { l: 'L\'année' }].map((it) => (
        <div key={it.l} className="kx-side-item"><span>{it.l}</span></div>
      ))}

      <div style={{ flex: 1 }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 12, color: t.muted, borderTop: `1px solid ${t.hair}`, marginTop: 12 }}>
        <div className="kx-sync-dot"/>
        Synchronisé · à l'instant
      </div>
    </aside>
  );
}

// ================ 1. DARK MODE — Accueil + Mon compte ====================
function K_HomeDark() {
  const t = KX_DARK; const ns = 'dark';
  const [checked, setChecked] = KX_useState({ 0: true, 1: false, 2: false });

  return (
    <div className={`kx-${ns}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
    }}>
      <KX_Globals t={t} ns={ns}/>
      <KX_Sidebar t={t} ns={ns} active="today"/>

      <main className="kx-fade" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.hair}` }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: '0.02em' }}>samedi 25 avril 2025 · jour 116</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.hair}`, background: t.bg, fontSize: 12, color: t.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }}>⌘K&nbsp; Recherche</button>
            <button className="kx-btn" style={{ padding: '6px 14px', fontSize: 12 }}>+ Nouvelle entrée</button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '28px 36px 24px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 36 }}>
          <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: 30, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: t.ink }}>Bonjour, Alice.</h1>
            <div style={{ fontSize: 14, color: t.muted, marginTop: 4, marginBottom: 22 }}>Trois choses à voir aujourd'hui.</div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 6 }}>À voir</div>
              {[
                { l: 'Mood du jour saisi', m: 'note 7,8 · café, travail, marche' },
                { l: 'Lire 30 minutes',    m: 'Slow Productivity · p. 54 →' },
                { l: 'Marche du soir',     m: 'Habit · 12 jours d\'affilée' },
              ].map((row, i) => {
                const isChecked = checked[i];
                return (
                  <div key={row.l} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: `1px solid ${t.hair}` }}>
                    <div onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))}
                         style={{ width: 16, height: 16, flexShrink: 0, border: `1.5px solid ${isChecked ? t.accent : t.mutedSoft}`, background: isChecked ? t.accent : 'transparent', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(2px)', cursor: 'pointer', transition: 'all .2s' }}>
                      {isChecked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6.5l3 3 5-7" stroke={t.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, color: isChecked ? t.muted : t.ink, fontWeight: 500, textDecoration: isChecked ? 'line-through' : 'none' }}>{row.l}</div>
                      <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>{row.m}</div>
                    </div>
                    <div style={{ fontSize: 11, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{isChecked ? '08:42' : '—'}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 6 }}>Mood récent</div>
              <div style={{ fontSize: 17, lineHeight: 1.45, color: t.ink, fontFamily: t.serif, fontStyle: 'italic', marginTop: 6 }}>
                « Café tranquille avec Sam, fin du chantier client, longue marche au bord du canal.&nbsp;»
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 12, color: t.muted }}>
                <span style={{ color: t.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>7,8</span>
                <span>·</span><span>Café · Travail · Marche</span>
                <span style={{ marginLeft: 'auto' }}>il y a 2 h · <span className="kx-link">éditer</span></span>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 6 }}>Passage récent</div>
              <div style={{ fontFamily: t.serif, fontSize: 16, lineHeight: 1.5, color: t.ink, marginTop: 6 }}>
                « Le jour où j'ai compris que la lenteur n'était pas un défaut.&nbsp;»
              </div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>
                Slow Productivity, Cal Newport · p. 64 · <span className="kx-link">voir tous les passages</span>
              </div>
            </div>
          </section>

          <aside style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em' }}>Habits</div>
                <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>12 j</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 3 }}>
                {Array.from({ length: 60 }).map((_, i) => {
                  const v = (Math.sin(i * 1.7) + 1) / 2;
                  const c = v > 0.7 ? t.accent : v > 0.45 ? t.accentSoft : v > 0.2 ? t.bg2 : t.hair;
                  return <div key={i} className="kx-cell" style={{ background: c, animationDelay: (i * 6) + 'ms' }}/>;
                })}
              </div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>78 % ce mois</span><span style={{ color: t.sync, fontWeight: 600 }}>+6 % vs mars</span>
              </div>
            </section>

            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 8 }}>Intentions</div>
              {[
                { tt: 'Écrire 3× / semaine', p: 62 },
                { tt: 'Lire 24 livres',      p: 45 },
                { tt: 'Marcher 8 km / jour', p: 78 },
              ].map((g, i) => (
                <div key={g.tt} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: t.ink, marginBottom: 3 }}>
                    <span>{g.tt}</span>
                    <span style={{ color: t.muted, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{g.p}%</span>
                  </div>
                  <div style={{ height: 3, background: t.hair, borderRadius: 2, overflow: 'hidden' }}>
                    <div className="kx-bar-fill" style={{ width: g.p + '%', height: '100%', animationDelay: (200 + i * 120) + 'ms' }}/>
                  </div>
                </div>
              ))}
            </section>

            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 8 }}>En cours de lecture</div>
              {[
                { tt: 'Le Pavillon d\'Or', a: 'Mishima',     p: '64 / 248' },
                { tt: 'Slow Productivity',  a: 'Cal Newport', p: '54 / 244' },
              ].map((b) => (
                <div key={b.tt} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${t.hair}` }}>
                  <div>
                    <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>{b.tt}</div>
                    <div style={{ fontSize: 11, color: t.muted }}>{b.a}</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{b.p}</div>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ================ 2. ÉTAT VIDE — premier matin ===========================
function K_Empty() {
  const t = K_T('sauge'); const ns = 'empty';
  return (
    <div className={`kx-${ns}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
    }}>
      <KX_Globals t={t} ns={ns}/>
      <KX_Sidebar t={t} ns={ns} active="today"/>

      <main className="kx-fade" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.hair}` }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: '0.02em' }}>mardi 22 avril 2025 · jour 1</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.hair}`, background: t.bg, fontSize: 12, color: t.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }}>⌘K&nbsp; Recherche</button>
            <button className="kx-btn" style={{ padding: '6px 14px', fontSize: 12 }}>+ Nouvelle entrée</button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '92px 56px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: 640 }}>
          <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>Premier jour</div>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, marginBottom: 18, color: t.ink }}>
            Une page blanche.
          </h1>
          <div style={{ fontSize: 18, color: t.inkSoft, lineHeight: 1.55, marginBottom: 32, fontFamily: t.serif, fontStyle: 'italic' }}>
            Tu n'as encore rien écrit. C'est le bon endroit pour commencer.
            Une humeur, un passage, une intention — l'ordre n'a pas d'importance.
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 56 }}>
            <button className="kx-btn">Saisir mon premier mood</button>
            <button style={{ padding: '9px 16px', borderRadius: 7, border: `1px solid ${t.hair}`, background: 'transparent', color: t.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Faire le tour d'abord
            </button>
          </div>
          <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.7 }}>
            Astuce : <kbd style={{ padding: '1px 6px', borderRadius: 4, background: t.bg2, border: `1px solid ${t.hair}`, fontFamily: t.mono, fontSize: 11, color: t.inkSoft }}>⌘K</kbd> ouvre l'écriture rapide depuis n'importe où.
          </div>
        </div>
      </main>
    </div>
  );
}

// ================ 3. COMPOSER ⌘K (overlay sur l'accueil) =================
function K_Composer() {
  const t = K_T('sauge'); const ns = 'composer';
  const [text, setText] = KX_useState("Long appel client ce matin, tendu mais utile. Reste l'envie de marcher.");
  const [type, setType] = KX_useState('mood');
  return (
    <div className={`kx-${ns}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`, position: 'relative',
    }}>
      <KX_Globals t={t} ns={ns}/>
      <KX_Sidebar t={t} ns={ns} active="today"/>

      {/* Faux contenu en dessous */}
      <main style={{ filter: 'blur(2px)', opacity: 0.4, pointerEvents: 'none', padding: '28px 36px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', margin: 0 }}>Bonjour, Alice.</h1>
        <div style={{ fontSize: 14, color: t.muted, marginTop: 4 }}>Trois choses à voir aujourd'hui.</div>
      </main>

      {/* Overlay */}
      <div className="kx-overlay" style={{
        position: 'absolute', inset: 0, background: 'rgba(22, 22, 20, 0.32)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 130,
      }}>
        <div className="kx-modal" style={{
          width: 620, background: t.bg, borderRadius: 12,
          border: `1px solid ${t.hair}`, boxShadow: '0 24px 60px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08)',
          overflow: 'hidden',
        }}>
          {/* Type picker minimal */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
            {[
              { id: 'mood',  l: 'Mood' },
              { id: 'pass',  l: 'Passage' },
              { id: 'goal',  l: 'Goal' },
              { id: 'habit', l: 'Habit' },
              { id: 'note',  l: 'Note libre' },
            ].map((it) => (
              <button key={it.id} onClick={() => setType(it.id)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit',
                border: 0, background: type === it.id ? t.accentSoft : 'transparent',
                color: type === it.id ? t.accentDeep : t.muted, fontWeight: type === it.id ? 600 : 500,
                cursor: 'pointer', transition: 'all .15s',
              }}>{it.l}</button>
            ))}
          </div>

          {/* Champ principal */}
          <div style={{ padding: '14px 22px 4px' }}>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 90, resize: 'none',
                border: 0, outline: 0, background: 'transparent',
                fontFamily: t.serif, fontSize: 19, lineHeight: 1.5, color: t.ink,
              }}
            />
          </div>

          {/* Métadonnées contextuelles selon le type */}
          {type === 'mood' && (
            <div style={{ padding: '0 22px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>Note</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <div key={n} style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: n <= 7 ? t.accent : t.bg2,
                    fontSize: 11, fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                    color: n <= 7 ? '#fff' : t.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}>{n}</div>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {['café', 'travail', 'marche', '+ tag'].map((tg, i) => (
                  <span key={tg} style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 999,
                    background: i === 3 ? 'transparent' : t.bg2,
                    color: i === 3 ? t.muted : t.inkSoft,
                    border: i === 3 ? `1px dashed ${t.hair}` : 0,
                    cursor: 'pointer',
                  }}>{tg}</span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.hair}`, background: t.bg2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: t.muted, alignItems: 'center' }}>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 3, background: t.bg, border: `1px solid ${t.hair}`, fontFamily: t.mono, fontSize: 10 }}>↵</kbd> envoyer</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 3, background: t.bg, border: `1px solid ${t.hair}`, fontFamily: t.mono, fontSize: 10 }}>esc</kbd> annuler</span>
              <span style={{ marginLeft: 8 }}>chiffré localement</span>
            </div>
            <button className="kx-btn" style={{ padding: '6px 14px', fontSize: 12 }}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================ 4. MOOD — vue détail ====================================
function K_Mood() {
  const t = K_T('sauge'); const ns = 'mood';
  const moods = [
    { d: 'Aujourd\'hui',          n: 7.8, q: 'Café tranquille avec Sam, fin du chantier client, longue marche au bord du canal.', tags: 'café · travail · marche' },
    { d: 'Hier',                  n: 6.2, q: 'Mauvais sommeil, tête lourde toute la matinée. Mieux après la pluie.',                tags: 'fatigue · pluie · lecture' },
    { d: 'Mardi 22 avril',        n: 8.4, q: 'Anniversaire de Léa, dîner long. Riz brûlé, fou rire.',                                tags: 'famille · soir' },
    { d: 'Lundi 21 avril',        n: 5.9, q: 'Reprise difficile. Trop de Slack, pas assez d\'air.',                                  tags: 'travail · saturé' },
    { d: 'Dimanche 20 avril',     n: 8.1, q: 'Marché au matin, sieste, livre commencé puis abandonné.',                              tags: 'repos · marché' },
    { d: 'Samedi 19 avril',       n: 7.0, q: 'Course longue dans le bois. Genou un peu raide.',                                      tags: 'sport · bois' },
    { d: 'Vendredi 18 avril',     n: 6.5, q: 'Dîner annulé, finalement préféré rester chez moi.',                                    tags: 'solo · cuisine' },
  ];

  return (
    <div className={`kx-${ns}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
    }}>
      <KX_Globals t={t} ns={ns}/>
      <KX_Sidebar t={t} ns={ns} active="mood"/>

      <main className="kx-fade" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 36px', borderBottom: `1px solid ${t.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: t.muted }}>Mood · 116 entrées</div>
          <button className="kx-btn" style={{ padding: '6px 14px', fontSize: 12 }}>+ Nouvelle entrée</button>
        </div>

        <div style={{ flex: 1, padding: '28px 36px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 36 }}>
          <section style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', margin: 0 }}>Mood</h1>
            <div style={{ fontSize: 14, color: t.muted, marginTop: 4, marginBottom: 24 }}>116 entrées · moyenne mobile <span style={{ color: t.ink, fontWeight: 600 }}>7,2</span> sur 30 j</div>

            {/* Mini chart 30 j */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 4, alignItems: 'end', height: 60, marginBottom: 28 }}>
              {Array.from({ length: 30 }).map((_, i) => {
                const v = 4 + (Math.sin(i * 0.6) + 1) * 2.5;
                const h = (v / 10) * 100;
                const isToday = i === 29;
                return <div key={i} style={{ height: h + '%', background: isToday ? t.accent : t.accentSoft, borderRadius: 2, transition: 'background .2s' }}/>;
              })}
            </div>

            {/* Liste */}
            <div style={{ overflow: 'auto', minHeight: 0, paddingRight: 4 }}>
              {moods.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 36px 1fr', gap: 16, alignItems: 'baseline', padding: '14px 0', borderBottom: `1px solid ${t.hair}` }}>
                  <div style={{ fontSize: 12, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{m.d}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: m.n >= 7 ? t.accentDeep : m.n >= 6 ? t.inkSoft : t.muted,
                  }}>{m.n.toString().replace('.', ',')}</div>
                  <div>
                    <div style={{ fontFamily: t.serif, fontSize: 15, fontStyle: 'italic', lineHeight: 1.45, color: t.ink }}>« {m.q}&nbsp;»</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{m.tags}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 10 }}>Filtres</div>
              {['café','travail','marche','famille','soir','repos','sport','bois','cuisine','fatigue'].map((tg, i) => (
                <span key={tg} style={{
                  display: 'inline-block', fontSize: 12, padding: '4px 10px', margin: '0 4px 6px 0',
                  borderRadius: 999, background: i === 0 ? t.accent : t.bg2,
                  color: i === 0 ? '#fff' : t.inkSoft, cursor: 'pointer',
                }}>{tg}</span>
              ))}
            </section>

            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 10 }}>Patterns</div>
              {[
                { l: 'Tu es plus heureuse les samedis',  d: '+1,4 vs moyenne' },
                { l: 'Café & marche corrèlent',           d: 'r = 0,42' },
                { l: 'Lundi est ton point bas',           d: '−1,1 vs moyenne' },
              ].map((p) => (
                <div key={p.l} style={{ padding: '10px 0', borderBottom: `1px solid ${t.hair}` }}>
                  <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>{p.l}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{p.d}</div>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ================ 5. PASSAGES — liste groupée par livre ===================
function K_Passages() {
  const t = K_T('sauge'); const ns = 'passages';
  const groups = [
    {
      book: 'Slow Productivity', author: 'Cal Newport', year: 2024, count: 8,
      passages: [
        { p: 64, q: 'Le jour où j\'ai compris que la lenteur n\'était pas un défaut.', d: 'il y a 2 j' },
        { p: 41, q: 'Faire moins de choses, mieux. La discipline du retrait.',           d: 'il y a 4 j' },
        { p: 22, q: 'Le travail profond n\'est pas un luxe, c\'est une condition.',      d: 'il y a 1 sem.' },
      ],
    },
    {
      book: 'Le Pavillon d\'Or', author: 'Yukio Mishima', year: 1956, count: 5,
      passages: [
        { p: 188, q: 'La beauté indifférente est plus cruelle que la laideur.',          d: 'il y a 1 j' },
        { p: 92,  q: 'Je voulais qu\'il brûle pour cesser de me rendre faible.',         d: 'il y a 5 j' },
      ],
    },
    {
      book: 'Bouvard et Pécuchet', author: 'Flaubert', year: 1881, count: 3,
      passages: [
        { p: 210, q: 'Ils ne pouvaient s\'empêcher d\'apprendre, ni de tout désapprendre aussitôt.', d: 'il y a 2 sem.' },
      ],
    },
  ];

  return (
    <div className={`kx-${ns}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
    }}>
      <KX_Globals t={t} ns={ns}/>
      <KX_Sidebar t={t} ns={ns} active="pass"/>

      <main className="kx-fade" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 36px', borderBottom: `1px solid ${t.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: t.muted }}>Passages · 42 extraits · 9 livres</div>
          <button className="kx-btn" style={{ padding: '6px 14px', fontSize: 12 }}>+ Nouveau passage</button>
        </div>

        <div style={{ flex: 1, padding: '28px 36px', overflow: 'auto' }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, marginBottom: 4 }}>Passages</h1>
          <div style={{ fontSize: 14, color: t.muted, marginBottom: 32 }}>Ce qui mérite d'être relu.</div>

          {groups.map((g) => (
            <div key={g.book} style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${t.hair}` }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, letterSpacing: '-0.015em' }}>{g.book}</div>
                <div style={{ fontSize: 13, color: t.inkSoft, fontStyle: 'italic', fontFamily: t.serif }}>{g.author}</div>
                <div style={{ fontSize: 12, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{g.year}</div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: t.muted }}>{g.count} passages · <span className="kx-link">tout voir</span></div>
              </div>
              {g.passages.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px', gap: 18, alignItems: 'baseline', padding: '14px 0', borderBottom: `1px solid ${t.hair}` }}>
                  <div style={{ fontSize: 12, color: t.muted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>p. {p.p}</div>
                  <div style={{ fontFamily: t.serif, fontSize: 17, lineHeight: 1.5, color: t.ink }}>« {p.q}&nbsp;»</div>
                  <div style={{ fontSize: 11, color: t.muted, textAlign: 'right' }}>{p.d}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

window.DirK_HomeDark  = K_HomeDark;
window.DirK_Empty     = K_Empty;
window.DirK_Composer  = K_Composer;
window.DirK_Mood      = K_Mood;
window.DirK_Passages  = K_Passages;
