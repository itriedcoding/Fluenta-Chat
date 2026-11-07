"use strict";(()=>{var v=[],j=new Set,U=(e,t)=>{v.push({at:Date.now(),level:e,message:t}),v.length>400&&v.splice(0,v.length-400);for(let n of j)n([...v])},k=e=>{console.log("[Fluenta]",e),U("info",e)},X=e=>{console.warn("[Fluenta]",e),U("warn",e)},N=(e,t)=>{console.error("[Fluenta]",e,t),U("error",t?`${e}: ${String(t)}`:e)},Q=()=>[...v],Z=e=>(j.add(e),()=>j.delete(e));var me=(e,t,n)=>new Promise((o,r)=>{let s=setTimeout(()=>r(new Error(`${n} timed out after ${t}ms`)),t);e.then(u=>{clearTimeout(s),o(u)},u=>{clearTimeout(s),r(u)})});function S(e,t){let n=document.getElementById(e);return n||(n=document.createElement("style"),n.id=e,document.head.appendChild(n)),n.textContent=t,()=>{n?.remove()}}function ee(e=2e4){return me(new Promise(t=>{if(Array.isArray(window.webpackChunkdiscord_app))return t();let n=setInterval(()=>{Array.isArray(window.webpackChunkdiscord_app)&&(clearInterval(n),t())},50)}),e,"Waiting for Discord webpack")}var he=`
[aria-label="Nitro"],
[aria-label="Send a gift"],
[class*="nitroButton"],
[class*="premiumPromo"],
[class*="premiumTrial"],
[class*="upsellContainer"],
[class*="giftButton"],
[class*="sidebar"] [class*="premium"],
[class*="shopButton"] {
  display: none !important;
}
`,te={id:"hideNitro",name:"Hide Nitro upsells",description:"Hides gift, shop and Nitro promotion buttons from the UI.",defaultEnabled:!0,start(e){return e.log("nitro surfaces hidden"),S("fluenta-hide-nitro",he)}};var be=`
.fluenta-keyword-hit {
  background: rgba(245, 165, 36, 0.18);
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(245, 165, 36, 0.35);
}
`,xe=e=>e.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean),ne={id:"keywordHighlight",name:"Keyword highlight",description:"Tints any message that contains one of your keywords. Set them in the Plugins tab.",defaultEnabled:!1,start(e){let t=xe(e.getSetting("keywords","fluenta"));if(t.length===0){e.warn("no keywords configured");return}let n=S("fluenta-keywords",be),o=!1,r=()=>{o=!1,document.querySelectorAll('[id^="message-content-"]').forEach(R=>{let B=(R.textContent??"").toLowerCase(),A=t.some(E=>B.includes(E));R.classList.toggle("fluenta-keyword-hit",A)})},s=()=>{o||(o=!0,requestAnimationFrame(r))},u=new MutationObserver(s);return u.observe(document.body,{childList:!0,subtree:!0}),s(),e.log(`watching ${t.length} keyword(s)`),()=>{u.disconnect(),n(),document.querySelectorAll(".fluenta-keyword-hit").forEach(h=>h.classList.remove("fluenta-keyword-hit"))}}};var q="fluenta.messageLog";var x=new Map;function _(){try{return JSON.parse(localStorage.getItem(q)??"[]")}catch{return[]}}function oe(e){let t=_();t.push(e),t.length>1e3&&t.splice(0,t.length-1e3);try{localStorage.setItem(q,JSON.stringify(t))}catch{}}function re(){x.clear();try{localStorage.removeItem(q)}catch{}}var ie={id:"messageLogger",name:"Message logger",description:"Remembers messages Discord deletes or edits locally, so you can still read them. Stored on this device only.",defaultEnabled:!1,start(e){let t=[e.subscribe("MESSAGE_CREATE",n=>{if(!n?.message)return;let o=n.message;if(x.set(o.id,{author:o.author?.username??"unknown",authorId:o.author?.id??"0",content:o.content??""}),x.size>4e3){let r=x.keys().next().value;r&&x.delete(r)}}),e.subscribe("MESSAGE_UPDATE",n=>{let o=n?.message;if(!o?.id)return;let r=x.get(o.id);r&&o.content&&r.content!==o.content&&(oe({at:Date.now(),kind:"edit",id:o.id,channelId:o.channel_id??n.channelId??"unknown",author:r.author,authorId:r.authorId,content:o.content,previous:r.content}),r.content=o.content),o.content&&x.set(o.id,{author:o.author?.username??r?.author??"unknown",authorId:o.author?.id??r?.authorId??"0",content:o.content})}),e.subscribe("MESSAGE_DELETE",n=>{if(!n?.id)return;let o=x.get(n.id);o&&(oe({at:Date.now(),kind:"delete",id:n.id,channelId:n.channel_id??"unknown",author:o.author,authorId:o.authorId,content:o.content}),x.delete(n.id))})];return e.log("listening for message create/edit/delete"),()=>t.forEach(n=>n())}};var P="css",C=`/*
 * Fluenta custom theme \u2014 plain CSS, applied live.
 * Discord's own classes are hashed, so prefer attribute selectors.
 */
:root {
  /* Example: softer corners and a red accent */
  --fluenta-accent: #ff5c7c;
}

[class*="messageContent"] a {
  text-decoration-thickness: 1px;
}
`;function M(e){return S("fluenta-theme",e)}var ae={id:"theme",name:"Custom theme",description:"Injects your own CSS into Discord. Edit it from the Theme tab.",defaultEnabled:!0,start(e){let t=e.getSetting(P,C);return e.log("theme applied"),M(t)}};var I=[ae,te,ie,ne];var T=null,W=new Map;function se(){if(T)return T;let t=window.webpackChunkdiscord_app??[];if(!Array.isArray(t))throw new Error("Discord webpack chunk array missing");if(t.push([[Symbol("fluenta-runtime")],{},n=>{T=n}]),!T)throw new Error("Discord webpack runtime not available");return T}function ye(e){let t=window.webpackChunkdiscord_app??[];for(let n of t){let o=n?.[1];if(!(!o||typeof o!="object"))for(let r of Object.keys(o)){let s=o[r];typeof s=="function"&&e(r,s)}}}function we(e){if(W.has(e))return W.get(e)??null;let t=null;try{t=se()(e)??null}catch{t=null}return W.set(e,t),t}var K=e=>{let t=[e];return e&&typeof e=="object"&&e.default&&typeof e.default=="object"&&t.push(e.default),t};function J(...e){let n=se().c??{};for(let o of Object.values(n))for(let r of K(o))if(e.every(s=>r?.[s]!==void 0))return r;for(let o of F(/./))for(let r of K(o))if(e.every(s=>r?.[s]!==void 0))return r;return null}function F(e,t=3e3){let n=[],o=new Set;return ye((r,s)=>{if(n.length>=t)return;let u;try{u=String(s)}catch{return}if(!e.test(u)||o.has(r))return;o.add(r);let h=we(r);h&&n.push(h)}),n}var L=null;function Ee(){if(L)return L;let e=J("dispatch","subscribe","unsubscribe","_actionHandlers");if(e&&typeof e.subscribe=="function")return L=e,L;for(let t of F(/isDispatching/))for(let n of K(t))if(typeof n?.subscribe=="function"&&typeof n?.dispatch=="function"&&n?._actionHandlers)return L=n,L;return null}function ce(e,t){let n=Ee();if(!n)throw new Error("Discord Flux dispatcher not found");return n.subscribe(e,t),()=>{try{n.unsubscribe(e,t)}catch{}}}var le="fluenta.plugins.enabled",ve=()=>{try{return JSON.parse(localStorage.getItem(le)??"{}")}catch{return{}}},ke=e=>{try{localStorage.setItem(le,JSON.stringify(e))}catch{}},Y=ve(),w={},G=new Map,$=e=>Y[e.id]??e.defaultEnabled??!1,z=(e,t,n)=>{try{let o=localStorage.getItem(`fluenta.plugins.${e}.${t}`);return o===null?n:JSON.parse(o)}catch{return n}},D=(e,t,n)=>{try{localStorage.setItem(`fluenta.plugins.${e}.${t}`,JSON.stringify(n))}catch{}};function Se(e){return{log:t=>k(`${e.name}: ${t}`),warn:t=>X(`${e.name}: ${t}`),getSetting:(t,n)=>z(e.id,t,n),setSetting:(t,n)=>D(e.id,t,n),subscribe:ce,findByProps:J,findBySource:F}}function Ce(e){G.get(e.id)?.(),G.delete(e.id),w[e.id]={enabled:!1}}function de(e){if(!$(e)){w[e.id]={enabled:!1};return}try{let t=e.start(Se(e));G.set(e.id,typeof t=="function"?t:void 0),w[e.id]={enabled:!0},k(`${e.name} enabled`)}catch(t){w[e.id]={enabled:!1,error:t instanceof Error?t.message:String(t)},N(`${e.name} failed to start`,t)}}function O(e,t){Y[e.id]=t,ke(Y),Ce(e),t?de(e):w[e.id]={enabled:!1}}function ue(e){for(let t of e)de(t)}var H="1.4.0";var pe="https://github.com/itriedcoding/Fluenta-Chat/releases",Le="https://api.github.com/repos/itriedcoding/Fluenta-Chat/releases/latest",Pe=(e,t)=>{let n=e.replace(/^v/i,"").split(".").map(Number),o=t.replace(/^v/i,"").split(".").map(Number);for(let r=0;r<3;r+=1){let s=(n[r]||0)-(o[r]||0);if(s!==0)return s>0?1:-1}return 0};async function ge(){let e=await fetch(Le,{headers:{Accept:"application/vnd.github+json"}});if(e.status===404)return null;if(!e.ok)throw new Error(`HTTP ${e.status}`);let t=await e.json(),n=t.tag_name.replace(/^v/i,"");if(Pe(n,H)<=0)return null;let o=t.assets.find(r=>r.name==="cli.cjs");return{latest:n,url:o?.browser_download_url??t.html_url}}var Te=`
:host { all: initial; }
* { box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
.fab {
  position: fixed; left: 14px; bottom: 14px; width: 42px; height: 42px;
  border-radius: 14px; border: none; cursor: pointer; z-index: 2147483000;
  background: linear-gradient(145deg, #7c5cff, #4f36c9); color: #fff;
  font-weight: 700; font-size: 18px; box-shadow: 0 10px 26px rgba(0,0,0,.45);
}
.fab:hover { filter: brightness(1.1); }
.panel {
  position: fixed; left: 14px; bottom: 66px; width: 400px; max-width: calc(100vw - 28px);
  max-height: min(620px, calc(100vh - 96px)); display: flex; flex-direction: column;
  background: #12151f; color: #e7eaf3; border: 1px solid #262d3f; border-radius: 14px;
  box-shadow: 0 30px 70px rgba(0,0,0,.6); z-index: 2147483001; overflow: hidden;
  font-size: 13px;
}
.panel[hidden] { display: none; }
.head { display:flex; align-items:center; gap:8px; padding: 12px 14px; border-bottom: 1px solid #232a3a; }
.head h1 { font-size: 14px; margin: 0; font-weight: 600; letter-spacing: .01em; }
.head .ver { font-size: 10px; color:#6f7890; }
.head .spacer { flex: 1; }
.icon-btn { background:none; border:none; color:#8b93a9; cursor:pointer; font-size:14px; }
.icon-btn:hover { color:#fff; }
.tabs { display:flex; gap:2px; padding: 8px 10px 0; }
.tab { background:none; border:none; color:#8b93a9; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:12px; }
.tab.active { background:#1d2333; color:#fff; }
.body { overflow-y:auto; padding: 12px 14px; flex:1; }
.section-title { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#69728a; margin: 0 0 8px; }
.plugin { border:1px solid #232a3a; border-radius:10px; padding:10px 12px; margin-bottom:8px; background:#161b27; }
.plugin.disabled { opacity:.72; }
.plugin-top { display:flex; align-items:center; gap:10px; }
.plugin-name { font-weight:600; font-size:13px; }
.plugin-desc { color:#8b93a9; font-size:11.5px; line-height:1.45; margin-top:4px; }
.plugin-err { color:#ff9b9b; font-size:11px; margin-top:6px; }
.switch { margin-left:auto; width:36px; height:20px; appearance:none; background:#252c3d; border-radius:20px; position:relative; cursor:pointer; border:none; flex:0 0 auto; }
.switch::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#8f98ad; transition:.16s; }
.switch:checked { background: rgba(124,92,255,.55); }
.switch:checked::after { transform: translateX(16px); background:#fff; }
textarea { width:100%; min-height:190px; resize: vertical; background:#0c0f18; color:#cfd6ea; border:1px solid #232a3a; border-radius:9px; padding:10px; font-family: ui-monospace, Consolas, monospace; font-size:11.5px; line-height:1.5; }
input[type=text] { width:100%; background:#0c0f18; color:#cfd6ea; border:1px solid #232a3a; border-radius:9px; padding:8px 10px; font-size:12px; }
.row { display:flex; gap:8px; margin-top:8px; }
.btn { background:#232a3c; border:1px solid #303950; color:#e7eaf3; border-radius:8px; padding:7px 11px; font-size:12px; cursor:pointer; }
.btn:hover { background:#2b3346; }
.btn.primary { background:#7c5cff; border-color:#7c5cff; color:#fff; font-weight:600; }
.btn.danger { background: rgba(240,82,82,.15); border-color: rgba(240,82,82,.4); color:#ff9b9b; }
.log { font-family: ui-monospace, Consolas, monospace; font-size:11px; line-height:1.55; color:#8b93a9; }
.log-line { margin-bottom:3px; word-break: break-word; }
.log-line.error { color:#ff9b9b; }
.log-line.warn { color:#f5c06b; }
.empty { color:#69728a; font-size:12px; }
.hint { color:#69728a; font-size:11px; line-height:1.5; margin-top:8px; }
.count { color:#69728a; font-size:11px; }
`;function fe(){if(document.getElementById("fluenta-root"))return;let e=document.createElement("div");e.id="fluenta-root",document.documentElement.appendChild(e);let t=e.attachShadow({mode:"open"});t.innerHTML=`
    <style>${Te}</style>
    <button class="fab" title="Fluenta (Ctrl+Shift+F)">F</button>
    <section class="panel" hidden>
      <header class="head">
        <h1>Fluenta</h1><span class="ver">mod ${H}</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-action="close" title="Close">\u2715</button>
      </header>
      <nav class="tabs">
        <button class="tab active" data-tab="plugins">Plugins</button>
        <button class="tab" data-tab="theme">Theme</button>
        <button class="tab" data-tab="log">Log</button>
      </nav>
      <div class="body"></div>
    </section>
  `;let n=t.querySelector(".fab"),o=t.querySelector(".panel"),r=t.querySelector(".body"),s=Array.from(t.querySelectorAll(".tab")),u="plugins",h=(a=o.hasAttribute("hidden"))=>{o.toggleAttribute("hidden",!a),a&&E()};n.addEventListener("click",()=>h()),t.querySelector('[data-action="close"]')?.addEventListener("click",()=>h(!1)),s.forEach(a=>{a.addEventListener("click",()=>{u=a.dataset.tab??"plugins",s.forEach(l=>l.classList.toggle("active",l===a)),E()})}),document.addEventListener("keydown",a=>{a.ctrlKey&&a.shiftKey&&a.key.toLowerCase()==="f"&&(a.preventDefault(),h())});function R(){r.innerHTML="";let a=document.createElement("p");a.className="section-title",a.textContent="Plugins",r.appendChild(a);for(let i of I){let d=document.createElement("div");d.className=`plugin${$(i)?"":" disabled"}`;let y=document.createElement("div");y.className="plugin-top";let p=document.createElement("span");p.className="plugin-name",p.textContent=i.name;let g=document.createElement("input");g.type="checkbox",g.className="switch",g.checked=$(i),g.addEventListener("change",()=>{O(i,g.checked),E()}),y.append(p,g),d.appendChild(y);let b=document.createElement("div");b.className="plugin-desc",b.textContent=i.description,d.appendChild(b);let V=w[i.id];if(V?.error){let m=document.createElement("div");m.className="plugin-err",m.textContent=`Not active: ${V.error}`,d.appendChild(m)}if(i.id==="keywordHighlight"){let m=document.createElement("input");m.type="text",m.placeholder="keywords, comma separated",m.value=z(i.id,"keywords","fluenta"),m.style.marginTop="8px",m.addEventListener("change",()=>{D(i.id,"keywords",m.value),O(i,!1),O(i,!0),E()}),d.appendChild(m)}r.appendChild(d)}let l=document.createElement("p");l.className="hint",l.textContent="Plugins run inside your own Discord client and only touch what is on this device. Toggling one applies immediately.",r.appendChild(l);let f=document.createElement("div");f.className="row";let c=document.createElement("button");c.className="btn",c.textContent="Check for mod updates",c.addEventListener("click",()=>{c.disabled=!0,c.textContent="Checking\u2026",ge().then(i=>{c.textContent=i?`Update available: ${i.latest}`:"Up to date",i&&window.open(i.url,"_blank")}).catch(()=>{c.textContent="Open releases page",window.open(pe,"_blank")}).finally(()=>{c.disabled=!1})}),f.appendChild(c),r.appendChild(f)}function B(){r.innerHTML="";let a=document.createElement("p");a.className="section-title",a.textContent="Custom CSS",r.appendChild(a);let l=document.createElement("textarea");l.spellcheck=!1,l.value=z("theme",P,C),r.appendChild(l);let f=document.createElement("div");f.className="row";let c=document.createElement("button");c.className="btn primary",c.textContent="Save & apply",c.addEventListener("click",()=>{D("theme",P,l.value),M(l.value),c.textContent="Applied \u2713",setTimeout(()=>c.textContent="Save & apply",1400)});let i=document.createElement("button");i.className="btn",i.textContent="Reset",i.addEventListener("click",()=>{l.value=C,D("theme",P,C),M(C)}),f.append(c,i),r.appendChild(f);let d=document.createElement("p");d.className="hint",d.textContent="CSS is stored locally and re-applied on every launch while the Custom theme plugin is enabled.",r.appendChild(d)}let A=(a=Q())=>{r.innerHTML="";let l=document.createElement("p");l.className="section-title",l.textContent=`Runtime log (${a.length})`,r.appendChild(l);let f=document.createElement("div");if(f.className="log",a.length===0){let p=document.createElement("div");p.className="empty",p.textContent="Nothing logged yet.",f.appendChild(p)}for(let p of a.slice(-200)){let g=document.createElement("div");g.className=`log-line ${p.level}`;let b=new Date(p.at).toLocaleTimeString();g.textContent=`${b}  ${p.message}`,f.appendChild(g)}r.appendChild(f);let c=document.createElement("div");c.className="row";let i=document.createElement("button");i.className="btn",i.textContent="Export messages",i.addEventListener("click",()=>{let p=new Blob([JSON.stringify(_(),null,2)],{type:"application/json"}),g=URL.createObjectURL(p),b=document.createElement("a");b.href=g,b.download="fluenta-message-log.json",b.click(),setTimeout(()=>URL.revokeObjectURL(g),5e3)});let d=document.createElement("button");d.className="btn danger",d.textContent="Clear message log",d.addEventListener("click",()=>{re(),d.textContent="Cleared \u2713",setTimeout(()=>d.textContent="Clear message log",1400)}),c.append(i,d),r.appendChild(c);let y=document.createElement("p");y.className="count",y.textContent=`${_().length} logged message(s) stored on this device.`,r.appendChild(y)};function E(){u==="plugins"?R():u==="theme"?B():A()}Z(a=>{u==="log"&&!o.hasAttribute("hidden")&&A(a)})}async function De(){let e=window;e.__fluentaBooted||(e.__fluentaBooted=!0,await ee(),k("Discord webpack module system detected"),ue(I),fe(),k("Fluenta is running \u2014 press Ctrl+Shift+F to open the panel"))}De().catch(e=>{N("Fluenta failed to boot",e)});})();
