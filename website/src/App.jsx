import React from 'react';
import './index.css';

function App() {
  return (
    <div className="container">
      <header className="header">
        <div className="logo">VP Mirror</div>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#citation">Citation</a>
          <a href="https://github.com/weixijia/ViTPoseStudio">GitHub</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="badge">v1.0 is now live ✨</div>
          <h1>Real-Time Skeleton<br/>Pose Estimation</h1>
          <p>
            A distilled, lightweight version of our comprehensive multimodal data collection platform, Vomee. 
            Experience seamless RGB-based visual motion capture with a beautiful GUI.
          </p>
          <a href="https://github.com/weixijia/ViTPoseStudio" className="cta-button">
            View on GitHub
          </a>
          
          <img 
            src="/ViTPoseStudio/hero.png" 
            alt="VP Mirror Dashboard Interface" 
            className="hero-image"
            onError={(e) => {
              e.target.src = "hero.png"; // Fallback for local development
            }}
          />
        </section>

        <section id="features" className="features">
          <div className="feature-card">
            <div className="feature-icon">🧍</div>
            <h3>Wholebody Detection</h3>
            <p>Automatically detects full facial mesh, detailed finger joints, and full body skeletons using the vitpose-s-wholebody model.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Real-Time Inference</h3>
            <p>Powered by YOLOv8 human detection and SORT tracking, optimized for lightning-fast performance across devices.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💻</div>
            <h3>Cross-Platform</h3>
            <p>Fully compatible with Windows, macOS, and Linux out of the box. Zero painful configuration needed.</p>
          </div>
        </section>

        <section id="citation" className="citation">
          <div className="citation-inner">
            <h2>Backed by Academic Research</h2>
            <p>
              VP Mirror is distilled from our multimodal data collection platform, <strong>Vomee</strong>. 
              If you use our tool in your research, please cite our paper:
            </p>
            <div className="bibtex">
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
        </section>
      </main>

      <footer className="footer">
        <p>© 2025 Xijia Wei. Released under the MIT License.</p>
      </footer>
    </div>
  );
}

export default App;
