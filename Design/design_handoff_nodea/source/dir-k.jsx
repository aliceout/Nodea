/* global React */

// DIRECTION K — Native-app dense (Things 3 / Bear / Reflect / Apple Notes).
//
// Aucun chrome décoratif : pas de cartes, pas de borders sur les sections,
// pas d'icônes décoratives. La hiérarchie vient des marges, du poids de
// la typo et de quelques couleurs ponctuelles.
//
// Trois tons de vert : sauge (sourd, herbeux), forêt (profond, dense), olive
// (chaud, doré). + animations subtiles (fade par rangée, hover lift, pulse
// du dot synchro, transition d'onglet).

const { useState, useEffect, useRef } = React;

// — Tokens partagés (typo + neutres) ----------------------------------------
const K_BASE = {
  bg:        '#fcfcfa',
  bg2:       '#f5f4f0',
  ink:       '#161614',
  inkSoft:   '#3a3a36',
  muted:     '#88857c',
  mutedSoft: '#bcb9b0',
  hair:      '#e7e5dd',
  sans:      '"Instrument Sans", "Inter", "SF Pro Text", system-ui, sans-serif',
  serif:     '"Instrument Serif", "Newsreader", Georgia, serif',
  mono:      '"JetBrains Mono", ui-monospace, monospace',
};

// — Tons de vert -------------------------------------------------------------
// sauge   : vert herbeux sourd, presque gris-vert. Calme, papier.
// forêt   : vert profond, presque noir. Confiance, densité.
// olive   : vert chaud, doré, légèrement ocre. Inattendu, rare en SaaS.
const K_TONES = {
  sauge: {
    accent:     '#5a7a5e',
    accentSoft: '#dde8de',
    accentDeep: '#3d5641',
    sync:       '#7a9a7e',
  },
  foret: {
    accent:     '#0f5132',
    accentSoft: '#d4e5dc',
    accentDeep: '#073822',
    sync:       '#2d8659',
  },
  olive: {
    accent:     '#7a8542',
    accentSoft: '#e8e7c8',
    accentDeep: '#5a6230',
    sync:       '#a3b05c',
  },
};

const K_T = (tone = 'sauge') => ({ ...K_BASE, ...K_TONES[tone] });

