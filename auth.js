// ============================================================
// HiloNova CAD — Acceso, licencias y compra con Stripe
// ============================================================
import { FIREBASE_CONFIG, API_URL, PLAN, WHATSAPP } from '../firebase-config.js';
import { state, emit, setCloud } from './store.js';
import { icon, $, h, esc, modal, toast } from './ui.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
let fb = null; // { auth, db, m: módulos }
const configurado = () => FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('TU_');
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const devMode = () => isLocal && (new URLSearchParams(location.search).has('dev') || localStorage.getItem('hnv.dev') === '1');

function setSession(s) { Object.assign(state.session, s); emit('session', state.session); }

export async function iniciarAcceso() {
  if (devMode()) {
    try { localStorage.setItem('hnv.dev', '1'); } catch {}
    setSession({ user: { email: 'desarrollo@local', uid: 'dev' }, licencia: true, demo: false, dev: true });
    return;
  }
  if (!configurado()) {
    setSession({ user: null, licencia: false, demo: true });
    console.warn('Firebase sin configurar: la app corre en modo demo local.');
    return;
  }
  const [app, auth, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const a = app.initializeApp(FIREBASE_CONFIG);
  fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
  fb.auth.languageCode = 'es';

  return new Promise((resolve) => {
    let first = true, unsubLic = null;
    auth.onAuthStateChanged(fb.auth, async (user) => {
      if (unsubLic) { unsubLic(); unsubLic = null; }
      if (!user) {
        setSession({ user: null, licencia: false, demo: true });
        mostrarGate('login');
        return;
      }
      ocultarGate();
      const ref = fs.doc(fb.db, 'users', user.uid);
      try {
        const snap = await fs.getDoc(ref);
        if (!snap.exists()) await fs.setDoc(ref, { email: user.email, nombre: user.displayName || '', creado: fs.serverTimestamp(), app: 'hilonova-cad' }, { merge: true });
      } catch (e) { console.warn(e); }
      unsubLic = fs.onSnapshot(ref, (d) => {
        const lic = d.data()?.licencia;
        const activa = !!(lic && lic.activa && (!lic.vence || (lic.vence.toMillis ? lic.vence.toMillis() : lic.vence) > Date.now()));
        const antes = state.session.licencia;
        setSession({ user: { email: user.email, uid: user.uid, nombre: user.displayName }, licencia: activa, demo: !activa, licData: lic || null });
        if (activa && !antes && !first) toast('Licencia activada. ¡Bienvenido a HiloNova CAD!', 'ok', 5000);
        if (first) { first = false; resolve(); }
      }, () => { setSession({ user: { email: user.email, uid: user.uid }, licencia: false, demo: true }); if (first) { first = false; resolve(); } });
      setCloud(nubeAdapter(user.uid));
    });
  });
}

function nubeAdapter(uid) {
  const { F, db } = fb;
  const col = () => F.collection(db, 'users', uid, 'proyectos');
  return {
    async save(p) {
      await F.setDoc(F.doc(db, 'users', uid, 'proyectos', p.id), { nombre: p.nombre, prenda: p.prenda, actualizado: p.actualizado, tallas: p.tabla.tallas, piezas: p.piezas.length, data: JSON.stringify(p) });
    },
    async list() {
      const qs = await F.getDocs(col());
      return qs.docs.map((d) => { const x = d.data(); return { id: d.id, nombre: x.nombre, prenda: x.prenda, actualizado: x.actualizado, tallas: x.tallas, piezas: x.piezas }; });
    },
    async load(id) { const d = await F.getDoc(F.doc(db, 'users', uid, 'proyectos', id)); return d.exists() ? JSON.parse(d.data().data) : null; },
    async remove(id) { await F.deleteDoc(F.doc(db, 'users', uid, 'proyectos', id)); },
  };
}

export async function cerrarSesion() {
  if (fb) await fb.A.signOut(fb.auth);
  else { localStorage.removeItem('hnv.dev'); location.reload(); }
}

async function token() { return fb && fb.auth.currentUser ? fb.auth.currentUser.getIdToken() : null; }

// ---------- Pantalla de acceso ----------
function ocultarGate() { $('#gate').classList.add('hide'); }
function mostrarGate(modo) {
  const g = $('#gate');
  g.classList.remove('hide');
  const titles = { login: ['Inicia sesión', 'Entra para diseñar, graduar y trazar tus patrones.'], registro: ['Crea tu cuenta', 'Gratis. Prueba el software completo en modo demo.'], recuperar: ['Recuperar contraseña', 'Te enviamos un enlace a tu correo.'] };
  const [t, sub] = titles[modo];
  g.innerHTML = `<div class="gate-card">
    <div class="brand"><div class="brand-mark"><svg viewBox="0 0 24 24"><path d="M5 19V5l7 9V5"/><path d="M12 19l7-14v14"/></svg></div><div><b>HiloNova CAD</b><small>Patronaje digital</small></div></div>
    <h2>${t}</h2><p class="sub">${sub}</p>
    <form id="gForm">
      ${modo === 'registro' ? '<div class="field"><label>Nombre</label><input class="input" name="nombre" autocomplete="name" required></div>' : ''}
      <div class="field"><label>Correo</label><input class="input" type="email" name="email" autocomplete="email" required></div>
      ${modo !== 'recuperar' ? `<div class="field"><label>Contraseña</label><input class="input" type="password" name="pass" minlength="6" autocomplete="${modo === 'login' ? 'current-password' : 'new-password'}" required></div>` : ''}
      <div class="err" id="gErr"></div>
      <button class="btn pri" type="submit">${modo === 'login' ? 'Entrar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}</button>
      ${modo !== 'recuperar' ? `<div class="or">o</div><button class="btn" type="button" id="gGoogle">${googleIc}Continuar con Google</button>` : ''}
    </form>
    <div class="gate-links">
      ${modo === 'login' ? '<a data-m="registro">Crear cuenta</a><a data-m="recuperar">¿Olvidaste tu contraseña?</a>' : '<a data-m="login">Ya tengo cuenta</a><span></span>'}
    </div></div>`;
  g.querySelectorAll('[data-m]').forEach((a) => a.addEventListener('click', () => mostrarGate(a.dataset.m)));
  const err = $('#gErr', g);
  const A = fb.A;
  const msg = (e) => ({ 'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Contraseña incorrecta.', 'auth/user-not-found': 'No existe una cuenta con ese correo.', 'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Inicia sesión.', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/too-many-requests': 'Demasiados intentos. Espera un momento.', 'auth/popup-closed-by-user': '' }[e.code] ?? 'No se pudo completar. Intenta de nuevo.');
  $('#gForm', g).addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const f = new FormData(e.target);
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (modo === 'login') await A.signInWithEmailAndPassword(fb.auth, f.get('email'), f.get('pass'));
      else if (modo === 'registro') { const c = await A.createUserWithEmailAndPassword(fb.auth, f.get('email'), f.get('pass')); await A.updateProfile(c.user, { displayName: f.get('nombre') }); }
      else { await A.sendPasswordResetEmail(fb.auth, f.get('email')); err.style.color = 'var(--ok)'; err.textContent = 'Listo. Revisa tu correo.'; }
    } catch (ex) { err.style.color = ''; err.textContent = msg(ex); }
    btn.disabled = false;
  });
  const gg = $('#gGoogle', g);
  if (gg) gg.addEventListener('click', async () => { try { await A.signInWithPopup(fb.auth, new A.GoogleAuthProvider()); } catch (ex) { err.textContent = msg(ex); } });
}
const googleIc = '<svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

