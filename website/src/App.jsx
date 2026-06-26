import React, { useEffect, useRef, useState, createContext, useContext } from 'react'
import { languages, getTranslation } from './i18n'
import './index.css'
import './App.css'

const LangContext = createContext('en')
const useLang = () => useContext(LangContext)
const useT = () => getTranslation(useLang())

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = languages.find(l => l.code === lang) || languages[0]
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="lang" ref={ref}>
      <button className="lang__btn" onClick={() => setOpen(!open)} aria-label="Language">
        <span>{current.flag}</span><span className="lang__caret">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="lang__menu">
          {languages.map(l => (
            <button key={l.code} className={`lang__item ${l.code === lang ? 'is-active' : ''}`}
              onClick={() => { setLang(l.code); setOpen(false) }}>{l.flag}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function Nav({ lang, setLang }) {
  const [scrolled, setScrolled] = useState(false)
  const t = useT()
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  return (
    <nav className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="nav__inner">
        <a href="#" className="nav__logo">Pose&nbsp;Studio</a>
        <div className="nav__links">
          <a href="#features">{t.nav.features}</a>
          <a href="#howitworks">{t.nav.howItWorks}</a>
          <a href="#citation">{t.nav.citation}</a>
          <a href="https://github.com/weixijia/ViTPoseStudio">{t.nav.github}</a>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  const t = useT()
  return (
    <section className="hero">
      <div className="hero__beam" aria-hidden="true" />
      <div className="container hero__inner">
        <div className="hero__badge">{t.hero.badge}</div>
        <h1 className="hero__title">{t.hero.title1} {t.hero.title2}</h1>
        <p className="hero__sub">{t.hero.subtitle1} {t.hero.subtitle2}</p>
        <div className="hero__actions">
          <a href="https://github.com/weixijia/ViTPoseStudio" className="btn btn--primary">{t.hero.btnDownload}</a>
          <a href="https://github.com/weixijia/ViTPoseStudio/releases" className="btn btn--ghost">{t.hero.btnReleases}</a>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const [ref, v] = useInView()
  const t = useT()
  return (
    <section id="features" className="section" ref={ref}>
      <div className="container">
        <div className={`head ${v ? 'reveal' : 'pre'}`}>
          <span className="eyebrow">{t.features.eyebrow}</span>
          <h2>{t.features.title1} {t.features.title2}</h2>
          <p>{t.features.subtitle}</p>
        </div>
        <div className="grid">
          {t.features.items.map((it, i) => (
            <div key={i} className={`card ${v ? 'reveal' : 'pre'}`} style={{ transitionDelay: `${0.06 * i}s` }}>
              <h3>{it.title}</h3><p>{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const [ref, v] = useInView()
  const t = useT()
  return (
    <section id="howitworks" className="section" ref={ref}>
      <div className="container">
        <div className={`head ${v ? 'reveal' : 'pre'}`}>
          <span className="eyebrow">{t.howItWorks.eyebrow}</span>
          <h2>{t.howItWorks.title1} {t.howItWorks.title2}</h2>
          <p>{t.howItWorks.subtitle}</p>
        </div>
        <div className="grid">
          {t.howItWorks.cards.map((c, i) => (
            <div key={i} className={`card ${v ? 'reveal' : 'pre'}`} style={{ transitionDelay: `${0.06 * i}s` }}>
              <span className="card__num mono">{c.step}</span>
              <h3>{c.title}</h3><p>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const BIBTEX = {
  vomee: `@inproceedings{10.1145/3737904.3768536,
  author    = {Wei, Xijia and Fang, Yuan and Chetty, Kevin and Cho, Youngjun and Bianchi-Berthouze, Nadia},
  title     = {Vomee: A Multimodal Sensing Platform for Video, Audio, mmWave and Skeleton Data Capturing},
  year      = {2025},
  booktitle = {Proceedings of the 2025 ACM Workshop on Access Networks with Artificial Intelligence},
  pages     = {36--40},
  doi       = {10.1145/3737904.3768536},
  series    = {MobiCom '25}
}`,
  pose2sim: `@Article{Pagnon_2022_JOSS,
  author  = {Pagnon, David and Domalain, Mathieu and Reveret, Lionel},
  title   = {Pose2Sim: An open-source Python package for multiview markerless kinematics},
  journal = {Journal of Open Source Software},
  year    = {2022},
  doi     = {10.21105/joss.04362}
}`,
  yolo: `@software{yolo_ultralytics,
  author  = {Glenn Jocher and Jing Qiu},
  title   = {Ultralytics YOLO},
  year    = {2026},
  url     = {https://github.com/ultralytics/ultralytics},
  license = {AGPL-3.0}
}`,
}

function Citation() {
  const [ref, v] = useInView()
  const t = useT()
  const items = [
    { text: t.citation.subtitleVomee, code: BIBTEX.vomee, link: null },
    { text: t.citation.subtitlePose2Sim, code: BIBTEX.pose2sim, link: { href: 'https://github.com/perfanalytics/pose2sim', label: 'perfanalytics/Pose2Sim' } },
    { text: t.citation.subtitleYolo, code: BIBTEX.yolo, link: { href: 'https://github.com/ultralytics/ultralytics', label: 'Ultralytics/YOLO' } },
  ]
  return (
    <section id="citation" className="section" ref={ref}>
      <div className="container">
        <div className={`head ${v ? 'reveal' : 'pre'}`}>
          <span className="eyebrow">{t.citation.eyebrow}</span>
          <h2>{t.citation.title1}</h2>
        </div>
        <div className={`cites ${v ? 'reveal' : 'pre'}`}>
          {items.map((it, i) => (
            <div key={i} className="cite">
              <p>{it.text}{it.link && <> <a href={it.link.href} target="_blank" rel="noreferrer">{it.link.label}</a></>}</p>
              <pre className="bibtex"><code>{it.code}</code></pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const t = useT()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <div className="footer__logo">Pose&nbsp;Studio</div>
            <p className="footer__desc">{t.footer.brandDesc}</p>
            <p className="footer__copy">{t.footer.copyright}</p>
          </div>
          <div className="footer__cols">
            {t.footer.columns.map((col, i) => (
              <div key={i} className="footer__col">
                <h4>{col.title}</h4>
                {col.links.map((l, j) => <a key={j} href={l.href}>{l.label}</a>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('posestudio-lang')
    if (saved && languages.some(l => l.code === saved)) return saved
    return navigator.language.toLowerCase().startsWith('zh') ? 'cn' : 'en'
  })
  useEffect(() => { localStorage.setItem('posestudio-lang', lang) }, [lang])
  return (
    <LangContext.Provider value={lang}>
      <Nav lang={lang} setLang={setLang} />
      <Hero />
      <Features />
      <HowItWorks />
      <Citation />
      <Footer />
    </LangContext.Provider>
  )
}
