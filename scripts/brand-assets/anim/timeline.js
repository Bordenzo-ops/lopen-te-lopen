/**
 * timeline.js — piepkleine animatiehulp voor de merkfilms.
 *
 * Uitgangspunt: een animatie is een PURE FUNCTIE VAN TIJD. Elke pagina
 * definieert `window.renderAt(t)` die voor tijdstip t alle stijlen expliciet
 * zet. Er lopen dus geen CSS-animaties en geen requestAnimationFrame — de
 * renderer kan frames in willekeurige volgorde schieten en krijgt altijd
 * exact hetzelfde beeld. Dat maakt het renderen herhaalbaar en hervatbaar.
 */

// ── Easings ───────────────────────────────────
const ease = {
  linear:    t => t,
  outCubic:  t => 1 - Math.pow(1 - t, 3),
  outQuint:  t => 1 - Math.pow(1 - t, 5),
  outExpo:   t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Lichte overshoot; gebruikt waar iets "landt" (de eenheid, de CTA-pil).
  outBack:   t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/**
 * Genormaliseerde voortgang van een fase: 0 vóór `from`, 1 ná `to`.
 * Buiten het venster klemmen we, zodat elk element vanzelf op zijn
 * eind- of beginstand blijft staan.
 */
function phase(t, from, to, easing = ease.outCubic) {
  if (to <= from) return t >= to ? 1 : 0;
  const raw = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return easing(raw);
}

/** Interpoleer tussen a en b. */
function lerp(a, b, p) { return a + (b - a) * p; }

/**
 * Standaard "inval"-beweging: faden terwijl het element een paar pixels
 * omhoog schuift. Overal hetzelfde gebruikt, zodat de films één handschrift
 * houden.
 */
function riseIn(el, t, from, to, distance = 14, easing = ease.outCubic) {
  const p = phase(t, from, to, easing);
  el.style.opacity = String(p);
  el.style.transform = `translateY(${lerp(distance, 0, p).toFixed(2)}px)`;
}

/** Zet meerdere elementen gestaggerd in beeld. */
function riseInStagger(els, t, from, step, duration, distance = 10) {
  els.forEach((el, i) => riseIn(el, t, from + i * step, from + i * step + duration, distance));
}

window.ease = ease;
window.phase = phase;
window.lerp = lerp;
window.riseIn = riseIn;
window.riseInStagger = riseInStagger;