// ---------- Compra / código de alumno ----------
export function abrirCompra() {
  if (state.session.licencia) { toast('Tu licencia ya está activa', 'ok'); return; }
  const body = h(`<div style="display:flex;flex-direction:column;gap:14px">
    <div class="plan">
      <div class="row" style="justify-content:space-between"><b>${esc(PLAN.nombre)}</b><span class="badge ok">${esc(PLAN.periodo)}</span></div>
      <div class="price">$${PLAN.precio.toLocaleString('es-MX')} <span style="font-size:14px;color:var(--muted)">${esc(PLAN.moneda)}</span></div>
      <ul>${PLAN.incluye.map((x) => `<li>${icon('check', 'sm')}${esc(x)}</li>`).join('')}</ul>
    </div>
    <button class="btn pri" id="bPagar" style="height:42px">${icon('card', 'sm')}Pagar con tarjeta (Stripe)</button>
    <div class="or">¿Eres alumno del curso?</div>
    <div class="row"><input class="input" id="cCod" placeholder="Código de acceso (ej. HN-XXXX-XXXX)" style="text-transform:uppercase"><button class="btn" id="bCanje">${icon('key', 'sm')}Canjear</button></div>
    <div class="err" id="cErr"></div>
    <p class="hint" style="margin:0">¿Dudas? Escríbenos por <a class="link" href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a>. El pago se procesa de forma segura en Stripe.</p>
  </div>`);
  const m = modal({ title: 'Activa HiloNova CAD', body });
  const err = body.querySelector('#cErr');
  body.querySelector('#bPagar').onclick = async (e) => {
    err.textContent = '';
    if (!fb) { err.textContent = 'Inicia sesión para comprar (Firebase no está configurado en este entorno).'; return; }
    const b = e.currentTarget; b.disabled = true; b.innerHTML = 'Abriendo pago seguro…';
    try {
      const r = await fetch(API_URL + '/crear-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) }, body: JSON.stringify({ origen: location.origin + location.pathname }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'No se pudo iniciar el pago');
      location.href = j.url;
    } catch (ex) { err.textContent = ex.message; b.disabled = false; b.innerHTML = icon('card', 'sm') + 'Pagar con tarjeta (Stripe)'; }
  };
  body.querySelector('#bCanje').onclick = async (e) => {
    err.textContent = '';
    const codigo = body.querySelector('#cCod').value.trim().toUpperCase();
    if (!codigo) { err.textContent = 'Escribe tu código.'; return; }
    if (!fb) { err.textContent = 'Inicia sesión para canjear tu código.'; return; }
    const b = e.currentTarget; b.disabled = true;
    try {
      const r = await fetch(API_URL + '/canjear-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) }, body: JSON.stringify({ codigo }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Código no válido');
      toast('Código canjeado. Activando licencia…', 'ok'); m.close();
    } catch (ex) { err.textContent = ex.message; }
    b.disabled = false;
  };
}

// Bloqueo de funciones de pago
export function requiereLicencia(accion = 'esta función') {
  if (state.session.licencia) return true;
  modal({
    title: 'Función con licencia',
    body: `<p style="margin:0;line-height:1.6">En modo demo puedes diseñar, graduar y trazar sin límite. Para <b>${esc(accion)}</b> necesitas activar tu licencia.</p>`,
    actions: [{ label: 'Ahora no', cls: 'ghost' }, { label: 'Activar licencia', cls: 'pri', icon: 'unlock', onClick: () => { setTimeout(abrirCompra, 50); } }],
  });
  return false;
}
