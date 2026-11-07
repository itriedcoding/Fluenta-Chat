import { getLogs, onLog, type LogEntry } from './log'
import { allPlugins } from './plugins'
import {
  getPluginSetting,
  isPluginEnabled,
  runtime,
  setPluginEnabled,
  setPluginSetting,
} from './plugins/registry'
import { DEFAULT_CSS, applyTheme, THEME_KEY } from './plugins/theme'
import { clearMessageLog, getMessageLog } from './plugins/messageLogger'
import { MOD_VERSION } from '../shared/version'
import { checkModUpdate } from './updater'
import { RELEASES_URL } from './updater'

const PANEL_CSS = `
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
`

type Tab = 'plugins' | 'theme' | 'log'

export function mountPanel(): void {
  if (document.getElementById('fluenta-root')) return

  const host = document.createElement('div')
  host.id = 'fluenta-root'
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>${PANEL_CSS}</style>
    <button class="fab" title="Fluenta (Ctrl+Shift+F)">F</button>
    <section class="panel" hidden>
      <header class="head">
        <h1>Fluenta</h1><span class="ver">mod ${MOD_VERSION}</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-action="close" title="Close">✕</button>
      </header>
      <nav class="tabs">
        <button class="tab active" data-tab="plugins">Plugins</button>
        <button class="tab" data-tab="theme">Theme</button>
        <button class="tab" data-tab="log">Log</button>
      </nav>
      <div class="body"></div>
    </section>
  `

  const fab = shadow.querySelector('.fab') as HTMLButtonElement
  const panel = shadow.querySelector('.panel') as HTMLElement
  const body = shadow.querySelector('.body') as HTMLElement
  const tabs = Array.from(shadow.querySelectorAll('.tab')) as HTMLButtonElement[]
  let activeTab: Tab = 'plugins'

  const togglePanel = (open = panel.hasAttribute('hidden')) => {
    panel.toggleAttribute('hidden', !open)
    if (open) render()
  }

  fab.addEventListener('click', () => togglePanel())
  shadow.querySelector('[data-action="close"]')?.addEventListener('click', () => togglePanel(false))

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = (tab.dataset.tab as Tab) ?? 'plugins'
      tabs.forEach((other) => other.classList.toggle('active', other === tab))
      render()
    })
  })

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      togglePanel()
    }
  })

  function renderPlugins() {
    body.innerHTML = ''
    const title = document.createElement('p')
    title.className = 'section-title'
    title.textContent = 'Plugins'
    body.appendChild(title)

    for (const plugin of allPlugins) {
      const wrapper = document.createElement('div')
      wrapper.className = `plugin${isPluginEnabled(plugin) ? '' : ' disabled'}`

      const top = document.createElement('div')
      top.className = 'plugin-top'

      const name = document.createElement('span')
      name.className = 'plugin-name'
      name.textContent = plugin.name

      const toggle = document.createElement('input')
      toggle.type = 'checkbox'
      toggle.className = 'switch'
      toggle.checked = isPluginEnabled(plugin)
      toggle.addEventListener('change', () => {
        setPluginEnabled(plugin, toggle.checked)
        render()
      })

      top.append(name, toggle)
      wrapper.appendChild(top)

      const description = document.createElement('div')
      description.className = 'plugin-desc'
      description.textContent = plugin.description
      wrapper.appendChild(description)

      const status = runtime[plugin.id]
      if (status?.error) {
        const failure = document.createElement('div')
        failure.className = 'plugin-err'
        failure.textContent = `Not active: ${status.error}`
        wrapper.appendChild(failure)
      }

      if (plugin.id === 'keywordHighlight') {
        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = 'keywords, comma separated'
        input.value = getPluginSetting<string>(plugin.id, 'keywords', 'fluenta')
        input.style.marginTop = '8px'
        input.addEventListener('change', () => {
          setPluginSetting(plugin.id, 'keywords', input.value)
          setPluginEnabled(plugin, false)
          setPluginEnabled(plugin, true)
          render()
        })
        wrapper.appendChild(input)
      }

      body.appendChild(wrapper)
    }

    const note = document.createElement('p')
    note.className = 'hint'
    note.textContent =
      'Plugins run inside your own Discord client and only touch what is on this device. Toggling one applies immediately.'
    body.appendChild(note)

    const updateRow = document.createElement('div')
    updateRow.className = 'row'
    const updateButton = document.createElement('button')
    updateButton.className = 'btn'
    updateButton.textContent = 'Check for mod updates'
    updateButton.addEventListener('click', () => {
      updateButton.disabled = true
      updateButton.textContent = 'Checking…'
      void checkModUpdate()
        .then((result) => {
          updateButton.textContent = result
            ? `Update available: ${result.latest}`
            : 'Up to date'
          if (result) window.open(result.url, '_blank')
        })
        .catch(() => {
          updateButton.textContent = 'Open releases page'
          window.open(RELEASES_URL, '_blank')
        })
        .finally(() => {
          updateButton.disabled = false
        })
    })
    updateRow.appendChild(updateButton)
    body.appendChild(updateRow)
  }

  function renderTheme() {
    body.innerHTML = ''
    const title = document.createElement('p')
    title.className = 'section-title'
    title.textContent = 'Custom CSS'
    body.appendChild(title)

    const textarea = document.createElement('textarea')
    textarea.spellcheck = false
    textarea.value = getPluginSetting<string>('theme', THEME_KEY, DEFAULT_CSS)
    body.appendChild(textarea)

    const row = document.createElement('div')
    row.className = 'row'

    const apply = document.createElement('button')
    apply.className = 'btn primary'
    apply.textContent = 'Save & apply'
    apply.addEventListener('click', () => {
      setPluginSetting('theme', THEME_KEY, textarea.value)
      applyTheme(textarea.value)
      apply.textContent = 'Applied ✓'
      setTimeout(() => (apply.textContent = 'Save & apply'), 1400)
    })

    const reset = document.createElement('button')
    reset.className = 'btn'
    reset.textContent = 'Reset'
    reset.addEventListener('click', () => {
      textarea.value = DEFAULT_CSS
      setPluginSetting('theme', THEME_KEY, DEFAULT_CSS)
      applyTheme(DEFAULT_CSS)
    })

    row.append(apply, reset)
    body.appendChild(row)

    const hint = document.createElement('p')
    hint.className = 'hint'
    hint.textContent =
      'CSS is stored locally and re-applied on every launch while the Custom theme plugin is enabled.'
    body.appendChild(hint)
  }

  const renderLog = (entries: LogEntry[] = getLogs()) => {
    body.innerHTML = ''
    const title = document.createElement('p')
    title.className = 'section-title'
    title.textContent = `Runtime log (${entries.length})`
    body.appendChild(title)

    const list = document.createElement('div')
    list.className = 'log'
    if (entries.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty'
      empty.textContent = 'Nothing logged yet.'
      list.appendChild(empty)
    }
    for (const entry of entries.slice(-200)) {
      const line = document.createElement('div')
      line.className = `log-line ${entry.level}`
      const time = new Date(entry.at).toLocaleTimeString()
      line.textContent = `${time}  ${entry.message}`
      list.appendChild(line)
    }
    body.appendChild(list)

    const row = document.createElement('div')
    row.className = 'row'

    const exportLog = document.createElement('button')
    exportLog.className = 'btn'
    exportLog.textContent = 'Export messages'
    exportLog.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(getMessageLog(), null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'fluenta-message-log.json'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    })

    const clear = document.createElement('button')
    clear.className = 'btn danger'
    clear.textContent = 'Clear message log'
    clear.addEventListener('click', () => {
      clearMessageLog()
      clear.textContent = 'Cleared ✓'
      setTimeout(() => (clear.textContent = 'Clear message log'), 1400)
    })

    row.append(exportLog, clear)
    body.appendChild(row)

    const count = document.createElement('p')
    count.className = 'count'
    count.textContent = `${getMessageLog().length} logged message(s) stored on this device.`
    body.appendChild(count)
  }

  function render() {
    if (activeTab === 'plugins') renderPlugins()
    else if (activeTab === 'theme') renderTheme()
    else renderLog()
  }

  onLog((entries) => {
    if (activeTab === 'log' && !panel.hasAttribute('hidden')) renderLog(entries)
  })
}
