/* ---- Cross-sections. 'rect': flat bottom of width b, vertical walls.
   'cyc': inverted cycloid arch spanning the width b (r = b/2π, depth 2r, vertical cusps at the rims),
          continued upward by vertical walls. Water level h measured from the lowest point.
   Arch (φ ∈ [0, 2π]): z = r(φ − sin φ) − πr ,  ζ = r(1 + cos φ).
   Wetted from φ1 to 2π−φ1 with cos φ1 = h/r − 1:
     A = r[(h−r)(I0 − Ic) − r Ic + r Ic2],  I0 = 2(π−φ1), Ic = −2 sin φ1, Ic2 = (π−φ1) − sin(2φ1)/2
     P = 8r cos(φ1/2),  T = r(2π − 2φ1 + 2 sin φ1)
   Above the rims (h > 2r): A = 3πr² + b(h−2r), P = 8r + 2(h−2r), T = b.                         ---- */
function cycTrough(h, r, alpha){
  // part of a true cycloid arch (generating radius r), φ ∈ [π−α, π+α]; α = π is the full arch
  const al = alpha===undefined ? Math.PI : alpha, hr = r*(1-Math.cos(al)), b = 2*r*(al+Math.sin(al));
  const part = (hh) => { const p1 = Math.acos(Math.max(-1, Math.min(1, hh/r - 1)));
    const I0 = 2*(Math.PI-p1), Ic = -2*Math.sin(p1), Ic2 = (Math.PI-p1) - Math.sin(2*p1)/2;
    return { A: r*((hh-r)*(I0-Ic) - r*Ic + r*Ic2), P: 8*r*Math.cos(p1/2), T: r*(2*Math.PI - 2*p1 + 2*Math.sin(p1)) }; };
  if (h >= hr){ const a = part(hr); return { A: a.A + b*(h-hr), P: a.P + 2*(h-hr), T: b }; }
  return part(h);
}
function troughDims(b, alpha){ const al=alpha===undefined?Math.PI:alpha, r=b/(2*(al+Math.sin(al))); return { r, rim: r*(1-Math.cos(al)) }; }
// dimensionless table for the arch part: given a = A/r² (≤ 3π) → η = h/r
const CYC_TAB = (() => { const n=2000, a=new Float64Array(n+1), e=new Float64Array(n+1);
  for (let i=0;i<=n;i++){ const eta = 2*(i/n)*(i/n); e[i]=eta; a[i]=cycTrough(eta,1,Math.PI).A; } return {a, e, n}; })();
function sectionFromArea(kind, A, b, alpha){
  if (kind !== 'cyc'){ const h=A/b; return { h, P: b+2*h, T: b, R: A/(b+2*h), D: h, Pwall: 2*h }; }
  const {r, rim} = troughDims(b, alpha), full = cycTrough(rim, 1*r, alpha).A, aa = A/(r*r);
  let h;
  if (A >= full) h = rim + (A - full)/b;
  else { const t=CYC_TAB; let lo=0, hi=t.n; while (hi-lo>1){ const m=(lo+hi)>>1; if (t.a[m]<=aa) lo=m; else hi=m; }
    const f=(aa-t.a[lo])/(t.a[hi]-t.a[lo]||1); h = r*(t.e[lo]+f*(t.e[hi]-t.e[lo])); }
  const s = cycTrough(h, r, alpha);
  return { h, P: s.P, T: s.T, R: A/s.P, D: A/s.T, Pwall: Math.max(0, 2*(h-rim)) };
}

/* ---- Channel with side walls (plan-view width b(x)), flat bottom following the base profile.
   1D, section-averaged, rectangular section b × h, thin fast flow (hydrostatic term neglected):
     Q = V b h ,  R = b h / (b + 2h) ,  V dV/ds = g sinθ − f V² / (8R)
   f from Re = 4 R V / ν : laminar 96/Re, turbulent Colebrook with ε/(12R).
   Inlet at P: critical flow over the crest, V0 = (g Q / b0)^(1/3).                       ---- */
