import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import type { Message } from '../lib/types'

export default function Composer({
  channelId,
  editing,
  onCancelEdit,
  onSent,
}: {
  channelId: string
  editing: Message | null
  onCancelEdit: () => void
  onSent: () => void
}) {
  const sendMessage = useApp((s) => s.sendMessage)
  const editMessage = useApp((s) => s.editMessage)
  const startTyping = useApp((s) => s.startTyping)
  const reply = useApp((s) => s.reply)
  const setReply = useApp((s) => s.setReply)
  const channelIndex = useApp((s) => s.channelIndex)

  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const channel = channelIndex[channelId]

  useEffect(() => {
    if (editing) {
      setValue(editing.content)
      textareaRef.current?.focus()
    }
  }, [editing])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [value])

  const submit = async () => {
    const body = value.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      if (editing) {
        await editMessage(editing, body)
        onCancelEdit()
      } else {
        await sendMessage(body)
      }
      setValue('')
      onSent()
    } catch (error) {
      // The store surfaces errors; keep the draft so nothing is lost.
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
    if (event.key === 'Escape' && editing) {
      onCancelEdit()
      setValue('')
    }
  }

  const placeholder =
    channel?.type === 1
      ? 'Message'
      : `Message #${channel?.name ?? 'channel'}`

  return (
    <div className="composer-wrap">
      {reply && !editing && (
        <div className="composer-banner">
          Replying to <strong>{reply.author}</strong>
          <button onClick={() => setReply(null)} aria-label="Cancel reply">
            ✕
          </button>
        </div>
      )}
      {editing && (
        <div className="composer-banner editing">
          Editing message
          <button
            onClick={() => {
              onCancelEdit()
              setValue('')
            }}
            aria-label="Cancel edit"
          >
            ✕
          </button>
        </div>
      )}
      <div className="composer">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value)
            if (!editing) void startTyping(channelId)
          }}
          onKeyDown={onKeyDown}
          maxLength={2000}
        />
        <div className="composer-actions">
          <span className={`char-count${value.length > 1900 ? ' warn' : ''}`}>
            {value.length > 1800 ? 2000 - value.length : ''}
          </span>
          <button
            className="send-btn"
            disabled={busy || value.trim().length === 0}
            onClick={() => void submit()}
            title={editing ? 'Save edit' : 'Send message'}
          >
            {editing ? 'Save' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