function K_Globals({ tone = 'sauge' }) {
  const t = K_T(tone);
  return (
    <style>{`
      @keyframes k-fade-${tone} { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes k-slide-${tone} { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes k-pulse-${tone} {
        0%   { box-shadow: 0 0 0 0 ${t.sync}80; }
        70%  { box-shadow: 0 0 0 6px ${t.sync}00; }
        100% { box-shadow: 0 0 0 0 ${t.sync}00; }
      }
      @keyframes k-bar-${tone} { from { width: 0; } }
      @keyframes k-cell-${tone} { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
      @keyframes k-streak-${tone} { 0%,100% { opacity: 1; } 50% { opacity: .55; } }

      .k-${tone} .k-fade { animation: k-fade-${tone} .42s cubic-bezier(.2,.7,.3,1) both; }
      .k-${tone} .k-row { display: flex; align-items: baseline; gap: 12px; padding: 9px 0; border-bottom: 1px solid ${t.hair}; animation: k-slide-${tone} .45s cubic-bezier(.2,.7,.3,1) both; }
      .k-${tone} .k-row:last-child { border-bottom: 0; }
      .k-${tone} .k-row:hover .k-row-title { color: ${t.accentDeep}; }
      .k-${tone} .k-row-title { transition: color .18s; }

      .k-${tone} .k-side-item { display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: background .18s, color .18s, transform .18s; font-size: 13.5px; color: ${t.inkSoft}; }
      .k-${tone} .k-side-item:hover { background: ${t.bg2}; transform: translateX(2px); }
      .k-${tone} .k-side-item[data-active="true"] { background: ${t.accent}; color: #fff; transform: none; }
      .k-${tone} .k-side-item[data-active="true"] .k-side-count { color: rgba(255,255,255,0.82); }
      .k-${tone} .k-side-count { font-size: 12px; color: ${t.muted}; font-variant-numeric: tabular-nums; }

      .k-${tone} .k-tab { padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; color: ${t.muted}; border: 0; background: transparent; font-family: inherit; transition: background .18s, color .18s; }
      .k-${tone} .k-tab:hover { color: ${t.ink}; background: ${t.bg2}; }
      .k-${tone} .k-tab[data-active="true"] { color: ${t.ink}; background: ${t.bg2}; font-weight: 600; }

      .k-${tone} .k-link { color: ${t.accent}; cursor: pointer; transition: color .15s; }
      .k-${tone} .k-link:hover { color: ${t.accentDeep}; text-decoration: underline; }

      .k-${tone} .k-sync-dot { width: 7px; height: 7px; border-radius: 999px; background: ${t.sync}; animation: k-pulse-${tone} 2.4s infinite; }

      .k-${tone} .k-check { width: 16px; height: 16px; flex-shrink: 0; border: 1.5px solid ${t.mutedSoft}; border-radius: 999px; display: flex; align-items: center; justify-content: center; transform: translateY(2px); cursor: pointer; transition: border-color .2s, background .2s, transform .2s; }
      .k-${tone} .k-check:hover { border-color: ${t.accent}; transform: translateY(2px) scale(1.1); }
      .k-${tone} .k-check[data-checked="true"] { border-color: ${t.accent}; background: ${t.accent}; }

      .k-${tone} .k-bar-fill { background: ${t.accent}; border-radius: 2px; animation: k-bar-${tone} .9s cubic-bezier(.2,.7,.3,1) both; }

      .k-${tone} .k-cell { aspect-ratio: 1/1; border-radius: 2px; animation: k-cell-${tone} .35s cubic-bezier(.2,.7,.3,1) both; }

      .k-${tone} .k-streak-num { animation: k-streak-${tone} 2.6s ease-in-out infinite; }

      .k-${tone} .k-btn-primary { padding: 11px 0; border-radius: 7px; border: 0; background: ${t.accent}; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .18s, transform .12s; }
      .k-${tone} .k-btn-primary:hover { background: ${t.accentDeep}; }
      .k-${tone} .k-btn-primary:active { transform: translateY(1px); }

      .k-${tone} .k-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 7px; border: 1px solid ${t.hair}; background: ${t.bg}; font-size: 14px; color: ${t.ink}; font-family: inherit; outline: none; transition: border-color .18s, box-shadow .18s; }
      .k-${tone} .k-input:focus { border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.accentSoft}; }
    `}</style>
  );
}

function K_Sidebar({ tone = 'sauge', active = 'today' }) {
  const t = K_T(tone);
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
        <div key={it.id} className="k-side-item" data-active={it.id === active}>
          <span>{it.l}</span>
          <span className="k-side-count">{it.n}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, padding: '20px 10px 6px', fontWeight: 600 }}>
        Library
      </div>
      {[
        { l: 'En cours',  n: '3'  },
        { l: 'À lire',    n: '14' },
        { l: 'Terminés',  n: '38' },
      ].map((it) => (
        <div key={it.l} className="k-side-item">
          <span>{it.l}</span>
          <span className="k-side-count">{it.n}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, padding: '20px 10px 6px', fontWeight: 600 }}>
        Review
      </div>
      {[{ l: 'Cette semaine' }, { l: 'Ce mois' }, { l: 'L\'année' }].map((it) => (
        <div key={it.l} className="k-side-item">
          <span>{it.l}</span>
        </div>
      ))}

      <div style={{ flex: 1 }}/>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', fontSize: 12, color: t.muted,
        borderTop: `1px solid ${t.hair}`, marginTop: 12,
      }}>
        <div className="k-sync-dot"/>
        Synchronisé · à l'instant
      </div>
    </aside>
  );
}

