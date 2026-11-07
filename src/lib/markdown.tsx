import { useState, type ReactNode } from 'react'

export interface RenderCtx {
  resolveChannel: (id: string) => string | null
  resolveUser: (id: string) => string | null
  resolveRole: (id: string) => string | null
}

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`spoiler${open ? ' spoiler-open' : ''}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        setOpen(true)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setOpen(true)
      }}
    >
      {children}
    </span>
  )
}

const LINK = /^(https?:\/\/[^\s]+)$/
const INLINE =
  /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`|\|\|[\s\S]+?\|\||<a?:\w+:\d+>|<@!?\d+>|<@&\d+>|<#\d+>|https?:\/\/[^\s<>()]+|<t:(\d+)(?::([tTdDfFR]))?>)/g

const EMOJI_CDN = 'https://cdn.discordapp.com/emojis'

function renderTimestamp(seconds: number, style: string | undefined) {
  const date = new Date(seconds * 1000)
  switch (style) {
    case 'd':
      return date.toLocaleDateString()
    case 't':
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    case 'D':
      return date.toLocaleDateString(undefined, { dateStyle: 'long' })
    case 'f':
      return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    case 'F':
      return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
    case 'R':
      return relativeFrom(date)
    default:
      return date.toLocaleString()
  }
}

function relativeFrom(date: Date): string {
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ]
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      return fmt.format(Math.round(diff / ms), unit)
    }
  }
  return date.toLocaleString()
}

function inlineNodes(text: string, ctx: RenderCtx, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let index = 0
  INLINE.lastIndex = 0

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${index}`
    index += 1

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key}>{inlineNodes(token.slice(2, -2), ctx, key)}</strong>,
      )
    } else if (token.startsWith('__') && token.endsWith('__')) {
      nodes.push(<u key={key}>{inlineNodes(token.slice(2, -2), ctx, key)}</u>)
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(<s key={key}>{inlineNodes(token.slice(2, -2), ctx, key)}</s>)
    } else if (token.startsWith('||') && token.endsWith('||')) {
      nodes.push(
        <Spoiler key={key}>{inlineNodes(token.slice(2, -2), ctx, key)}</Spoiler>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={key} className="inline-code">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      nodes.push(<em key={key}>{inlineNodes(token.slice(1, -1), ctx, key)}</em>)
    } else if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      nodes.push(<em key={key}>{inlineNodes(token.slice(1, -1), ctx, key)}</em>)
    } else if (token.startsWith('<@&')) {
      const id = token.slice(3, -1)
      const name = ctx.resolveRole(id)
      nodes.push(
        <span key={key} className={`mention${name ? '' : ' mention-missing'}`}>
          @{name ?? 'unknown-role'}
        </span>,
      )
    } else if (token.startsWith('<@')) {
      const id = token.replace(/[<@!>]/g, '')
      const name = ctx.resolveUser(id)
      nodes.push(
        <span key={key} className={`mention${name ? '' : ' mention-missing'}`}>
          @{name ?? 'unknown'}
        </span>,
      )
    } else if (token.startsWith('<#')) {
      const id = token.slice(2, -1)
      const name = ctx.resolveChannel(id)
      nodes.push(
        <span key={key} className={`mention${name ? '' : ' mention-missing'}`}>
          #{name ?? 'unknown-channel'}
        </span>,
      )
    } else if (token.startsWith('<:') || token.startsWith('<a:')) {
      const parts = token.slice(1, -1).split(':')
      const animated = parts[0] === 'a'
      const name = parts[1]
      const id = parts[2]
      nodes.push(
        <img
          key={key}
          className="custom-emoji"
          src={`${EMOJI_CDN}/${id}.${animated ? 'gif' : 'png'}?size=32`}
          alt={`:${name}:`}
          title={`:${name}:`}
          loading="lazy"
        />,
      )
    } else if (token.startsWith('<t:')) {
      const body = token.slice(3, -1).split(':')
      nodes.push(
        <span key={key} className="timestamp-chip">
          {renderTimestamp(Number(body[0]), body[1])}
        </span>,
      )
    } else if (LINK.test(token)) {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noreferrer noopener">
          {token}
        </a>,
      )
    } else {
      nodes.push(token)
    }
    last = match.index + token.length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function codeBlock(source: string, key: string): ReactNode {
  const newline = source.indexOf('\n')
  const language = newline > -1 ? source.slice(0, newline).trim() : ''
  const body = newline > -1 ? source.slice(newline + 1) : source
  return (
    <div key={key} className="codeblock">
      {language && (
        <div className="codeblock-lang">
          <span>{language}</span>
        </div>
      )}
      <pre>
        <code>{body.replace(/\n$/, '')}</code>
      </pre>
    </div>
  )
}

/** Renders Discord message markdown into React nodes (no innerHTML, no XSS). */
export function renderMarkdown(content: string, ctx: RenderCtx): ReactNode {
  if (!content) return null
  const parts = content.split(/```([\s\S]*?)```/g)
  return parts.map((part, index) => {
    if (index % 2 === 1) return codeBlock(part, `block-${index}`)
    if (!part) return null
    return <span key={`text-${index}`}>{inlineNodes(part, ctx, `t${index}`)}</span>
  })
}
