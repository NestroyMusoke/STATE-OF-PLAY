import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import type { Headline } from '../types'

type LiveSourceFeedProps = {
  headlines: Headline[]
}

function publishedTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'TIME UNCONFIRMED'
    : `${date.toISOString().slice(5, 10)} // ${date.toISOString().slice(11, 16)}Z`
}

export function LiveSourceFeed({ headlines }: LiveSourceFeedProps) {
  const [open, setOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<Headline | null>(null)
  const feed = headlines.slice(0, 12)
  const videoCount = feed.filter((headline) => headline.kind === 'video').length

  return (
    <>
      <button
        type="button"
        className="source-feed-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        LIVE SOURCES // {String(feed.length).padStart(2, '0')}
        {videoCount > 0 && <span>{videoCount} VIDEO</span>}
      </button>

      <AnimatePresence>
        {open && (
          <m.aside
            className="source-feed-drawer hud-frame"
            aria-label="Live news and video sources"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
          >
            <header>
              <div>
                <span>NEWS + VIDEO // LIVE</span>
                <h2>WHAT THE WORLD IS WATCHING</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close live sources">
                ×
              </button>
            </header>

            {selectedVideo?.videoId && (
              <section className="source-video-player">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?rel=0`}
                  title={selectedVideo.title}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <strong>{selectedVideo.title}</strong>
                <span>{selectedVideo.source} // PRESS PLAY WHEN READY</span>
              </section>
            )}

            <ol className="source-feed-list">
              {feed.map((headline) => (
                <li key={headline.id}>
                  {headline.thumbnailUrl && (
                    <img src={headline.thumbnailUrl} alt="" loading="lazy" />
                  )}
                  <div>
                    <span>
                      {headline.kind === 'video' ? 'VIDEO' : 'ARTICLE'} //{' '}
                      {publishedTime(headline.publishedAt)}
                    </span>
                    <strong>{headline.title}</strong>
                    <small>{headline.source}</small>
                    {headline.kind === 'video' && headline.videoId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedVideo(headline)}
                      >
                        WATCH REPORT
                      </button>
                    ) : (
                      <a href={headline.url} target="_blank" rel="noreferrer">
                        READ STORY ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </m.aside>
        )}
      </AnimatePresence>
    </>
  )
}