function K_Home({ tone = 'sauge' }) {
  const t = K_T(tone);
  const [checked, setChecked] = useState({ 0: true, 1: false, 2: false });

  return (
    <div className={`k-${tone}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
    }}>
      <K_Globals tone={tone}/>
      <K_Sidebar tone={tone} active="today"/>

      <main className="k-fade" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${t.hair}`,
        }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: '0.02em' }}>
            samedi 25 avril 2025 · jour 116
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.hair}`, background: t.bg, fontSize: 12, color: t.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }}>
              ⌘K&nbsp; Recherche
            </button>
            <button className="k-btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
              + Nouvelle entrée
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '28px 36px 24px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 36 }}>
          <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h1 style={{ fontSize: 30, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: t.ink }}>
              Bonjour, Alice.
            </h1>
            <div style={{ fontSize: 14, color: t.muted, marginTop: 4, marginBottom: 22 }}>
              Trois choses à voir aujourd'hui.
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 6 }}>À voir</div>
              {[
                { l: 'Mood du jour saisi',  m: 'note 7,8 · café, travail, marche' },
                { l: 'Lire 30 minutes',     m: 'Slow Productivity · p. 54 →' },
                { l: 'Marche du soir',      m: 'Habit · 12 jours d\'affilée' },
              ].map((row, i) => {
                const isChecked = checked[i];
                return (
                  <div key={row.l} className="k-row" style={{ animationDelay: (i * 80) + 'ms' }}>
                    <div className="k-check" data-checked={isChecked} onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))}>
                      {isChecked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6.5l3 3 5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="k-row-title" style={{ fontSize: 14.5, color: isChecked ? t.muted : t.ink, fontWeight: 500, textDecoration: isChecked ? 'line-through' : 'none', transition: 'color .2s, text-decoration .2s' }}>
                        {row.l}
                      </div>
                      <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>{row.m}</div>
                    </div>
                    <div style={{ fontSize: 11, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{isChecked ? '08:42' : '—'}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 6 }}>Mood récent</div>
              <div style={{ padding: '6px 0' }}>
                <div style={{ fontSize: 17, lineHeight: 1.45, color: t.ink, fontFamily: t.serif, fontStyle: 'italic' }}>
                  « Café tranquille avec Sam, fin du chantier client, longue marche au bord du canal.&nbsp;»
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 12, color: t.muted }}>
                  <span style={{ color: t.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>7,8</span>
                  <span>·</span>
                  <span>Café · Travail · Marche</span>
                  <span style={{ marginLeft: 'auto' }}>il y a 2 h · <span className="k-link">éditer</span></span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 6 }}>Passage récent</div>
              <div style={{ padding: '6px 0' }}>
                <div style={{ fontFamily: t.serif, fontSize: 16, lineHeight: 1.5, color: t.ink }}>
                  « Le jour où j'ai compris que la lenteur n'était pas un défaut.&nbsp;»
                </div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>
                  Slow Productivity, Cal Newport · p. 64 · <span className="k-link">voir tous les passages</span>
                </div>
              </div>
            </div>
          </section>

          <aside style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em' }}>Habits</div>
                <div className="k-streak-num" style={{ fontSize: 12, color: t.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>12 j</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 3 }}>
                {Array.from({ length: 60 }).map((_, i) => {
                  const v = (Math.sin(i * 1.7) + 1) / 2;
                  const c = v > 0.7 ? t.accent : v > 0.45 ? t.accentSoft : v > 0.2 ? t.bg2 : t.hair;
                  return <div key={i} className="k-cell" style={{ background: c, animationDelay: (i * 6) + 'ms' }}/>;
                })}
              </div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>78 % ce mois</span><span style={{ color: t.sync, fontWeight: 600 }}>+6 % vs mars</span>
              </div>
            </section>

            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 8 }}>Intentions</div>
              {[
                { t: 'Écrire 3× / semaine', p: 62 },
                { t: 'Lire 24 livres',       p: 45 },
                { t: 'Marcher 8 km / jour',  p: 78 },
              ].map((g, i) => (
                <div key={g.t} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: t.ink, marginBottom: 3 }}>
                    <span>{g.t}</span>
                    <span style={{ color: t.muted, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{g.p}%</span>
                  </div>
                  <div style={{ height: 3, background: t.hair, borderRadius: 2, overflow: 'hidden' }}>
                    <div className="k-bar-fill" style={{ width: g.p + '%', height: '100%', animationDelay: (200 + i * 120) + 'ms' }}/>
                  </div>
                </div>
              ))}
            </section>

            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: '0.02em', marginBottom: 8 }}>En cours de lecture</div>
              {[
                { t: 'Le Pavillon d\'Or',  a: 'Mishima',     p: '64 / 248' },
                { t: 'Slow Productivity',   a: 'Cal Newport', p: '54 / 244' },
              ].map((b) => (
                <div key={b.t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${t.hair}` }}>
                  <div>
                    <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>{b.t}</div>
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

