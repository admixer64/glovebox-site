/* Ask Glovebox: the help chat on gloveboxcars.com.
   Shows nothing unless an endpoint is configured, either with
   window.GLOVEBOX_ASSISTANT_URL or a data-endpoint attribute on this script tag.
   Questions go to a small proxy that holds the API key; nothing is stored in the browser. */
(function () {
  "use strict";
  var script = document.currentScript;
  var ENDPOINT = window.GLOVEBOX_ASSISTANT_URL || (script && script.getAttribute("data-endpoint")) || "";
  if (!ENDPOINT) return;

  var MAX_CHARS = 800, MAX_TURNS = 10;
  var SUPPORT = "support@gloveboxcars.com";
  var SUGGESTIONS = [
    "How do I import my service history?",
    "My scan missed some rows",
    "The Save button is greyed out",
    "Why is my brake job a service, not a mod?",
    "How do I export the build sheet?"
  ];

  var css = [
    ".gba-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:var(--champagne,#D9B989);color:var(--ink,#0B0B0D);border:0;border-radius:999px;padding:12px 18px;font:600 .95rem var(--sans,Inter,system-ui,sans-serif);cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.45)}",
    ".gba-btn:focus-visible,.gba-send:focus-visible,.gba-chip:focus-visible,.gba-close:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ".gba-panel{position:fixed;right:20px;bottom:76px;z-index:2147483000;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 100px));display:none;flex-direction:column;background:var(--panel,#141518);color:var(--text,#ECECEE);border:1px solid var(--hairline,rgba(255,255,255,.12));border-radius:14px;box-shadow:0 16px 60px rgba(0,0,0,.6);font:400 .92rem/1.5 var(--sans,Inter,system-ui,sans-serif);overflow:hidden}",
    ".gba-panel[data-open=true]{display:flex}",
    ".gba-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--hairline,rgba(255,255,255,.12));font:600 .95rem var(--cond,Oswald,system-ui,sans-serif);letter-spacing:.08em;text-transform:uppercase}",
    ".gba-close{background:none;border:0;color:var(--muted,#9A9AA1);font-size:1.3rem;line-height:1;cursor:pointer;padding:4px 8px}",
    ".gba-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".gba-msg{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".gba-msg a{color:var(--champagne,#D9B989)}",
    ".gba-user{align-self:flex-end;background:var(--champagne,#D9B989);color:var(--ink,#0B0B0D)}",
    ".gba-bot{align-self:flex-start;background:rgba(255,255,255,.07)}",
    ".gba-note{align-self:flex-start;color:var(--muted,#9A9AA1);font-size:.85rem}",
    ".gba-chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 10px}",
    ".gba-chip{background:none;border:1px solid var(--hairline,rgba(255,255,255,.2));color:var(--text,#ECECEE);border-radius:999px;padding:6px 11px;font:inherit;font-size:.82rem;cursor:pointer}",
    ".gba-chip:hover{border-color:var(--champagne,#D9B989)}",
    ".gba-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--hairline,rgba(255,255,255,.12))}",
    ".gba-input{flex:1;resize:none;height:42px;max-height:110px;background:rgba(255,255,255,.06);color:inherit;border:1px solid var(--hairline,rgba(255,255,255,.15));border-radius:10px;padding:10px;font:inherit}",
    ".gba-send{background:var(--champagne,#D9B989);color:var(--ink,#0B0B0D);border:0;border-radius:10px;padding:0 14px;font:600 .9rem var(--sans,Inter,system-ui,sans-serif);cursor:pointer}",
    ".gba-send[disabled]{opacity:.5;cursor:default}",
    ".gba-fine{padding:0 14px 10px;color:var(--muted,#9A9AA1);font-size:.74rem;line-height:1.4}",
    ".gba-fine a{color:var(--muted,#9A9AA1)}",
    ".gba-dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:var(--muted,#9A9AA1);animation:gba 1s infinite ease-in-out}",
    ".gba-dots span:nth-child(2){animation-delay:.15s}.gba-dots span:nth-child(3){animation-delay:.3s}",
    "@keyframes gba{0%,80%,100%{opacity:.25}40%{opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.gba-dots span{animation:none;opacity:.6}}",
    "@media (max-width:520px){.gba-btn{right:12px;bottom:12px}.gba-panel{right:12px;bottom:68px}}"
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // Replies are plain text with light markdown. Build DOM nodes (never innerHTML) so nothing in a reply can inject markup.
  function render(into, text) {
    var re = /(\*\*[^*]+\*\*|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s)]+)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
      var tok = m[0];
      if (tok.slice(0, 2) === "**") {
        into.appendChild(el("strong", "", tok.slice(2, -2)));
      } else {
        var a = el("a", "", tok);
        a.href = tok.indexOf("@") > 0 && tok.indexOf("http") !== 0 ? "mailto:" + tok : tok;
        if (a.protocol === "http:" || a.protocol === "https:") { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        into.appendChild(a);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
  }

  var history = [];   // { role, content }
  var busy = false;

  var btn = el("button", "gba-btn");
  btn.type = "button";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "gba-panel");
  btn.appendChild(document.createTextNode("Ask Glovebox"));

  var panel = el("section", "gba-panel");
  panel.id = "gba-panel";
  panel.setAttribute("aria-label", "Ask Glovebox");
  panel.setAttribute("data-open", "false");

  var head = el("div", "gba-head");
  head.appendChild(el("span", "", "Ask Glovebox"));
  var close = el("button", "gba-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  head.appendChild(close);

  var log = el("div", "gba-log");
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");
  var chips = el("div", "gba-chips");

  var form = el("form", "gba-form");
  var input = el("textarea", "gba-input");
  input.rows = 1;
  input.maxLength = MAX_CHARS;
  input.placeholder = "Ask about Glovebox…";
  input.setAttribute("aria-label", "Your question");
  var send = el("button", "gba-send", "Send");
  send.type = "submit";
  form.appendChild(input);
  form.appendChild(send);

  var fine = el("div", "gba-fine");
  fine.appendChild(document.createTextNode("Answers are written by AI and can be wrong. Please don't share VINs or personal details. Your question is sent to our assistant service to answer it; see the "));
  var pl = el("a", "", "privacy policy");
  pl.href = "privacy.html";
  fine.appendChild(pl);
  fine.appendChild(document.createTextNode("."));

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  panel.appendChild(fine);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  function add(role, text) {
    var m = el("div", "gba-msg " + (role === "user" ? "gba-user" : "gba-bot"));
    if (role === "user") m.textContent = text; else render(m, text);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function note(text) {
    var n = el("div", "gba-note");
    render(n, text);
    log.appendChild(n);
    log.scrollTop = log.scrollHeight;
  }

  function setOpen(open) {
    panel.setAttribute("data-open", open ? "true" : "false");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      if (!log.childNodes.length) {
        add("bot", "Stuck in Glovebox? Tell me what you're trying to do and I'll walk you through it: importing, scanning, the build sheet, Pro, sync and more.");
        SUGGESTIONS.forEach(function (s) {
          var c = el("button", "gba-chip", s);
          c.type = "button";
          c.addEventListener("click", function () { ask(s); });
          chips.appendChild(c);
        });
      }
      input.focus();
    } else {
      btn.focus();
    }
  }

  function ask(question) {
    question = (question || "").trim();
    if (!question || busy) return;
    chips.style.display = "none";
    add("user", question);
    history.push({ role: "user", content: question });
    if (history.length > MAX_TURNS * 2) history = history.slice(-MAX_TURNS * 2);
    while (history.length && history[0].role !== "user") history.shift();
    input.value = "";
    busy = true;
    send.disabled = true;
    var waiting = el("div", "gba-msg gba-bot gba-dots");
    waiting.setAttribute("aria-label", "Typing");
    waiting.appendChild(el("span")); waiting.appendChild(el("span")); waiting.appendChild(el("span"));
    log.appendChild(waiting);
    log.scrollTop = log.scrollHeight;

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      waiting.remove();
      if (r.ok && r.data.reply) {
        add("bot", r.data.reply);
        history.push({ role: "assistant", content: r.data.reply });
      } else {
        history.pop();
        note(r.data && r.data.reply ? r.data.reply : "Sorry, I couldn't answer that just now. You can email " + SUPPORT + " and a person will help.");
      }
    }).catch(function () {
      waiting.remove();
      history.pop();
      note("Sorry, I couldn't reach the assistant. You can email " + SUPPORT + " and a person will help.");
    }).then(function () {
      busy = false;
      send.disabled = false;
      input.focus();
    });
  }

  btn.addEventListener("click", function () { setOpen(panel.getAttribute("data-open") !== "true"); });
  close.addEventListener("click", function () { setOpen(false); });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.getAttribute("data-open") === "true") setOpen(false);
  });
})();
