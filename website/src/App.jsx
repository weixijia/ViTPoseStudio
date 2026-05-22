import React, { useEffect, useRef, useState, createContext, useContext } from 'react'
import { languages, getTranslation } from './i18n'
import './index.css'
import './App.css'

const LangContext = createContext('en')

function useLang() {
  return useContext(LangContext)
}

function useT() {
  const lang = useLang()
  return getTranslation(lang)
}

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [isVisible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, isVisible]
}

function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = languages.find(l => l.code === lang) || languages[0]

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="lang-switcher" ref={ref}>
      <button className="lang-switcher__btn" onClick={() => setOpen(!open)}>
        <span>🌐</span>
        <span>{current.label}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="lang-switcher__dropdown">
          {languages.map(l => (
            <button
              key={l.code}
              className={`lang-switcher__item ${l.code === lang ? 'lang-switcher__item--active' : ''}`}
              onClick={() => { setLang(l.code); setOpen(false) }}
            >
              <span>{l.flag}</span> {l.label}
            </button>
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
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav__inner">
        <a href="#" className="nav__logo">VP Mirror</a>
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
      <div className="hero__bg-glow" />
      <div className="container fade-up">
        <div className="hero__badge">{t.hero.badge}</div>
        <h1>
          {t.hero.title1} <br/> <span className="accent">{t.hero.title2}</span>
        </h1>
        <p>
          {t.hero.subtitle1} <br/> {t.hero.subtitle2}
        </p>
        <a href="https://github.com/weixijia/ViTPoseStudio" className="btn">
          {t.hero.btnDownload}
        </a>
      </div>
    </section>
  )
}

function Features() {
  const [ref, visible] = useInView()
  const t = useT()
  
  return (
    <section id="features" className="section-padding" ref={ref}>
      <div className="container">
        <div className={`section-header ${visible ? 'fade-up' : 'pre-fade'}`}>
          <h2>{t.features.title1} <br/> <span className="accent">{t.features.title2}</span></h2>
          <p>{t.features.subtitle}</p>
        </div>
        <div className="grid-3">
          {t.features.items.map((item, i) => (
            <div key={i} className={`glass-card ${visible ? 'fade-up' : 'pre-fade'}`} style={{ animationDelay: `${0.1 * i + 0.1}s` }}>
              <div className="feature-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const [ref, visible] = useInView()
  const t = useT()

  return (
    <section id="howitworks" className="section-padding" ref={ref}>
      <div className="container">
        <div className={`section-header ${visible ? 'fade-up' : 'pre-fade'}`}>
          <h2>{t.howItWorks.title1} <br/> <span className="accent">{t.howItWorks.title2}</span></h2>
          <p>{t.howItWorks.subtitle}</p>
        </div>
        <div className="grid-3">
          {t.howItWorks.cards.map((card, i) => (
            <div key={i} className={`glass-card ${visible ? 'fade-up' : 'pre-fade'}`} style={{ animationDelay: `${0.1 * i + 0.1}s` }}>
              <span className="step-number">{card.step}</span>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Citation() {
  const [ref, visible] = useInView()
  const t = useT()

  return (
    <section id="citation" className="section-padding" ref={ref}>
      <div className="container">
        <div className={`citation-box ${visible ? 'fade-up' : 'pre-fade'}`}>
          <h2>{t.citation.title1}</h2>
          <p>{t.citation.subtitle}</p>
          <div className="bibtex-code">
{`@inproceedings{10.1145/3737904.3768536,
  author = {Wei, Xijia and Fang, Yuan and Chetty, Kevin and Cho, Youngjun and Bianchi-Berthouze, Nadia},
  title = {Vomee: A Multimodal Sensing Platform for Video, Audio, mmWave and Skeleton Data Capturing},
  year = {2025},
  isbn = {9798400719813},
  publisher = {Association for Computing Machinery},
  address = {New York, NY, USA},
  url = {https://doi.org/10.1145/3737904.3768536},
  doi = {10.1145/3737904.3768536},
  booktitle = {Proceedings of the 2025 ACM Workshop on Access Networks with Artificial Intelligence},
  pages = {36--40}
}`}
          </div>
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
        <div className="footer__links">
          {t.footer.links.map((link, i) => (
            <a key={i} href="#">{link}</a>
          ))}
        </div>
        <p className="footer__copy">{t.footer.copyright}</p>
      </div>
    </footer>
  )
}

function Contributors() {
  const [ref, visible] = useInView()
  const t = useT()

  return (
    <section id="contributors" className="section-padding" ref={ref}>
      <div className="container">
        <div className={`section-header ${visible ? 'fade-up' : 'pre-fade'}`}>
          <h2>{t.contributors.title1} <br/> <span className="accent">{t.contributors.title2}</span></h2>
          <p>{t.contributors.subtitle}</p>
        </div>
        <div className="grid-3" style={{ justifyContent: 'center', display: 'flex', flexWrap: 'wrap' }}>
          {t.contributors.members.map((member, i) => (
            <div key={i} className={`glass-card ${visible ? 'fade-up' : 'pre-fade'}`} style={{ animationDelay: `${0.1 * i + 0.1}s`, minWidth: '300px', textAlign: 'center' }}>
              <div className="feature-icon" style={{ margin: '0 auto 24px', fontSize: '40px' }}>👨‍💻</div>
              <h3>{member.name}</h3>
              <p><a href={`mailto:${member.email}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{member.email}</a></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('vpmirror-lang')
    if (saved && languages.some(l => l.code === saved)) return saved
    const browserLang = navigator.language.toLowerCase()
    if (browserLang.startsWith('zh')) return 'cn'
    return 'en'
  })

  useEffect(() => { localStorage.setItem('vpmirror-lang', lang) }, [lang])

  useEffect(() => {
    const handleMouseMove = (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <LangContext.Provider value={lang}>
      <div className="interactive-glow" />
      <Nav lang={lang} setLang={setLang} />
      <Hero />
      <Features />
      <HowItWorks />
      <Contributors />
      <Citation />
      <Footer />
    </LangContext.Provider>
  )
}
