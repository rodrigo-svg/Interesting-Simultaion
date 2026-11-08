// Curva óptima del fondo (braquistócrona con roce de agua real), usada como perfil de bajada.
// Uso: node curva_optima.js > base.json
// Lámina delgada de 10 L/(s·m), agua a 20 °C, acrílico (ε = 0,0015 mm), H = 1 m, L = 2 m.
const g = 9.81, N_SAMPLES = 4000;
function solveCycloid(H, L){
  // x = r(t − sin t), y = H − r(1 − cos t);  (t − sin t)/(1 − cos t) = L/H
  const f = t => (t - Math.sin(t))/(1 - Math.cos(t)) - L/H;
  let lo = 1e-6, hi = 2*Math.PI - 1e-6;
  for (let i=0;i<200;i++){ const m=(lo+hi)/2; if (f(m)>0) hi=m; else lo=m; }
  const th = (lo+hi)/2; return { th, r: H/(1-Math.cos(th)) };
}

/* ---- Real water: thin sheet sliding on the chute bed, no air drag, no side walls.
   Depth-averaged momentum along the bed (thin, fast sheet: hydrostatic term neglected):
       V dV/ds = g sinθ − τ_b/(ρ h),   τ_b = ρ f V²/8,   h = q/V   (continuity, q per unit width)
     ⇒ dV/ds = (g sinθ − f V³/(8q)) / V
   f: laminar sheet 96/Re, turbulent Colebrook (open channel), Re = 4q/ν.
   Inlet: water spills over a crest at P ⇒ critical flow, V0 = (q g)^(1/3).                     ---- */
function nuWater(T){                       // kinematic viscosity [m²/s], Vogel fit for μ, ρ(T)
  const mu = 2.414e-5*Math.pow(10, 247.8/((T+273.15)-140));
  const rho = 1000 - 0.0178*Math.pow(Math.abs(T-4), 1.7);
  return mu/rho;
}
function makeModel(o){
  const q = o.qLsm/1000, nu = nuWater(o.temp), eps = o.epsMM/1000, Re = 4*q/nu;
  const lam = Re < 2000;
  let fConst = null, tab = null;
  if (lam) fConst = 96/Re; else if (eps === 0) fConst = colebrook(Re, 0, 1);
  else { tab = new Float64Array(4002); for (let k=0;k<=4001;k++) tab[k] = colebrook(Re, eps, q/Math.max(k/200, 0.005)); }
  const f = V => { if (fConst !== null) return fConst;           // rough wall: f(V) tabulated every 5 mm/s up to 20 m/s
    let u = V*200; if (u>4000) u=4000; const k = u|0, w = u-k; return tab[k]*(1-w)+tab[k+1]*w; };
  const V0 = Math.cbrt(q*g);
  return { q, nu, eps, Re, lam, f, V0, hc: q/V0, ideal: !!o.ideal,
           drag: V => o.ideal ? 0 : f(V)*V*V*V/(8*q) };
}
function colebrook(Re, eps, h){
  // open channel: 1/√f = −2 log10( ε/(12h) + 2.5/(Re √f) )
  let x = 7; // 1/√f
  for (let k=0;k<12;k++) x = -2*Math.log10(eps/(12*h) + 2.5*x/Re);
  return 1/(x*x);
}

// time to run along a polyline (xs, ys) starting with speed V0; RK4 in arc length.
// returns Infinity if the water stops before Q.
function runTime(xs, ys, M, sub){
  let V = M.V0, T = 0;
  for (let i=0;i<xs.length-1;i++){
    const dx=xs[i+1]-xs[i], dy=ys[i+1]-ys[i], ds=Math.hypot(dx,dy), sn=-dy/ds, h=ds/sub;
    for (let k=0;k<sub;k++){
      const a1=(g*sn-M.drag(V))/V;            const V2=V+0.5*h*a1; if (V2<=1e-4) return Infinity;
      const a2=(g*sn-M.drag(V2))/V2;          const V3=V+0.5*h*a2; if (V3<=1e-4) return Infinity;
      const a3=(g*sn-M.drag(V3))/V3;          const V4=V+h*a3;     if (V4<=1e-4) return Infinity;
      const a4=(g*sn-M.drag(V4))/V4;
      T += h/6*(1/V + 2/V2 + 2/V3 + 1/V4);
      V += h/6*(a1 + 2*a2 + 2*a3 + a4);
      if (V<=1e-4) return Infinity;
    }
  }
  return T;
}