function wallWidth(kind, b0, b1, L, t0deg){
  if (kind === 'par') return x => b0;
  if (kind === 'lin') return x => b0 + (b1 - b0)*Math.min(Math.max(x/L,0),1);
  // half cycloid arch: narrows fast near P, ends parallel at Q
  // X(t) = (t − sin t)/π , Y(t) = (1 + cos t)/2 , t ∈ [0, π]
  // arc of the cycloid from t0 to π (t0 = 0: starts perpendicular to the flow)
  const t0 = t0deg ? t0deg*Math.PI/180 : 0, c0 = t0-Math.sin(t0), span = Math.PI-c0, y0 = 1+Math.cos(t0);
  const exact = x => { const u = Math.min(Math.max(x/L,0),1); let lo=t0, hi=Math.PI;
    for (let k=0;k<50;k++){ const m=(lo+hi)/2; if (((m-Math.sin(m))-c0)/span < u) lo=m; else hi=m; }
    const t=(lo+hi)/2; return b1 + (b0-b1)*(1+Math.cos(t))/y0; };
  // tabulated once (nodes clustered near P, where the wall turns fastest), then interpolated
  const NT=1200, tx=new Float64Array(NT+1), tb=new Float64Array(NT+1);
  for (let i=0;i<=NT;i++){ tx[i]=L*Math.pow(i/NT,3); tb[i]=exact(tx[i]); }
  return x => { if (x<=0) return tb[0]; if (x>=L) return tb[NT]; let k=Math.min(NT-1, Math.floor(NT*Math.cbrt(x/L)));
    while (k>0 && tx[k]>x) k--; while (k<NT-1 && tx[k+1]<x) k++; const w=(x-tx[k])/(tx[k+1]-tx[k]); return tb[k]*(1-w)+tb[k+1]*w; };
}
function frictionChannel(V, R, nu, eps){
  const Re = 4*R*V/nu;
  if (Re < 2000) return 96/Math.max(Re, 1e-9);
  return colebrook(Re, eps, R);
}
// base: {x, y} sampled curve; o: {Q [m³/s], nu, eps, walls:boolean, section:'rect'|'cyc'}
function runChannel(base, bfun, o, H){
  const {x, y} = base, n = x.length-1, Q = o.Q, kind = o.section || 'rect';
  const s=new Float64Array(n+1), t=new Float64Array(n+1), v=new Float64Array(n+1), hh=new Float64Array(n+1), bb=new Float64Array(n+1), Fr=new Float64Array(n+1), TT=new Float64Array(n+1), DD=new Float64Array(n+1);
  const sec = (V, X) => { const b=bfun(X), A=Q/V; if (!o.walls && kind==='rect'){ const h=A/b; return {h, R:h, T:b, D:h, P:b, Pwall:0}; } return sectionFromArea(kind, A, b, o.alpha); };
  // inlet: critical flow, V² = g·A/T  (solve for V)
  const b0 = bfun(0); let lo=0.01, hi=20; for (let k=0;k<80;k++){ const m=(lo+hi)/2, sc=sec(m,0); if (m*m < g*sc.D) lo=m; else hi=m; } v[0]=(lo+hi)/2;
  const acc = (V, X, sn) => { const sc=sec(V,X), f=frictionChannel(V, sc.R, o.nu, o.eps), af=f*V*V/(8*sc.R);
    return { a:(g*sn-af)/V, af, wallShare: o.walls ? sc.Pwall/sc.P : 0 }; };
  let Ewall=0, Ebed=0, stopAt=-1, maxWallAngFr2=0;
  for (let i=0;i<=n;i++){ bb[i]=bfun(x[i]); }
  { const sc=sec(v[0],0); hh[0]=sc.h; TT[0]=sc.T; DD[0]=sc.D; Fr[0]=v[0]/Math.sqrt(g*sc.D); }
  for (let i=1;i<=n;i++){
    const dx=x[i]-x[i-1], dy=y[i]-y[i-1], ds=Math.hypot(dx,dy), sn=-dy/ds; s[i]=s[i-1]+ds;
    if (stopAt>=0){ v[i]=0; t[i]=Infinity; continue; }
    const V=v[i-1], xm=(x[i]+x[i-1])/2;
    const k1=acc(V,x[i-1],sn), V2=V+0.5*ds*k1.a; if (V2<=1e-4){ stopAt=i-1; i--; continue; }
    const k2=acc(V2,xm,sn), V3=V+0.5*ds*k2.a;   if (V3<=1e-4){ stopAt=i-1; i--; continue; }
    const k3=acc(V3,xm,sn), V4=V+ds*k3.a;       if (V4<=1e-4){ stopAt=i-1; i--; continue; }
    const k4=acc(V4,x[i],sn), Vn=V+ds/6*(k1.a+2*k2.a+2*k3.a+k4.a);
    if (Vn<=1e-4){ stopAt=i-1; i--; continue; }
    v[i]=Vn; t[i]=t[i-1]+ds/6*(1/V+2/V2+2/V3+1/Vn);
    const afm=(k1.af+k4.af)/2, ws=(k1.wallShare+k4.wallShare)/2;
    Ewall += afm*ws*ds; Ebed += afm*(1-ws)*ds;
    const sc=sec(Vn,x[i]); hh[i]=sc.h; TT[i]=sc.T; DD[i]=sc.D; Fr[i]=Vn/Math.sqrt(g*sc.D*Math.max(dx/ds,0.05));
    const wallAng = Math.atan(Math.abs(bfun(Math.min(x[i]+1e-4,x[n]))-bfun(Math.max(x[i]-1e-4,0)))/2/2e-4)*180/Math.PI;
    if (Fr[i]>2 && wallAng>maxWallAngFr2) maxWallAngFr2=wallAng;
  }
  if (stopAt>=0) for (let i=stopAt+1;i<=n;i++){ v[i]=0; t[i]=Infinity; }
  const E0 = g*H + v[0]*v[0]/2;
  let vmax=0, ymin=Infinity; for (let i=0;i<=n;i++){ if (v[i]>vmax) vmax=v[i]; if (y[i]<ymin) ymin=y[i]; }
  return { x, y, s, t, v, h: hh, b: bb, T_top: TT, D: DD, Fr, T: stopAt>=0?Infinity:t[n], vQ: stopAt>=0?0:v[n], hQ: hh[n], bQ: bb[n], FrQ: Fr[n],
    stopAt, reach: stopAt>=0 ? s[stopAt]/s[n] : 1, vmax, ymin, len: s[n], V0: v[0], h0: hh[0], kind, alpha: o.alpha,
    lossPct: 100*(Ewall+Ebed)/E0, wallPct: 100*Ewall/E0, bedPct: 100*Ebed/E0, maxWallAngFr2 };
}

