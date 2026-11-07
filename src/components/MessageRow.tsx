import { useState } from 'react'
import type { Message } from '../lib/types'
import { avatarUrl, displayName, formatFull, formatTime, formatBytes } from '../lib/ui'
import { renderMarkdown } from '../lib/markdown'
import { useApp } from '../lib/store'

const QUICK_EMOJIS = ['👍', '🔥', '😂', '❤️', '🎉', '👀', '😮', '✅']

export default function MessageRow({
  message,
  showHeader,
  isMine,
  onEdit,
}: {
  message: Message
  showHeader: boolean
  isMine: boolean
  onEdit: (message: Message) => void
}) {
  const [picking, setPicking] = useState(false)
  const toggleReaction = useApp((s) => s.toggleReaction)
  const deleteMessage = useApp((s) => s.deleteMessage)
  const setReply = useApp((s) => s.setReply)
  const resolveChannel = useApp((s) => s.resolveChannelName)
  const resolveUser = useApp((s) => s.resolveUserName)
  const resolveRole = useApp((s) => s.resolveRoleName)

  const author = message.author
  const name = message.member?.nick || displayName(author)
  const ctx = { resolveChannel, resolveUser, resolveRole }

  if (message.type === 7) {
    return (
      <div className="system-message">
        <strong>{name}</strong> joined the server.
      </div>
    )
  }

  return (
    <article className={`message${showHeader ? ' with-header' : ''}`}>
      <div className="message-gutter">
        {showHeader ? (
          <img
            className="message-avatar"
            src={avatarUrl(author, 64, message.guild_id, message.member?.avatar)}
            alt=""
            loading="lazy"
          />
        ) : (
          <time className="hover-time" title={formatFull(message.timestamp)}>
            {formatTime(message.timestamp)}
          </time>
        )}
      </div>

      <div className="message-body">
        {showHeader && (
          <div className="message-meta">
            <span className="message-author">{name}</span>
            {author.bot && <span className="bot-tag">BOT</span>}
            <time className="message-time" title={formatFull(message.timestamp)}>
              {formatTime(message.timestamp)}
            </time>
          </div>
        )}

        {message.referenced_message && (
          <div className="reply-quote">
            <span className="reply-author">
              {displayName(message.referenced_message.author)}
            </span>
            <span className="reply-text">
              {message.referenced_message.content.slice(0, 140) || 'attachment'}
            </span>
          </div>
        )}

        {message.content && (
          <div className="message-content">
            {renderMarkdown(message.content, ctx)}
            {message.edited_timestamp && <span className="edited"> (edited)</span>}
          </div>
        )}

        {message.attachments.length > 0 && (
          <div className="attachments">
            {message.attachments.map((file) => {
              const isImage = file.content_type?.startsWith('image/')
              const isVideo = file.content_type?.startsWith('video/')
              const isAudio = file.content_type?.startsWith('audio/')
              if (isImage) {
                return (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="attachment-image"
                  >
                    <img src={file.proxy_url ?? file.url} alt={file.description ?? file.filename} loading="lazy" />
                  </a>
                )
              }
              if (isVideo) {
                return (
                  <video key={file.id} controls src={file.url} className="attachment-video" />
                )
              }
              if (isAudio) {
                return <audio key={file.id} controls src={file.url} className="attachment-audio" />
              }
              return (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="attachment-file"
                >
                  <span className="file-icon">📎</span>
                  <span className="file-meta">
                    <span className="file-name">{file.filename}</span>
                    <span className="file-size">{formatBytes(file.size)}</span>
                  </span>
                </a>
              )
            })}
          </div>
        )}

        {message.embeds?.length > 0 && (
          <div className="embeds">
            {message.embeds.map((embed, index) => (
              <div
                key={index}
                className="embed"
                style={{ borderLeftColor: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : undefined }}
              >
                {embed.author && <div className="embed-author">{embed.author.name}</div>}
                {embed.title &&
                  (embed.url ? (
                    <a className="embed-title" href={embed.url} target="_blank" rel="noreferrer noopener">
                      {embed.title}
                    </a>
                  ) : (
                    <div className="embed-title">{embed.title}</div>
                  ))}
                {embed.description && (
                  <div className="embed-description">{renderMarkdown(embed.description, ctx)}</div>
                )}
                {embed.fields?.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="embed-field">
                    <div className="embed-field-name">{field.name}</div>
                    <div className="embed-field-value">{field.value}</div>
                  </div>
                ))}
                {embed.image && (
                  <img className="embed-image" src={embed.image.url} alt="" loading="lazy" />
                )}
                {embed.footer && <div className="embed-footer">{embed.footer.text}</div>}
              </div>
            ))}
          </div>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <div className="reactions">
            {message.reactions.map((reaction) => {
              const key = reaction.emoji.id
                ? `${reaction.emoji.name}:${reaction.emoji.id}`
                : (reaction.emoji.name ?? '')
              return (
                <button
                  key={key}
                  className={`reaction${reaction.me ? ' mine' : ''}`}
                  onClick={() => void toggleReaction(message, key)}
                  title={`${reaction.count} reaction${reaction.count === 1 ? '' : 's'}`}
                >
                  {reaction.emoji.id ? (
                    <img
                      className="reaction-emoji"
                      src={`https://cdn.discordapp.com/emojis/${reaction.emoji.id}.${
                        reaction.emoji.animated ? 'gif' : 'png'
                      }?size=32`}
                      alt={reaction.emoji.name ?? ''}
                    />
                  ) : (
                    <span>{reaction.emoji.name}</span>
                  )}
                  <span className="reaction-count">{reaction.count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="message-actions">
        <button
          className="msg-action"
          title="Reply"
          onClick={() =>
            setReply({
              messageId: message.id,
              channelId: message.channel_id,
              author: name,
              content: message.content,
            })
          }
        >
          ↩
        </button>
        <button className="msg-action" title="Add reaction" onClick={() => setPicking((v) => !v)}>
          ☺
        </button>
        {isMine && (
          <button
            className="msg-action"
            title="Edit"
            onClick={() => {
              onEdit(message)
            }}
          >
            ✎
          </button>
        )}
        {isMine && (
          <button
            className="msg-action danger"
            title="Delete"
            onClick={() => void deleteMessage(message)}
          >
            🗑
          </button>
        )}
        {picking && (
          <div className="emoji-pop">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  void toggleReaction(message, emoji)
                  setPicking(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