// integrate a sampled curve for animation / table
function integrateReal(curve, H, M){
  const {x, y} = curve, n = x.length-1;
  const s=new Float64Array(n+1), t=new Float64Array(n+1), v=new Float64Array(n+1);
  v[0]=M.V0; let stopAt=-1;
  for (let i=1;i<=n;i++){
    const dx=x[i]-x[i-1], dy=y[i]-y[i-1], ds=Math.hypot(dx,dy), sn=-dy/ds;
    s[i]=s[i-1]+ds;
    if (stopAt>=0){ v[i]=0; t[i]=Infinity; continue; }
    const V=v[i-1];
    const a1=(g*sn-M.drag(V))/V, V2=V+0.5*ds*a1;
    const ok = V2>1e-4;
    const a2= ok ? (g*sn-M.drag(V2))/V2 : 0, V3=V+0.5*ds*a2;
    const a3= V3>1e-4 ? (g*sn-M.drag(V3))/V3 : 0, V4=V+ds*a3;
    const a4= V4>1e-4 ? (g*sn-M.drag(V4))/V4 : 0;
    const Vn = V + ds/6*(a1+2*a2+2*a3+a4);
    if (!ok || V3<=1e-4 || V4<=1e-4 || Vn<=1e-4){ stopAt=i-1; v[i]=0; t[i]=Infinity; continue; }
    v[i]=Vn; t[i]=t[i-1]+ds/6*(1/V+2/V2+2/V3+1/Vn);
  }
  let Nmin=Infinity;
  const last = stopAt>=0 ? stopAt : n;
  for (let i=Math.floor(n*0.02); i<Math.min(last,Math.floor(n*0.99)); i++){
    const dx=(x[i+1]-x[i-1])/2, dy=(y[i+1]-y[i-1])/2, ddx=x[i+1]-2*x[i]+x[i-1], ddy=y[i+1]-2*y[i]+y[i-1];
    const d2=dx*dx+dy*dy, k=(dx*ddy-dy*ddx)/Math.pow(d2,1.5);
    const N=(g*dx/Math.sqrt(d2) + v[i]*v[i]*k)/g; if (N<Nmin) Nmin=N;
  }
  let ymin=Infinity, vmax=0; for (let i=0;i<=n;i++){ if(y[i]<ymin) ymin=y[i]; if(v[i]>vmax) vmax=v[i]; }
  Object.assign(curve, { s, t, v, T: stopAt>=0 ? Infinity : t[n], len: s[n], vQ: stopAt>=0 ? 0 : v[n], vmax, ymin, Nmin,
    stopAt, reach: stopAt>=0 ? s[stopAt]/s[n] : 1, hQ: stopAt>=0 ? NaN : M.q/v[n] });
  return curve;
}