function K_Login({ tone = 'sauge' }) {
  const t = K_T(tone);
  return (
    <div className={`k-${tone}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
      display: 'grid', gridTemplateColumns: '1fr 480px',
    }}>
      <K_Globals tone={tone}/>
      <div style={{
        padding: '64px 72px',
        background: t.bg2,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        borderRight: `1px solid ${t.hair}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: t.accent }}/>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, letterSpacing: '-0.01em' }}>Nodea</div>
        </div>

        <div className="k-fade">
          <h1 style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 600, margin: 0, marginBottom: 18, color: t.ink }}>
            Te revoilà.
          </h1>
          <div style={{ fontSize: 18, color: t.inkSoft, lineHeight: 1.5, maxWidth: 460 }}>
            Un carnet privé, hébergé par toi. Mood, passages, goals, habits, library, review —
            chiffrés bout en bout, jamais visibles côté serveur.
          </div>
        </div>

        <div style={{ fontSize: 12, color: t.muted, display: 'flex', gap: 14 }}>
          <span>Chiffré bout en bout</span>
          <span>·</span>
          <span>Auto-hébergé</span>
          <span>·</span>
          <span>AGPL-3.0</span>
        </div>
      </div>

      <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="k-fade" style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>Connexion</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: t.ink, letterSpacing: '-0.02em', marginBottom: 28 }}>
            Entre dans ton carnet
          </div>
          {[
            { l: 'E-mail', v: 'alice@nodea.fr', type: 'text' },
            { l: 'Mot de passe', v: '•••••••••••', type: 'password' },
          ].map((f) => (
            <div key={f.l} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: t.muted, marginBottom: 5, fontWeight: 500 }}>{f.l}</div>
              <input className="k-input" type={f.type} defaultValue={f.v}/>
            </div>
          ))}
          <button className="k-btn-primary" style={{ width: '100%', marginTop: 8 }}>Entrer</button>
          <div style={{ marginTop: 18, fontSize: 12.5, color: t.muted, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ cursor: 'pointer' }}>Mot de passe oublié</span>
            <span><span className="k-link">Créer un compte</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function K_Account({ tone = 'sauge' }) {
  const t = K_T(tone);
  const [tab, setTab] = useState('identity');

  return (
    <div className={`k-${tone}`} style={{
      width: 1280, height: 800, background: t.bg, color: t.ink,
      fontFamily: t.sans, display: 'grid', gridTemplateColumns: '240px 1fr',
      overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.hair}`,
    }}>
      <K_Globals tone={tone}/>
      <K_Sidebar tone={tone} active="today"/>
      <main className="k-fade" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 36px', borderBottom: `1px solid ${t.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: t.muted }}>Paramètres · Mon compte</div>
        </div>
        <div style={{ padding: '24px 36px 8px', borderBottom: `1px solid ${t.hair}`, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', margin: 0 }}>Mon compte</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'identity', l: 'Identité' },
              { id: 'security', l: 'Sécurité' },
              { id: 'data',     l: 'Données' },
              { id: 'danger',   l: 'Zone rouge' },
            ].map((tt) => (
              <button key={tt.id} className="k-tab" data-active={tab === tt.id} onClick={() => setTab(tt.id)}>{tt.l}</button>
            ))}
          </div>
        </div>

        <div key={tab} style={{ flex: 1, padding: '28px 36px', overflow: 'hidden' }}>
          {tab === 'identity' && (
            <div className="k-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 56, maxWidth: 880 }}>
              <div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 18, lineHeight: 1.5 }}>
                  Les seules infos qui te suivent d'un appareil à l'autre.
                </div>
                {[
                  { l: 'Nom d\'affichage', v: 'Alice' },
                  { l: 'Adresse e-mail',   v: 'alice@nodea.fr' },
                ].map((f) => (
                  <div key={f.l} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 5, fontWeight: 500 }}>{f.l}</div>
                    <input className="k-input" defaultValue={f.v}/>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="k-btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>Enregistrer</button>
                  <button style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${t.hair}`, background: 'transparent', color: t.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: t.muted, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 10 }}>En chiffres</div>
                <div style={{ padding: '10px 0', borderTop: `1px solid ${t.hair}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: t.inkSoft }}>Entrées chiffrées</span>
                  <span style={{ fontSize: 13, color: t.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>428</span>
                </div>
                <div style={{ padding: '10px 0', borderTop: `1px solid ${t.hair}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: t.inkSoft }}>Série habits</span>
                  <span className="k-streak-num" style={{ fontSize: 13, color: t.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>12 j</span>
                </div>
                <div style={{ padding: '10px 0', borderTop: `1px solid ${t.hair}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: t.inkSoft }}>Membre depuis</span>
                  <span style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>mars 2024</span>
                </div>
              </div>
            </div>
          )}
          {tab === 'security' && (
            <div className="k-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, maxWidth: 880 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, marginBottom: 4 }}>Mot de passe</div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 18, lineHeight: 1.55 }}>Re-dérive ta clé. L'admin n'a jamais ta clé.</div>
                {[{ l: 'Actuel', v: '••••••••' }, { l: 'Nouveau', v: '' }].map((f) => (
                  <div key={f.l} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 5, fontWeight: 500 }}>{f.l}</div>
                    <input className="k-input" type="password" defaultValue={f.v}/>
                  </div>
                ))}
                <button className="k-btn-primary" style={{ marginTop: 8, padding: '8px 16px', fontSize: 13 }}>Renouveler la clé</button>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, marginBottom: 12 }}>Sessions actives · 2</div>
                {[
                  { d: 'MacBook Pro · Paris', tt: 'maintenant', current: true },
                  { d: 'iPhone 14 · Paris',   tt: 'il y a 1 j',  current: false },
                ].map((s) => (
                  <div key={s.d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.hair}` }}>
                    <div>
                      <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>{s.d}</div>
                      <div style={{ fontSize: 11, color: t.muted }}>{s.tt}</div>
                    </div>
                    {s.current
                      ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: t.accentSoft, color: t.accentDeep, fontWeight: 600 }}>Actuelle</span>
                      : <button style={{ fontSize: 12, color: t.muted, background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>Déconnecter</button>}
                  </div>
                ))}
                <div style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, marginBottom: 4 }}>2FA</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 10, lineHeight: 1.5 }}>Application TOTP, une couche en plus.</div>
                  <button style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${t.hair}`, background: 'transparent', color: t.ink, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Activer</button>
                </div>
              </div>
            </div>
          )}
          {tab === 'data' && (
            <div className="k-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, maxWidth: 880 }}>
              <div>
                <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 6 }}>Exporter</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: t.ink, marginBottom: 6, letterSpacing: '-0.02em' }}>Tout emporter.</div>
                <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.55, marginBottom: 14 }}>JSON déchiffré, généré chez toi. Ne quitte jamais ton navigateur.</div>
                <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>428 entrées · ~ 1,4 Mo</div>
                <button className="k-btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>Exporter mes données</button>
              </div>
              <div>
                <div style={{ fontSize: 12, color: t.muted, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 6 }}>Importer</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: t.ink, marginBottom: 6, letterSpacing: '-0.02em' }}>Reprendre un export.</div>
                <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.55, marginBottom: 14 }}>JSON ou NDJSON exporté précédemment. Doublons ignorés.</div>
                <div style={{ border: `1.5px dashed ${t.hair}`, borderRadius: 8, padding: '22px 14px', fontSize: 13, color: t.muted, textAlign: 'center' }}>
                  Glisse un fichier ici, ou <span className="k-link">choisis-le</span>.
                </div>
              </div>
            </div>
          )}
          {tab === 'danger' && (
            <div className="k-fade" style={{ maxWidth: 540 }}>
              <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, letterSpacing: '0.02em', marginBottom: 6 }}>Définitif</div>
              <div style={{ fontSize: 26, fontWeight: 600, color: t.ink, marginBottom: 8, letterSpacing: '-0.025em' }}>Pas de retour.</div>
              <div style={{ fontSize: 14, color: t.inkSoft, lineHeight: 1.55, marginBottom: 22 }}>
                La suppression efface toutes tes entrées chiffrées, sessions et invitations.
                Aucune récupération possible — pense à exporter avant.
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: t.muted, marginBottom: 5, fontWeight: 500 }}>Tape ton e-mail pour confirmer</div>
                <input className="k-input"/>
              </div>
              <button style={{ padding: '9px 18px', borderRadius: 7, border: 0, background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer définitivement
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

window.DirK_Login = K_Login;
window.DirK_Home = K_Home;
window.DirK_Account = K_Account;