// ---- Oblique hydraulic jump (Ippen): supercritical flow deflected by a wall of angle θ
// tanθ = tanβ (√(1+8F²sin²β) − 3) / (2tan²β + √(1+8F²sin²β) − 1),  y2/y1 = (√(1+8F²sin²β) − 1)/2
// head loss of the jump (normal component): ΔE = (y2 − y1)³ / (4 y1 y2)
function obliqueJump(F, th){
  if (F <= 1 || th <= 0) return { ok:true, beta:NaN, ratio:1, dE_over_y1:0 };
  const defl = b => { const r=Math.sqrt(1+8*F*F*Math.sin(b)**2), tb=Math.tan(b); return Math.atan(tb*(r-3)/(2*tb*tb+r-1)); };
  const bmin = Math.asin(1/F), bmax = Math.PI/2; let best = null, prevB = bmin, prev = defl(bmin);
  for (let k=1;k<=200;k++){
    const bb = bmin + (bmax-bmin)*k/200, d = defl(bb);
    if (d >= th && prev < th){ let lo=prevB, hi=bb; for (let j=0;j<40;j++){ const m=(lo+hi)/2; if (defl(m)<th) lo=m; else hi=m; } best=(lo+hi)/2; break; }
    if (d < prev) break;               // passed max deflection: no attached (weak) jump
    prev = d; prevB = bb;
  }
  const beta = best ?? Math.PI/2;      // detached → treat as normal jump (upper bound)
  const Fn = F*Math.sin(beta), r = (Math.sqrt(1+8*Fn*Fn)-1)/2;
  return { ok: best!==null, beta, ratio:r, dE_over_y1: (r-1)**3/(4*r) };
}
// pessimistic single-jump estimate: worst point along the supercritical part of the walls
function shockEstimate(res, bfun, L){
  const {x, y, v, D, Fr} = res, n = x.length-1; const h = D; let worst = { dE:0, i:-1 };
  for (let i=1;i<n;i++){
    if (!isFinite(Fr[i]) || Fr[i] <= 1.2) continue;
    const d=1e-4, th = Math.atan(Math.abs(bfun(Math.min(x[i]+d,L))-bfun(Math.max(x[i]-d,0)))/(2*2*d));
    const dx=x[i+1]-x[i-1], dy=y[i+1]-y[i-1], cphi=dx/Math.hypot(dx,dy);
    if (th < 1e-4) continue;
    const J = obliqueJump(Fr[i], th), dE = g*cphi*J.dE_over_y1*h[i];      // energy per unit mass
    if (dE > worst.dE) worst = { dE, i, th: th*180/Math.PI, F: Fr[i], ok: J.ok, ratio: J.ratio, frac: dE/(0.5*v[i]*v[i]) };
  }
  return worst;
}
// rerun with the jump loss applied as a sudden kinetic-energy drop at the worst point
function runChannelWithShock(base, bfun, o, H, shock){
  if (!shock || shock.i < 0) return runChannel(base, bfun, o, H);
  const {x, y} = base, i0 = shock.i;
  const r1 = runChannel({x: x.slice(0, i0+1), y: y.slice(0, i0+1)}, bfun, o, H);
  const V1 = Math.sqrt(Math.max(r1.v[i0]**2 - 2*shock.dE, 1e-6));
  const o2 = Object.assign({}, o, { V0override: V1 });
  const r2 = runChannelFrom({x: x.slice(i0), y: y.slice(i0)}, bfun, o2, H);
  return { T: r1.t[i0] + r2.T, vQ: r2.vQ, hQ: r2.hQ };
}
function runChannelFrom(base, bfun, o, H){
  const {x, y} = base, n=x.length-1, Q=o.Q, kind=o.section||'rect'; let V=o.V0override, T=0;
  const acc=(V,X,sn)=>{ const sc=sectionFromArea(kind, Q/V, bfun(X), o.alpha); const f=frictionChannel(V,sc.R,o.nu,o.eps); return (g*sn - f*V*V/(8*sc.R))/V; };
  for (let i=1;i<=n;i++){ const dx=x[i]-x[i-1], dy=y[i]-y[i-1], ds=Math.hypot(dx,dy), sn=-dy/ds, xm=(x[i]+x[i-1])/2;
    const a1=acc(V,x[i-1],sn), V2=V+0.5*ds*a1, a2=acc(V2,xm,sn), V3=V+0.5*ds*a2, a3=acc(V3,xm,sn), V4=V+ds*a3, a4=acc(V4,x[i],sn), Vn=V+ds/6*(a1+2*a2+2*a3+a4);
    if (!(Vn>1e-4)) return { T:Infinity, vQ:0, hQ:NaN };
    T+=ds/6*(1/V+2/V2+2/V3+1/Vn); V=Vn; }
  return { T, vQ:V, hQ: sectionFromArea(kind, Q/V, bfun(x[n]), o.alpha).h };
}
