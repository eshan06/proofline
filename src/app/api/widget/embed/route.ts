import { repo } from "@/server/repository";

/**
 * Serves the website-chat widget as a self-contained script with the site key
 * and API base baked in:
 *
 *   <script src="https://app.proofline.com/api/widget/embed?key=SITE_KEY" async></script>
 *
 * Vanilla JS, no dependencies, no framework — it mounts a launcher + chat panel
 * on the customer's own site. Message text is rendered via textContent (never
 * innerHTML), so an agent reply can't inject script into the host page.
 */

export const dynamic = "force-dynamic";

function script(siteKey: string, base: string, valid: boolean): string {
  const cfg = JSON.stringify({ key: siteKey, base, valid });
  return `(function(){
  var CFG = ${cfg};
  if (!CFG.valid || !CFG.key) { console.warn("[Proofline] widget: unknown or disabled site key"); return; }
  var STORE = "pl_widget_" + CFG.key;
  var convoId = null;
  try { convoId = localStorage.getItem(STORE); } catch (e) {}
  var open = false, timer = null, lastCount = 0;

  var css = ""
    + ".pl-w-launch{position:fixed;right:20px;bottom:20px;width:54px;height:54px;border-radius:50%;border:0;cursor:pointer;background:#5B8DEF;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.28);font-size:22px;z-index:2147483000;display:flex;align-items:center;justify-content:center}"
    + ".pl-w-panel{position:fixed;right:20px;bottom:86px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#0E1116;color:#E6E9EF;border:1px solid rgba(255,255,255,.09);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.45);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}"
    + ".pl-w-panel.open{display:flex}"
    + ".pl-w-head{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);font-weight:600}"
    + ".pl-w-head small{display:block;font-weight:400;color:#8A93A6;font-size:11px;margin-top:2px}"
    + ".pl-w-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}"
    + ".pl-w-msg{max-width:80%;padding:8px 11px;border-radius:11px;white-space:pre-wrap;word-wrap:break-word}"
    + ".pl-w-visitor{align-self:flex-end;background:#5B8DEF;color:#fff;border-bottom-right-radius:3px}"
    + ".pl-w-agent{align-self:flex-start;background:rgba(255,255,255,.07);border-bottom-left-radius:3px}"
    + ".pl-w-foot{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08)}"
    + ".pl-w-foot input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 10px;color:#E6E9EF;font:inherit;outline:none}"
    + ".pl-w-foot button{border:0;border-radius:8px;background:#5B8DEF;color:#fff;padding:0 14px;cursor:pointer;font:inherit}"
    + ".pl-w-empty{color:#8A93A6;text-align:center;margin:auto;padding:0 20px}";
  var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  var launch = document.createElement("button");
  launch.className = "pl-w-launch"; launch.setAttribute("aria-label", "Open chat"); launch.textContent = "\\uD83D\\uDCAC";

  var panel = document.createElement("div"); panel.className = "pl-w-panel";
  var head = document.createElement("div"); head.className = "pl-w-head";
  head.textContent = "Chat with us";
  var sub = document.createElement("small"); sub.textContent = "We typically reply within a few minutes"; head.appendChild(sub);
  var msgs = document.createElement("div"); msgs.className = "pl-w-msgs";
  var empty = document.createElement("div"); empty.className = "pl-w-empty"; empty.textContent = "Send us a message and we'll get right back to you."; msgs.appendChild(empty);
  var foot = document.createElement("div"); foot.className = "pl-w-foot";
  var input = document.createElement("input"); input.type = "text"; input.placeholder = "Type your message\\u2026";
  var send = document.createElement("button"); send.textContent = "Send";
  foot.appendChild(input); foot.appendChild(send);
  panel.appendChild(head); panel.appendChild(msgs); panel.appendChild(foot);
  document.body.appendChild(launch); document.body.appendChild(panel);

  function render(list){
    msgs.innerHTML = "";
    if (!list || !list.length){ msgs.appendChild(empty); return; }
    list.forEach(function(m){
      var el = document.createElement("div");
      el.className = "pl-w-msg " + (m.role === "agent" ? "pl-w-agent" : "pl-w-visitor");
      el.textContent = m.text;
      msgs.appendChild(el);
    });
    lastCount = list.length;
    msgs.scrollTop = msgs.scrollHeight;
  }
  function apiUrl(p){ return CFG.base + "/api/widget/" + encodeURIComponent(CFG.key) + p; }
  function poll(){
    if (!convoId) return;
    fetch(apiUrl("/messages?conversationId=" + encodeURIComponent(convoId)))
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d && d.messages && d.messages.length !== lastCount) render(d.messages); })
      .catch(function(){});
  }
  function doSend(){
    var text = input.value.trim(); if (!text) return;
    input.value = "";
    var body = { text: text }; if (convoId) body.conversationId = convoId;
    fetch(apiUrl("/messages"), { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body) })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.conversationId){ convoId = d.conversationId; try { localStorage.setItem(STORE, convoId); } catch(e){} }
        if (d && d.messages) render(d.messages);
      })
      .catch(function(){});
  }
  function toggle(){
    open = !open; panel.classList.toggle("open", open);
    if (open){ input.focus(); poll(); timer = setInterval(poll, 4000); }
    else if (timer){ clearInterval(timer); timer = null; }
  }
  launch.addEventListener("click", toggle);
  send.addEventListener("click", doSend);
  input.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); doSend(); } });
})();`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "");
  const valid = key ? (await repo().resolveSiteKey(key)) !== null : false;
  return new Response(script(key, base, valid), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
