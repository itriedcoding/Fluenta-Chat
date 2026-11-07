import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import MessageRow from './MessageRow'
import Composer from './Composer'
import { channelLabel, formatDay } from '../lib/ui'
import type { Message } from '../lib/types'
import { CHANNEL } from '../lib/types'

export default function Chat() {
  const channelId = useApp((s) => s.selectedChannelId)
  const channelIndex = useApp((s) => s.channelIndex)
  const guilds = useApp((s) => s.guilds)
  const selectedGuildId = useApp((s) => s.selectedGuildId)
  const messages = useApp((s) => (channelId ? s.messagesByChannel[channelId] : undefined))
  const typing = useApp((s) => (channelId ? s.typingByChannel[channelId] : undefined))
  const loading = useApp((s) => (channelId ? s.loadingMessages[channelId] : false))
  const hasMore = useApp((s) => (channelId ? s.hasMore[channelId] : false))
  const loadMore = useApp((s) => s.loadMoreMessages)
  const setMobilePane = useApp((s) => s.setMobilePane)
  const me = useApp((s) => s.me)

  const [editing, setEditing] = useState<Message | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevHeight = useRef<number | null>(null)
  const atBottomRef = useRef(true)

  const channel = channelId ? channelIndex[channelId] : undefined
  const guild = guilds.find((g) => g.id === selectedGuildId)

  useEffect(() => {
    setEditing(null)
    const scroller = scrollerRef.current
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
      atBottomRef.current = true
    }
  }, [channelId])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (atBottomRef.current) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }, [messages?.length, typing?.length])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller && prevHeight.current !== null) {
      scroller.scrollTop += scroller.scrollHeight - prevHeight.current
      prevHeight.current = null
    }
  }, [messages])

  const onScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    atBottomRef.current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80
    if (scroller.scrollTop < 120 && hasMore && channelId && !loading && !prevHeight.current) {
      prevHeight.current = scroller.scrollHeight
      void loadMore(channelId)
    }
  }

  if (!channelId || !channel) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-inner">
          <div className="brand-mark large">F</div>
          <h2>Pick a conversation</h2>
          <p>Choose a server channel or a direct message on the left to start reading.</p>
        </div>
      </div>
    )
  }

  const isDm = channel.type === CHANNEL.DM || channel.type === CHANNEL.GROUP_DM
  const title = isDm ? channelLabel(channel) : channelLabel(channel)

  return (
    <div className="chat">
      <header className="chat-header">
        <button
          className="back-btn"
          onClick={() => setMobilePane('channels')}
          aria-label="Back to channels"
        >
          ‹
        </button>
        <span className="chat-channel-icon">{isDm ? '@' : '#'}</span>
        <span className="chat-channel-name">{title}</span>
        {guild && !isDm && <span className="chat-guild-tag">{guild.name}</span>}
        {channel.topic && <span className="chat-topic">{channel.topic}</span>}
      </header>

      <div className="messages" ref={scrollerRef} onScroll={onScroll}>
        {loading && !messages?.length && <div className="messages-loading">Loading history…</div>}
        {hasMore && (
          <button
            className="load-more"
            onClick={() => {
              if (channelId) {
                prevHeight.current = scrollerRef.current?.scrollHeight ?? null
                void loadMore(channelId)
              }
            }}
          >
            Load older messages
          </button>
        )}
        {(!messages || messages.length === 0) && !loading && (
          <div className="channel-intro">
            <div className="channel-intro-icon">{isDm ? '@' : '#'}</div>
            <h2>{title}</h2>
            <p>{isDm ? 'This is the beginning of your conversation.' : `This is the start of #${title}.`}</p>
          </div>
        )}

        {messages?.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined
          const newDay =
            !previous || formatDay(previous.timestamp) !== formatDay(message.timestamp)
          const groupable =
            previous &&
            previous.author.id === message.author.id &&
            previous.type === 0 &&
            message.type === 0 &&
            new Date(message.timestamp).getTime() -
              new Date(previous.timestamp).getTime() <
              5 * 60 * 1000 &&
            !message.referenced_message

          return (
            <div key={message.id}>
              {newDay && (
                <div className="day-divider">
                  <span>{formatDay(message.timestamp)}</span>
                </div>
              )}
              <MessageRow
                message={message}
                showHeader={!groupable}
                isMine={message.author.id === me?.id}
                onEdit={(msg) => setEditing(msg)}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="typing-line">
        {typing && typing.length > 0 && (
          <>
            <span className="typing-dots">
              <i />
              <i />
              <i />
            </span>
            <span>
              {typing.slice(0, 3).map((t) => t.name).join(', ')}
              {typing.length > 3 ? ` and ${typing.length - 3} more` : ''}{' '}
              {typing.length === 1 ? 'is' : 'are'} typing…
            </span>
          </>
        )}
      </div>

      <Composer
        channelId={channelId}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSent={() => {
          atBottomRef.current = true
          const scroller = scrollerRef.current
          if (scroller) scroller.scrollTop = scroller.scrollHeight
        }}
      />
    </div>
  )
}
