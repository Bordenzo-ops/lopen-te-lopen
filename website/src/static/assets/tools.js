/**
 * tools.js: rekentools van lopentelopen.nl (tempo, finishtijd, startvak).
 * Vanilla JS, geen afhankelijkheden. Zoekt forms op [data-tool] en rekent live mee.
 * De pure rekenfuncties staan los van de DOM en zijn ook in Node te testen.
 */
(function () {
  'use strict';

  // ── Parsen ──────────────────────────────────────────────────────────────

  /** "5,5" of "5.5" -> 5.5; ongeldig -> null. */
  function parseNumber(text) {
    var s = String(text == null ? '' : text).trim().replace(/\s+/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  /** "25:30" (min:sec) of "1:52:00" (u:mm:ss) -> seconden; ongeldig -> null. */
  function parseTime(text) {
    var s = String(text == null ? '' : text).trim();
    if (!/^\d{1,3}(:\d{1,2}){1,2}$/.test(s)) return null;
    var p = s.split(':').map(Number);
    var h = 0, m, sec;
    if (p.length === 3) { h = p[0]; m = p[1]; sec = p[2]; } else { m = p[0]; sec = p[1]; }
    if (sec > 59) return null;
    if (p.length === 3 && m > 59) return null;
    return h * 3600 + m * 60 + sec;
  }

  // ── Opmaken ─────────────────────────────────────────────────────────────

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /** Seconden -> "m:ss" of "u:mm:ss" (afgerond op hele seconden). */
  function formatTime(totalSeconds) {
    var t = Math.round(totalSeconds);
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  /** Seconden per km -> "m:ss". */
  function formatPace(secPerKm) {
    var t = Math.round(secPerKm);
    return Math.floor(t / 60) + ':' + pad2(t % 60);
  }

  /** 12 -> "12,0". */
  function formatDecimal(n, digits) {
    return n.toFixed(digits).replace('.', ',');
  }

  /** 21.1 -> "21,1"; 42.195 -> "42,195"; 10 -> "10". */
  function formatKm(km) {
    return String(Number(km.toFixed(3))).replace('.', ',');
  }

  // ── Rekenen ─────────────────────────────────────────────────────────────

  function calcPace(distanceKm, seconds) {
    var pace = seconds / distanceKm;
    return { paceSec: pace, kmh: 3600 / pace };
  }

  function calcFinish(distanceKm, paceSec) {
    return distanceKm * paceSec;
  }

  /** Riegel (1981): T2 = T1 * (D2 / D1) ^ 1,06. */
  function riegel(d1, t1, d2) {
    return t1 * Math.pow(d2 / d1, 1.06);
  }

  // Gelijk aan MARATHON_WAVES en MARATHON_START_NOTE in src/data/raceDetails.ts.
  var MARATHON_WAVES = [
    { maxSeconds: 3 * 3600, label: 'Helemaal voorin', hint: 'Je loopt een snel, strak tempo. Voorin starten voorkomt dat je langzamere lopers moet passeren.' },
    { maxSeconds: 3.5 * 3600, label: 'Voorin', hint: 'Start in de voorste groepen en ga de eerste kilometers niet te snel van start.' },
    { maxSeconds: 4 * 3600, label: 'Voorste helft', hint: 'Zoek je plek in de voorste helft van het veld, rond jouw tempogroep.' },
    { maxSeconds: 4.5 * 3600, label: 'Middenveld', hint: 'Het middenveld past bij jouw tempo. Laat je niet meeslepen door het gedrang in het begin.' },
    { maxSeconds: 5 * 3600, label: 'Achterste helft', hint: 'Start rustig in de achterste helft, dan loop je ontspannen jouw eigen race.' },
    { maxSeconds: null, label: 'Achteraan', hint: 'Start achteraan en neem de tijd. Genieten staat voorop, de sfeer onderweg is de beloning.' }
  ];

  function waveFor(targetSeconds) {
    for (var i = 0; i < MARATHON_WAVES.length; i++) {
      var w = MARATHON_WAVES[i];
      if (w.maxSeconds === null || targetSeconds < w.maxSeconds) return w;
    }
    return MARATHON_WAVES[MARATHON_WAVES.length - 1];
  }

  var MARATHON_KM = 42.195;
  var PREDICT_DISTANCES = [
    { km: 5, label: '5 km' },
    { km: 10, label: '10 km' },
    { km: 21.1, label: '21,1 km' },
    { km: MARATHON_KM, label: 'Marathon (42,195 km)' }
  ];

  // ── Validatie ───────────────────────────────────────────────────────────

  var DIST_MIN = 0.1, DIST_MAX = 100;
  var PACE_MIN = 120, PACE_MAX = 1200; // 2:00 tot 20:00 per km

  function checkDistance(text, min, max) {
    var n = parseNumber(text);
    var msg = 'Vul een afstand in kilometers in, bijvoorbeeld 10 of 21,1';
    if (n === null) return { error: msg };
    if (n < min || n > max) return { error: 'Kies een afstand tussen ' + formatKm(min) + ' en ' + formatKm(max) + ' km' };
    return { value: n };
  }

  function checkTime(text, minSec, maxSec, msg) {
    var s = parseTime(text);
    if (s === null) return { error: msg || 'Vul een tijd in als 25:30 of 1:45:00' };
    if (s < minSec || s > maxSec) return { error: 'Deze tijd valt buiten het bereik van de rekentool. Controleer je invoer' };
    return { value: s };
  }

  function checkPace(text) {
    var msg = 'Vul een tempo in als 5:30 (minuten en seconden per km)';
    var s = /^\d{1,2}:\d{2}$/.test(String(text).trim()) ? parseTime(text) : null;
    if (s === null) return { error: msg };
    if (s < PACE_MIN || s > PACE_MAX) return { error: 'Kies een tempo tussen 2:00 en 20:00 per km' };
    return { value: s };
  }

  var api = {
    parseNumber: parseNumber, parseTime: parseTime, formatTime: formatTime, formatPace: formatPace,
    formatDecimal: formatDecimal, formatKm: formatKm, calcPace: calcPace, calcFinish: calcFinish,
    riegel: riegel, waveFor: waveFor, MARATHON_WAVES: MARATHON_WAVES, PREDICT_DISTANCES: PREDICT_DISTANCES,
    checkDistance: checkDistance, checkTime: checkTime, checkPace: checkPace
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ── Formulieren ─────────────────────────────────────────────────────────

  function field(form, name) { return form.elements[name] || null; }

  var submitting = false;

  function setError(form, name, message) {
    var el = field(form, name);
    if (message && el && !submitting && el.value.trim() === '') message = '';
    var box = form.querySelector('[data-fout="' + name + '"]');
    var input = field(form, name);
    if (box) {
      box.textContent = message || '';
      box.hidden = !message;
    }
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  function clearResult(form) {
    var out = form.querySelector('output');
    if (out) out.textContent = '–';
    var extra = form.querySelector('[data-extra]');
    if (extra) extra.textContent = '';
    var lijst = form.querySelector('[data-lijst]');
    if (lijst) lijst.textContent = '';
  }

  function addLine(parent, text, strong) {
    var p = document.createElement('p');
    if (strong) {
      var s = document.createElement('strong');
      s.textContent = strong;
      p.appendChild(s);
      p.appendChild(document.createTextNode(' ' + text));
    } else {
      p.textContent = text;
    }
    parent.appendChild(p);
  }

  /** Koppelt snelkeuze-select aan het afstandsveld. */
  function bindDistance(form) {
    var select = field(form, 'snelkeuze');
    var input = field(form, 'afstand');
    if (!select || !input) return;
    function sync() {
      var n = parseNumber(input.value);
      var match = '';
      for (var i = 0; i < select.options.length; i++) {
        var o = parseNumber(select.options[i].value);
        if (n !== null && o !== null && o === n) match = select.options[i].value;
      }
      select.value = match;
    }
    select.addEventListener('change', function () {
      if (select.value) {
        input.value = select.value;
        form.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        input.focus();
      }
    });
    input.addEventListener('input', sync);
    sync();
  }

  // Elke handler geeft true terug als er een geldige uitkomst is getoond.
  var handlers = {
    tempo: function (form, loud) {
      var mode = field(form, 'modus').value;
      form.querySelectorAll('[data-modus]').forEach(function (el) { el.hidden = el.getAttribute('data-modus') !== mode; });
      var dist = checkDistance(field(form, 'afstand').value, DIST_MIN, DIST_MAX);
      setError(form, 'afstand', loud && dist.error);
      var out = form.querySelector('output');
      var extra = form.querySelector('[data-extra]');
      if (mode === 'tijd') {
        setError(form, 'tempo', '');
        var time = checkTime(field(form, 'tijd').value, 1, 400 * 3600);
        setError(form, 'tijd', loud && time.error);
        if (dist.error || time.error) return false;
        var r = calcPace(dist.value, time.value);
        if (r.paceSec < PACE_MIN || r.paceSec > PACE_MAX) {
          setError(form, 'tijd', loud ? 'Dit geeft een tempo buiten 2:00 tot 20:00 per km. Controleer je afstand en tijd' : '');
          return false;
        }
        out.textContent = formatPace(r.paceSec) + ' min/km';
        extra.textContent = 'Dat is ' + formatDecimal(r.kmh, 1) + ' km/u.';
        return true;
      }
      setError(form, 'tijd', '');
      var pace = checkPace(field(form, 'tempo').value);
      setError(form, 'tempo', loud && pace.error);
      if (dist.error || pace.error) return false;
      out.textContent = formatTime(calcFinish(dist.value, pace.value));
      extra.textContent = 'Op ' + formatKm(dist.value) + ' km, met ' + formatDecimal(3600 / pace.value, 1) + ' km/u.';
      return true;
    },

    finish: function (form, loud) {
      var dist = checkDistance(field(form, 'afstand').value, 1, 60);
      setError(form, 'afstand', loud && dist.error);
      var time = checkTime(field(form, 'tijd').value, 60, 400 * 3600);
      setError(form, 'tijd', loud && time.error);
      if (dist.error || time.error) return false;
      var pace = time.value / dist.value;
      if (pace < PACE_MIN || pace > PACE_MAX) {
        setError(form, 'tijd', loud ? 'Dit geeft een tempo buiten 2:00 tot 20:00 per km. Controleer je afstand en tijd' : '');
        return false;
      }
      var out = form.querySelector('output');
      var lijst = form.querySelector('[data-lijst]');
      var extra = form.querySelector('[data-extra]');
      lijst.textContent = '';
      var marathon = null;
      PREDICT_DISTANCES.forEach(function (d) {
        var t = Math.abs(d.km - dist.value) < 0.001 ? time.value : riegel(dist.value, time.value, d.km);
        if (d.km === MARATHON_KM) marathon = t;
        addLine(lijst, formatTime(t) + ' (' + formatPace(t / d.km) + ' min/km)', d.label + ':');
      });
      out.textContent = 'Marathon: ' + formatTime(marathon);
      extra.textContent = dist.value < 3
        ? 'Let op: Riegel werkt het best met een uitslag vanaf ongeveer 3 km. Korte afstanden geven een onbetrouwbare marathonschatting.'
        : 'Een schatting, geen belofte. Voor de marathon is de uitkomst vaak te optimistisch als je weinig lange duurlopen hebt gedaan.';
      return true;
    },

    startvak: function (form, loud) {
      var time = checkTime(field(form, 'doeltijd').value, 2 * 3600, 9 * 3600, 'Vul een doeltijd in als 4:15:00 (uren, minuten en seconden)');
      if (!time.error && !/^\d{1,2}:\d{2}:\d{2}$/.test(field(form, 'doeltijd').value.trim())) {
        time = { error: 'Vul een doeltijd in als 4:15:00 (uren, minuten en seconden)' };
      }
      if (time.error && /buiten het bereik/.test(time.error)) time.error = 'Kies een doeltijd tussen 2:00:00 en 9:00:00';
      setError(form, 'doeltijd', loud && time.error);
      if (time.error) return false;
      var wave = waveFor(time.value);
      var pace = time.value / MARATHON_KM;
      var out = form.querySelector('output');
      var extra = form.querySelector('[data-extra]');
      out.textContent = wave.label;
      extra.textContent = '';
      addLine(extra, wave.hint);
      addLine(extra, 'Voor ' + formatTime(time.value) + ' is je gemiddelde tempo ' + formatPace(pace) + ' min/km (' + formatDecimal(3600 / pace, 1) + ' km/u).');
      return true;
    }
  };

  function init(form) {
    var handler = handlers[form.getAttribute('data-tool')];
    if (!handler) return;
    bindDistance(form);
    function run(loud) {
      if (!handler(form, loud)) clearResult(form);
    }
    form.addEventListener('input', function () { run(false); });
    form.addEventListener('change', function () { run(true); });
    form.addEventListener('submit', function (e) { e.preventDefault(); submitting = true; run(true); submitting = false; });
    form.noValidate = true;
    run(false);
  }

  function start() {
    var forms = document.querySelectorAll('form[data-tool]');
    for (var i = 0; i < forms.length; i++) init(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