// ---- time-optimal curve (brachistochrone with water friction): direct method + BFGS
function optimalCurve(H, L, M, N=48, sub=3){
  const xs = new Float64Array(N+1); for (let i=0;i<=N;i++) xs[i]=L*(i/N)*(i/N);
  const ys = new Float64Array(N+1); ys[0]=H; ys[N]=0;
  const n = N-1, z = new Float64Array(n);
  // start: the better of the straight line and the ideal cycloid (if feasible)
  const cy = solveCycloid(H, L), cycY = x => { if (x<=0) return H; let lo=0, hi=cy.th;
    for (let k=0;k<60;k++){ const m=(lo+hi)/2; if (cy.r*(m-Math.sin(m))<x) lo=m; else hi=m; } return H-cy.r*(1-Math.cos((lo+hi)/2)); };
  const F = zz => { for (let i=0;i<n;i++) ys[i+1]=zz[i]; return runTime(xs, ys, M, sub); };
  const zl = new Float64Array(n), zc = new Float64Array(n);
  for (let i=0;i<n;i++){ zl[i]=H*(1-xs[i+1]/L); zc[i]=cycY(xs[i+1]); }
  const fl=F(zl), fc=F(zc); z.set(fc<fl ? zc : zl);
  let fz = Math.min(fl, fc);
  const grad = (zz, gout) => { const hh=1e-6;
    for (let i=0;i<n;i++){ const o=zz[i]; zz[i]=o+hh; const fp=F(zz); zz[i]=o-hh; const fm=F(zz); zz[i]=o; gout[i]=(fp-fm)/(2*hh); } };
  let gk = new Float64Array(n); grad(z, gk);
  const Hi = new Float64Array(n*n); for (let i=0;i<n;i++) Hi[i*n+i]=1e-3;
  const p=new Float64Array(n), zn=new Float64Array(n), gn=new Float64Array(n), sv=new Float64Array(n), yv=new Float64Array(n), Hy=new Float64Array(n);
  let it=0;
  for (; it<400; it++){
    for (let i=0;i<n;i++){ let acc=0; for (let j=0;j<n;j++) acc-=Hi[i*n+j]*gk[j]; p[i]=acc; }
    let gp=0; for (let i=0;i<n;i++) gp+=gk[i]*p[i];
    if (gp>=0){ for (let i=0;i<n*n;i++) Hi[i]=0; for (let i=0;i<n;i++){ Hi[i*n+i]=1e-3; p[i]=-1e-3*gk[i]; } gp=0; for (let i=0;i<n;i++) gp+=gk[i]*p[i]; }
    let a=1, fn;
    for (let ls=0; ls<40; ls++){ for (let i=0;i<n;i++) zn[i]=z[i]+a*p[i]; fn=F(zn); if (fn <= fz + 1e-4*a*gp) break; a*=0.5; }
    if (!(fn < fz)) break;
    grad(zn, gn);
    let sy=0; for (let i=0;i<n;i++){ sv[i]=zn[i]-z[i]; yv[i]=gn[i]-gk[i]; sy+=sv[i]*yv[i]; }
    const df = fz - fn;
    z.set(zn); gk.set(gn); fz=fn;
    if (sy>1e-16){
      let yHy=0; for (let i=0;i<n;i++){ let acc=0; for (let j=0;j<n;j++) acc+=Hi[i*n+j]*yv[j]; Hy[i]=acc; yHy+=yv[i]*acc; }
      const r=1/sy, c=(1+yHy*r)*r;
      for (let i=0;i<n;i++) for (let j=0;j<n;j++) Hi[i*n+j] += c*sv[i]*sv[j] - r*(Hy[i]*sv[j]+sv[i]*Hy[j]);
    }
    let gmax=0; for (let i=0;i<n;i++) gmax=Math.max(gmax,Math.abs(gk[i]));
    if (gmax<1e-9 || df<1e-13) break;
  }
  for (let i=0;i<n;i++) ys[i+1]=z[i];
  return { xs, ys, T: fz, iters: it };
}

// monotone cubic (Fritsch–Carlson): no overshoot, so no spurious bumps the water would have to climb
function pchip(xs, ys){
  const n=xs.length, d=new Float64Array(n-1), m=new Float64Array(n);
  for (let i=0;i<n-1;i++) d[i]=(ys[i+1]-ys[i])/(xs[i+1]-xs[i]);
  m[0]=d[0]; m[n-1]=d[n-2];
  for (let i=1;i<n-1;i++){
    if (d[i-1]*d[i]<=0) m[i]=0;
    else { const h0=xs[i]-xs[i-1], h1=xs[i+1]-xs[i], w1=2*h1+h0, w2=h1+2*h0; m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]); }
  }
  return X => { let lo=0, hi=n-1; while (hi-lo>1){ const k=(lo+hi)>>1; if (xs[k]<=X) lo=k; else hi=k; }
    const h=xs[hi]-xs[lo], t=(X-xs[lo])/h, t2=t*t, t3=t2*t;
    return (2*t3-3*t2+1)*ys[lo] + (t3-2*t2+t)*h*m[lo] + (-2*t3+3*t2)*ys[hi] + (t3-t2)*h*m[hi]; };
}
function optimalSampled(H, L, M, N=48){
  const o = optimalCurve(H, L, M, N), f = pchip(Array.from(o.xs), Array.from(o.ys)), n=N_SAMPLES;
  const x=new Float64Array(n+1), y=new Float64Array(n+1);
  for (let i=0;i<=n;i++){ x[i]=L*(i/n)*(i/n); y[i]=f(x[i]); } y[0]=H; y[n]=0;
  return { x, y, Topt: o.T, iters: o.iters, nodes: o };
}

const M = makeModel({ qLsm: 10, temp: 20, epsMM: 0.0015 });
const o = optimalCurve(1, 2, M, 96);
process.stderr.write('Tiempo óptimo (lámina sin paredes): ' + o.T.toFixed(5) + ' s\n');
console.log(JSON.stringify({ xs: Array.from(o.xs).map(v=>+v.toFixed(7)), ys: Array.from(o.ys).map(v=>+v.toFixed(7)), T: o.T }));
