/**
 * WebsUp review-widget.
 *
 * Zet dit op een site die je laat reviewen:
 *   <script defer src="https://app.websup.nl/review.js"></script>
 *
 * Het widget doet niets tot de URL `?review=TOKEN` bevat (daarna onthouden we
 * dat in sessionStorage). Gewone bezoekers merken er dus niets van.
 *
 * Waarom een script op de site zelf en geen iframe in het dashboard: een
 * cross-origin iframe is dicht. Je kunt er niet in klikken, de DOM niet lezen
 * en de scrollpositie niet opvragen. Met dit script leg je wél vast op wélk
 * element geklikt is (CSS-selector + positie binnen dat element), zodat een pin
 * blijft kloppen als de layout verschuift.
 */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var KEY = "websup_review_token";
  var token = params.get("review") || sessionStorage.getItem(KEY);
  if (!token) return;
  sessionStorage.setItem(KEY, token);

  var API = new URL(document.currentScript.src).origin;
  var picking = false;
  var pins = [];

  // ─── Selector bepalen ────────────────────────────────────────────────────
  // Voorkeur: id, dan data-testid, anders een kort pad met nth-of-type.
  function selectorFor(el) {
    if (!el || el === document.body) return "body";
    if (el.id) return "#" + CSS.escape(el.id);
    if (el.dataset && el.dataset.testid) return '[data-testid="' + el.dataset.testid + '"]';

    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && node !== document.body && depth < 6) {
      var part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift("#" + CSS.escape(node.id));
        break;
      }
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (child) {
          return child.tagName === node.tagName;
        });
        if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
      }
      parts.unshift(part);
      node = parent;
      depth++;
    }
    return parts.join(" > ");
  }

  // ─── Stijl ───────────────────────────────────────────────────────────────
  var css = document.createElement("style");
  css.textContent = [
    ".wsr-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;",
    "display:flex;gap:8px;align-items:center;background:#0f172a;color:#fff;border-radius:999px;",
    "padding:8px 10px 8px 16px;font:600 13px/1.4 system-ui,-apple-system,sans-serif;",
    "box-shadow:0 8px 30px rgba(0,0,0,.28)}",
    ".wsr-bar button{font:inherit;border:0;border-radius:999px;padding:8px 14px;cursor:pointer}",
    ".wsr-go{background:#22d3ee;color:#083344}",
    ".wsr-go[data-on='1']{background:#f43f5e;color:#fff}",
    ".wsr-count{opacity:.6;font-weight:500}",
    ".wsr-picking,.wsr-picking *{cursor:crosshair!important}",
    ".wsr-hl{outline:2px solid #22d3ee!important;outline-offset:1px!important}",
    ".wsr-pin{position:absolute;z-index:2147482000;width:26px;height:26px;margin:-13px 0 0 -13px;",
    "border-radius:50% 50% 50% 2px;background:#f43f5e;color:#fff;border:2px solid #fff;",
    "display:grid;place-items:center;font:700 12px/1 system-ui;box-shadow:0 3px 10px rgba(0,0,0,.3);cursor:pointer}",
    ".wsr-panel{position:fixed;inset:auto 16px 80px 16px;max-width:380px;margin-inline:auto;z-index:2147483000;",
    "background:#fff;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);",
    "font:400 14px/1.5 system-ui,-apple-system,sans-serif;color:#0f172a}",
    ".wsr-panel textarea{width:100%;box-sizing:border-box;min-height:76px;margin:10px 0;padding:10px;",
    "border:1px solid #cbd5e1;border-radius:10px;font:inherit;resize:vertical}",
    ".wsr-panel .wsr-row{display:flex;gap:8px}",
    ".wsr-panel button{flex:1;font:600 13px/1 system-ui;border:0;border-radius:10px;padding:11px;cursor:pointer}",
    ".wsr-save{background:#0f172a;color:#fff}.wsr-cancel{background:#e2e8f0;color:#0f172a}",
    ".wsr-note{margin:0;font-size:12px;color:#64748b}",
  ].join("");
  document.head.appendChild(css);

  // ─── Balk ────────────────────────────────────────────────────────────────
  var bar = document.createElement("div");
  bar.className = "wsr-bar";
  bar.innerHTML =
    '<span>Feedback</span><span class="wsr-count"></span>' +
    '<button class="wsr-go" type="button">Aanwijzen</button>';
  document.body.appendChild(bar);

  var goButton = bar.querySelector(".wsr-go");
  var countLabel = bar.querySelector(".wsr-count");

  function updateCount() {
    countLabel.textContent = pins.length ? pins.length + " punt" + (pins.length === 1 ? "" : "en") : "";
  }

  goButton.addEventListener("click", function () {
    picking = !picking;
    goButton.dataset.on = picking ? "1" : "0";
    goButton.textContent = picking ? "Stoppen" : "Aanwijzen";
    document.documentElement.classList.toggle("wsr-picking", picking);
  });

  // ─── Aanwijzen ───────────────────────────────────────────────────────────
  var highlighted = null;

  document.addEventListener(
    "mousemove",
    function (event) {
      if (!picking) return;
      var el = event.target;
      if (el.closest && el.closest(".wsr-bar,.wsr-panel,.wsr-pin")) return;
      if (highlighted === el) return;
      if (highlighted) highlighted.classList.remove("wsr-hl");
      highlighted = el;
      if (highlighted && highlighted.classList) highlighted.classList.add("wsr-hl");
    },
    true,
  );

  document.addEventListener(
    "click",
    function (event) {
      if (!picking) return;
      var el = event.target;
      if (el.closest && el.closest(".wsr-bar,.wsr-panel,.wsr-pin")) return;

      event.preventDefault();
      event.stopPropagation();

      var rect = el.getBoundingClientRect();
      openPanel({
        selector: selectorFor(el),
        // Positie binnen het element, niet op de pagina — dan blijft de pin
        // kloppen als de layout schuift of het scherm smaller is.
        xPct: rect.width ? (event.clientX - rect.left) / rect.width : 0.5,
        yPct: rect.height ? (event.clientY - rect.top) / rect.height : 0.5,
        pageX: event.pageX,
        pageY: event.pageY,
        scrollY: window.scrollY,
        viewport: window.innerWidth + "x" + window.innerHeight,
        url: location.href,
      });
    },
    true,
  );

  // ─── Paneel ──────────────────────────────────────────────────────────────
  var panel = null;

  function closePanel() {
    if (panel) panel.remove();
    panel = null;
  }

  function openPanel(pin) {
    closePanel();
    picking = false;
    goButton.dataset.on = "0";
    goButton.textContent = "Aanwijzen";
    document.documentElement.classList.remove("wsr-picking");
    if (highlighted) {
      highlighted.classList.remove("wsr-hl");
      highlighted = null;
    }

    panel = document.createElement("div");
    panel.className = "wsr-panel";
    panel.innerHTML =
      "<strong>Wat moet hier anders?</strong>" +
      '<textarea placeholder="Bijvoorbeeld: deze knop valt me niet op"></textarea>' +
      '<div class="wsr-row"><button class="wsr-cancel" type="button">Annuleren</button>' +
      '<button class="wsr-save" type="button">Doorgeven</button></div>' +
      '<p class="wsr-note"></p>';
    document.body.appendChild(panel);

    var textarea = panel.querySelector("textarea");
    var note = panel.querySelector(".wsr-note");
    textarea.focus();

    panel.querySelector(".wsr-cancel").addEventListener("click", closePanel);
    panel.querySelector(".wsr-save").addEventListener("click", function () {
      var text = textarea.value.trim();
      if (text.length < 3) {
        note.textContent = "Schrijf even kort op wat je bedoelt.";
        return;
      }
      note.textContent = "Versturen…";

      fetch(API + "/api/review/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, title: text, pin: pin }),
      })
        .then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok) throw new Error(body.error || "Versturen mislukt");
            return body;
          });
        })
        .then(function (saved) {
          closePanel();
          pins.push(saved);
          drawPin(pin, pins.length);
          updateCount();
        })
        .catch(function (error) {
          note.textContent = error.message;
        });
    });
  }

  function drawPin(pin, index) {
    var marker = document.createElement("div");
    marker.className = "wsr-pin";
    marker.textContent = index;
    marker.style.left = pin.pageX + "px";
    marker.style.top = pin.pageY + "px";
    marker.title = "Doorgegeven";
    document.body.appendChild(marker);
  }

  updateCount();
})();
