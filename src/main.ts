import * as THREE from 'three';

type PendulumParams = {
  length: number;
  gravity: number;
  damping: number;
  mass: number;
  theta0: number;
};

type PendulumState = {
  theta: number;
  omega: number;
};

type SamplePoint = {
  t: number;
  theta: number;
  omega: number;
  energy: number;
};

function mustGetElement<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element as T;
}

class PendulumEngine {
  private state: PendulumState;

  constructor(initialTheta = Math.PI / 4, initialOmega = 0) {
    this.state = { theta: initialTheta, omega: initialOmega };
  }

  public reset(theta: number, omega = 0) {
    this.state.theta = theta;
    this.state.omega = omega;
  }

  private getDerivs(theta: number, omega: number, params: PendulumParams) {
    return {
      dTheta: omega,
      dOmega: -(params.gravity / params.length) * Math.sin(theta) - params.damping * omega,
    };
  }

  public step(dt: number, params: PendulumParams) {
    const s = this.state;
    const k1 = this.getDerivs(s.theta, s.omega, params);
    const k2 = this.getDerivs(s.theta + (k1.dTheta * dt) / 2, s.omega + (k1.dOmega * dt) / 2, params);
    const k3 = this.getDerivs(s.theta + (k2.dTheta * dt) / 2, s.omega + (k2.dOmega * dt) / 2, params);
    const k4 = this.getDerivs(s.theta + k3.dTheta * dt, s.omega + k3.dOmega * dt, params);

    s.theta += (dt / 6) * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta);
    s.omega += (dt / 6) * (k1.dOmega + 2 * k2.dOmega + 2 * k3.dOmega + k4.dOmega);
    return { ...s };
  }

  public getState() {
    return { ...this.state };
  }
}

const app = mustGetElement<HTMLDivElement>('#app');

app.innerHTML = `
  <div class="shell">
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>
    <div class="bg-orb orb-3"></div>

    <header class="topbar glass">
      <div>
        <div class="eyebrow">WebGL / Three.js 虚拟仿真实验</div>
        <h1>非线性阻尼单摆实验平台</h1>
        <p>支持 RK4 数值积分、轨迹示踪、能量监测与相图分析。</p>
      </div>
      <div class="badge glass-badge">实验状态：在线</div>
    </header>

    <main class="workspace">
      <aside class="control-panel card glass single-panel" id="controlPanel">
        <div class="panel-section panel-shell-head">
          <div class="card-head control-panel-head">
            <div>
              <h2>实验参数</h2>
              <span>Controls</span>
            </div>
            <button class="secondary panel-toggle" id="panelToggleBtn" type="button" aria-expanded="true">
              <span class="panel-toggle-icon" aria-hidden="true">◂</span>
              <span class="panel-toggle-label">收起窗格</span>
            </button>
          </div>
          <div class="panel-collapse-hint">窗口变窄时可折叠左侧实验窗格</div>
          <div class="panel-scroll-tip" id="panelScrollTip">
            <span class="panel-scroll-tip-icon" aria-hidden="true">↓</span>
            <span>向下滚动查看更多</span>
          </div>
          <div class="grid">
            <label>
              <span>摆长 L (cm)</span>
              <input id="length" type="range" min="0.5" max="3.5" step="0.01" value="1.5" />
              <strong id="lengthValue"></strong>
            </label>
            <label>
              <span>重力 g</span>
              <input id="gravity" type="range" min="1" max="20" step="0.1" value="9.8" />
              <strong id="gravityValue"></strong>
            </label>
            <label>
              <span>阻尼 b</span>
              <input id="damping" type="range" min="0" max="2" step="0.01" value="0.06" />
              <strong id="dampingValue"></strong>
            </label>
            <label>
              <span>初始角度 θ₀</span>
              <input id="theta0" type="range" min="0" max="1.57" step="0.01" value="0.09" />
              <div class="slider-ticks" aria-hidden="true">
                <span>0°</span>
                <span>15°</span>
                <span>30°</span>
                <span>45°</span>
                <span>60°</span>
                <span>75°</span>
                <span>90°</span>
              </div>
              <strong id="theta0Value"></strong>
            </label>
          </div>
          <div class="actions">
            <button id="toggleBtn">暂停</button>
            <button class="secondary" id="resetBtn">重置实验</button>
          </div>
        </div>

        <div class="panel-section panel-divider">
          <div class="card-head">
            <h2>实时数据</h2>
            <span>Live</span>
          </div>
          <div class="stats-grid">
            <div><span>θ</span><strong id="thetaReadout"></strong></div>
            <div><span>ω</span><strong id="omegaReadout"></strong></div>
            <div><span>Ek</span><strong id="ekReadout"></strong></div>
            <div><span>Ep</span><strong id="epReadout"></strong></div>
            <div><span>E</span><strong id="eReadout"></strong></div>
            <div><span>记录数</span><strong id="recordCountReadout">0</strong></div>
          </div>
        </div>

        <section class="card glass lab-card compact-card">
          <div class="card-head lab-card-head">
            <div>
              <h2>单摆法测 g</h2>
              <span>Formal Lab Report</span>
            </div>
            <button class="secondary lab-toggle" id="labToggleBtn" type="button" aria-expanded="true">
              <span class="lab-toggle-icon" aria-hidden="true">▾</span>
              <span class="lab-toggle-label">收起</span>
            </button>
          </div>
          <div class="lab-body" id="labBody">
            <div class="lab-body-inner">
              <div class="report-section report-intro">
                <div>
                  <span>实验目标</span>
                  <strong>由单摆周期测定当地重力加速度</strong>
                </div>
                <div>
                  <span>核心公式</span>
                  <strong>g = 4π²l / T²</strong>
                  <div class="lab-formula-note">其中 l 以 m 计，T 以 s 计</div>
                </div>
              </div>
              <div class="report-section">
                <div class="section-title">一、实验步骤</div>
                <ol class="lab-steps">
                  <li>测量摆球直径 <b>d</b> 和摆线长度 <b>l绳</b>。</li>
                  <li>由 <b>l = l绳 + d/2</b> 计算摆长（统一按 cm 记录），并设定 <b>n = 50</b>。</li>
                  <li>将摆球拉离平衡位置，小角度、无初速度释放。</li>
                  <li>记录 <b>50</b> 次全振动总时间 <b>T总</b>。</li>
                  <li>计算单次周期 <b>T = T总 / n</b>，再代入公式求 <b>g</b>。</li>
                </ol>
              </div>
              <div class="report-section">
                <div class="section-title">二、实验数据</div>
                <div class="lab-grid lab-grid-compact">
                  <label>
                    <span>摆球直径 d (cm)</span>
                    <input id="ballDiameter" type="number" min="0.1" step="0.01" value="2.00" />
                  </label>
                  <label>
                    <span>摆线长度 l绳 (cm)</span>
                    <input id="stringLength" type="number" min="1" step="0.1" value="73.00" />
                  </label>
                  <label>
                    <span>测量周期数 n</span>
                    <input id="cycleCount" type="number" min="1" step="1" value="50" />
                  </label>
                  <label>
                    <span>50 次全振动总时间 T总 (s)</span>
                    <input id="totalTimeInput" type="number" min="0.1" step="0.01" placeholder="例如 87.20" />
                  </label>
                </div>
              </div>
              <div class="report-section">
                <div class="section-title">三、数据处理与结果</div>
                <div class="lab-metrics lab-metrics-report">
                  <div><span>摆长 l</span><strong id="pendulumLengthReadout">0.00 cm</strong></div>
                  <div><span>单次周期 T</span><strong id="periodInput">--</strong></div>
                  <div><span>计算值 g</span><strong id="gravityResultReadout">--</strong></div>
                  <div><span>相对误差</span><strong id="gErrorReadout">--</strong></div>
                  <div class="lab-metrics-note">由 cm 换算为 m 后计算</div>
                </div>
              </div>
              <div class="actions lab-actions">
                <button id="calculateGBtn">计算重力加速度</button>
                <button class="secondary" id="useStopwatchBtn">用秒表填入 T总</button>
              </div>
              <div class="lab-hint">默认按实验指导书：l = l绳 + d/2，n = 50，使用小角度摆动结果。</div>
            </div>
          </div>
        </section>

        <div class="panel-section panel-divider">
          <div class="card-head">
            <h2>AI 对话助手</h2>
            <span id="aiStatusReadout">准备就绪</span>
          </div>
          <div class="ai-help">你可以直接向 AI 询问实验原理、数据分析和报告总结。</div>
          <div class="ai-config-grid">
            <div class="ai-config-static">
              <span>模型</span>
              <strong>qwen-plus-2025-07-28</strong>
            </div>
            <div class="ai-config-static">
              <span>推理强度</span>
              <strong>medium</strong>
            </div>
          </div>
          <div class="ai-chat" id="aiChat"></div>
          <div class="ai-quick-actions">
            <button class="secondary" data-ai-prompt="帮我总结当前摆动实验的关键数据">总结数据</button>
            <button class="secondary" data-ai-prompt="如何通过单摆实验测重力加速度">实验原理</button>
            <button class="secondary" data-ai-prompt="如果阻尼变大，实验现象会怎样">参数分析</button>
          </div>
          <div class="ai-input-row">
            <textarea id="aiInput" rows="3" placeholder="输入问题，例如：为什么初始角度变大时周期会变化？"></textarea>
            <div class="ai-input-actions">
              <button id="aiSendBtn">发送</button>
              <button class="secondary" id="aiStopBtn" disabled>停止生成</button>
            </div>
          </div>
        </div>

        <div class="panel-section panel-divider">
          <div class="card-head">
            <h2>实验记录与分析</h2>
            <span>Logs</span>
          </div>
          <div class="record-actions">
            <button id="recordBtn">开始记录</button>
            <button class="secondary" id="clearRecordBtn">清空记录</button>
            <button class="secondary" id="exportCsvBtn">导出 CSV</button>
          </div>
          <div class="stopwatch-card">
            <div class="stopwatch-head">
              <span>秒表</span>
              <strong id="stopwatchState">等待开始</strong>
            </div>
            <div class="stopwatch-time" id="stopwatchTime">00:00.000</div>
            <div class="stopwatch-meta">
              <div><span>已完成摆动</span><strong id="swingCountReadout">0 / 10</strong></div>
              <div><span>目标</span><strong>10 次</strong></div>
            </div>
            <div class="record-actions stopwatch-actions">
              <button id="stopwatchBtn">开始秒表</button>
              <button class="secondary" id="stopwatchResetBtn">重置秒表</button>
            </div>
          </div>

          <div class="mini-tabs" id="analysisTabs">
            <button class="mini-tab active" data-panel="record">记录</button>
            <button class="mini-tab" data-panel="energy">能量</button>
            <button class="mini-tab" data-panel="phase">相图</button>
          </div>

          <div class="analysis-panel active" data-panel="record">
            <div class="record-list" id="recordList"></div>
          </div>
          <div class="analysis-panel" data-panel="energy">
            <canvas id="energyCanvas" width="420" height="240"></canvas>
          </div>
          <div class="analysis-panel" data-panel="phase">
            <canvas id="phaseCanvas" width="420" height="240"></canvas>
          </div>
        </div>
      </aside>

      <section class="scene-panel card glass">
        <div class="scene-header">
          <div>
            <h2>三维摆动场景</h2>
            <p>实时映射角位移到 rotation.z，并显示质点运动轨迹。</p>
          </div>
          <div class="legend">
            <span><i class="dot dot-a"></i> 摆球轨迹</span>
            <span><i class="dot dot-b"></i> 相图</span>
          </div>
        </div>
        <div class="scene-debug glass" id="sceneDebug">
          <div><span>Canvas</span><strong id="sceneDebugCanvas">--</strong></div>
          <div><span>Parent</span><strong id="sceneDebugParent">--</strong></div>
          <div><span>Renderer</span><strong id="sceneDebugRenderer">--</strong></div>
          <div><span>Camera</span><strong id="sceneDebugCamera">--</strong></div>
        </div>
        <div class="scene-frame glass">
          <div class="scene-frame-highlight"></div>
          <canvas id="sceneCanvas"></canvas>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-content">
          <a href="https://tw.urltime.live" class="footer-link">
            © <span id="year"></span> 臺北重定向集團有限公司
          </a>
          <span class="divider">|</span>
          <a href="https://beian.miit.gov.cn/" target="_blank" class="footer-link icp-link" rel="noreferrer">
            沪ICP备2026008612号-1
          </a>
          <span class="divider">|</span>
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=31011502405443" target="_blank" class="footer-link icp-link" rel="noreferrer">
            沪公网安备31011502405443号
          </a>
          <span class="divider">|</span>
          <p>Copyright ©2026 URL Time LTD.</p>
          <span class="divider">|</span>
          <p>由 阿里云 提供计算服务</p>
        </div>
      </div>
    </footer>
  </div>
`;

const style = document.createElement('style');
style.textContent = `
  :root {
    color-scheme: dark;
    --bg: #0c1324;
    --text: rgba(250, 252, 255, 0.96);
    --muted: rgba(226, 235, 255, 0.7);
    --line: rgba(255, 255, 255, 0.14);
    --glass: rgba(255, 255, 255, 0.1);
    --glass-strong: rgba(255, 255, 255, 0.16);
    --accent: #9abfff;
    --accent-2: #8cf1e0;
    --accent-3: #ff9bec;
    --shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
    --ease-soft: cubic-bezier(0.25, 0.8, 0.25, 1);
    --dur-fast: 180ms;
    --dur-med: 280ms;
    --dur-slow: 420ms;
  }
  * { box-sizing: border-box; }
  html, body, #app {
    margin: 0; width: 100%; min-height: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
    background:
      radial-gradient(circle at 18% 12%, rgba(154, 191, 255, 0.2), transparent 24%),
      radial-gradient(circle at 82% 18%, rgba(140, 241, 224, 0.14), transparent 20%),
      radial-gradient(circle at 50% 88%, rgba(255, 155, 236, 0.1), transparent 24%),
      linear-gradient(180deg, #0b1220 0%, #0d1728 46%, #08101b 100%);
    color: var(--text);
    overflow: auto;
  }
  .shell {
    position: relative;
    width: 100%;
    min-height: 100dvh;
    height: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    box-sizing: border-box;
    isolation: isolate;
    overflow: visible;
    --mx: 50%;
    --my: 20%;
    --pulse: 1;
    --pulse-soft: 0.5;
  }
  .bg-orb {
    position: absolute; inset: auto;
    width: 340px; height: 340px; border-radius: 50%; filter: blur(46px); opacity: 0.5; pointer-events: none;
  }
  .orb-1 { top: -90px; left: -100px; background: rgba(143, 184, 255, 0.2); }
  .orb-2 { top: 80px; right: -90px; background: rgba(132, 240, 221, 0.16); }
  .orb-3 { bottom: -110px; left: 20%; background: rgba(255, 147, 234, 0.1); }
  .glass {
    position: relative;
    background:
      radial-gradient(circle at var(--card-x, 50%) var(--card-y, 20%), rgba(255,255,255,0.14), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)),
      rgba(20, 29, 48, 0.5);
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), var(--shadow);
    backdrop-filter: blur(22px) saturate(170%);
    -webkit-backdrop-filter: blur(22px) saturate(170%);
    overflow: hidden;
    transition: transform var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), border-color var(--dur-fast) var(--ease-soft), filter var(--dur-fast) var(--ease-soft);
  }
  .glass::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.18), transparent 18%),
      linear-gradient(135deg, rgba(255,255,255,0.18), transparent 35%, rgba(255,255,255,0.05) 70%, transparent 100%);
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: 0.9;
    transition: opacity var(--dur-fast) var(--ease-soft), transform var(--dur-med) var(--ease-out), background var(--dur-fast) var(--ease-soft);
  }
  .glass::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 1px solid rgba(255,255,255,0.08);
    pointer-events: none;
    transition: border-color 180ms ease, opacity 180ms ease;
  }
  .glass:hover {
    transform: translateY(-1px) scale(calc(1 + var(--pulse-soft) * 0.006));
    border-color: rgba(255,255,255,0.18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 44px rgba(0, 0, 0, 0.22);
    filter: brightness(1.015);
  }
  .control-panel::-webkit-scrollbar {
    width: 10px;
  }
  .control-panel::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.04);
    border-radius: 999px;
    margin: 10px 0;
  }
  .control-panel::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(143,184,255,0.72), rgba(132,240,221,0.5));
    border-radius: 999px;
    border: 2px solid rgba(14, 20, 34, 0.72);
  }
  .control-panel::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(143,184,255,0.92), rgba(132,240,221,0.72));
  }
  .glass:hover::before {
    opacity: 1;
    transform: translateY(-2px);
  }
  .glass:hover::after {
    border-color: rgba(255,255,255,0.14);
  }
  .topbar {
    display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
    padding: 16px 20px; border-radius: 26px;
    position: relative;
    overflow: hidden;
    animation: floatGlow 8s var(--ease-soft) infinite, breathe 9s var(--ease-soft) infinite;
  }
  .topbar::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.16), transparent 34%);
    pointer-events: none;
  }
  .topbar::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22);
    pointer-events: none;
  }
  .eyebrow { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--accent-2); margin-bottom: 8px; }
  .topbar h1, .card h2 { margin: 0; letter-spacing: -0.03em; }
  .topbar h1 { font-size: 26px; line-height: 1.08; }
  .topbar p { margin: 7px 0 0; color: var(--muted); max-width: 720px; font-size: 13px; line-height: 1.55; }
  .glass-badge {
    padding: 10px 16px; border-radius: 999px; color: #fff; font-weight: 600; white-space: nowrap;
    background: linear-gradient(180deg, rgba(143,184,255,0.16), rgba(255,255,255,0.08));
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
    letter-spacing: 0.02em;
  }
  .workspace { flex: 1; display: grid; grid-template-columns: minmax(340px, 372px) minmax(0, 1fr); gap: 0; min-height: 0; height: auto; overflow: visible; align-items: stretch; }
  .workspace > * { min-width: 0; }
  .workspace.is-panel-collapsed { grid-template-columns: 76px minmax(0, 1fr); }
  .control-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    height: 100%;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding-right: 8px;
    padding-bottom: 12px;
    align-content: start;
    scrollbar-gutter: stable;
    position: relative;
  }
  .panel-scroll-tip {
    position: sticky;
    top: 8px;
    align-self: flex-end;
    margin-left: auto;
    margin-right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1;
    color: rgba(255,255,255,0.88);
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 6px 18px rgba(0,0,0,0.14);
    pointer-events: none;
    z-index: 3;
    will-change: opacity, transform, filter;
    transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out), filter var(--dur-slow) var(--ease-out);
  }
  .panel-scroll-tip::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: inherit;
    background: radial-gradient(circle, rgba(255,255,255,0.18), transparent 65%);
    opacity: 0.45;
    filter: blur(8px);
    pointer-events: none;
    z-index: -1;
    transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out);
  }
  .panel-scroll-tip.is-hidden {
    opacity: 0;
    transform: translateY(-10px) scale(0.96);
    filter: blur(4px);
  }
  .panel-scroll-tip.is-hidden::after {
    opacity: 0;
    transform: scale(0.92);
  }
  .panel-scroll-tip-icon {
    display: inline-block;
    animation: panelArrowBounce 1.15s var(--ease-soft) infinite;
    transform-origin: 50% 55%;
  }
  @keyframes panelArrowBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(3px); }
  }
  .control-panel.is-collapsed .panel-scroll-tip {
    opacity: 0;
    transform: translateY(-10px) scale(0.96);
    filter: blur(4px);
  }
  .control-panel::after {
    content: '';
    position: sticky;
    left: 0;
    right: 0;
    bottom: 0;
    height: 28px;
    margin-top: auto;
    pointer-events: none;
    background: linear-gradient(180deg, transparent, rgba(11, 18, 32, 0.65));
    opacity: 0.95;
    z-index: 2;
  }
  .card {
    border-radius: 24px;
    padding: 16px;
    position: relative;
    overflow: hidden;
    flex: 0 0 auto;
  }
  .control-panel > .card { min-width: 0; }
  .single-panel { display: flex; flex-direction: column; gap: 16px; }
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 2px 2px 0;
  }
  .panel-section + .panel-section { margin-top: 2px; }
  .panel-shell-head {
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .control-panel-head { align-items: center; }
  .panel-toggle {
    min-width: 96px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform var(--dur-med) var(--ease-out), opacity var(--dur-med) var(--ease-out), background var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out);
  }
  .panel-toggle-icon {
    display: inline-block;
    transition: transform var(--dur-med) var(--ease-out);
    transform-origin: 50% 55%;
    font-size: 12px;
    line-height: 1;
  }
  .panel-toggle.is-collapsed .panel-toggle-icon {
    transform: rotate(180deg);
  }
  .panel-toggle-label { transition: opacity 180ms ease; }
  .panel-collapse-hint {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
    margin-top: -2px;
  }
  .control-panel.is-collapsed {
    min-width: 76px;
    width: 76px;
    padding-right: 0;
    padding-left: 0;
    overflow: hidden;
  }
  .control-panel.is-collapsed::before,
  .control-panel.is-collapsed::after {
    opacity: 0;
  }
  .panel-scroll-tip.is-hidden {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  .control-panel.is-collapsed .panel-section:not(.panel-shell-head),
  .control-panel.is-collapsed .panel-collapse-hint,
  .control-panel.is-collapsed .control-panel-head > div > span,
  .control-panel.is-collapsed .control-panel-head > div > h2 {
    display: none;
  }
  .control-panel.is-collapsed .control-panel-head {
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
  }
  .control-panel.is-collapsed .panel-toggle {
    min-width: 60px;
    width: 60px;
    padding: 10px 0;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    letter-spacing: 0.08em;
  }
  .control-panel.is-collapsed .panel-toggle-icon {
    transform: rotate(90deg);
  }
  .control-panel.is-collapsed .panel-toggle-label { display: none; }
  .panel-divider {
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .compact-card { margin-bottom: 0; }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }
  .card-head span { font-size: 12px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.12), transparent 16%), linear-gradient(135deg, rgba(255,255,255,0.12), transparent 28%, transparent 72%, rgba(255,255,255,0.05));
    pointer-events: none;
    mix-blend-mode: screen;
    transition: opacity var(--dur-fast) var(--ease-soft);
  }
  .card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.03);
    pointer-events: none;
  }
  .grid { display: grid; gap: 14px; }
  label { display: grid; gap: 8px; }
  .slider-ticks {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    margin-top: -2px;
    font-size: 11px;
    color: rgba(226, 235, 255, 0.62);
    letter-spacing: 0.01em;
    user-select: none;
  }
  .slider-ticks span {
    text-align: center;
    white-space: nowrap;
  }
  label span { color: var(--muted); font-size: 13px; }
  label strong { font-size: 13px; color: #fff; }
  input[type='range'] {
    width: 100%;
    height: 24px;
    appearance: none;
    background: transparent;
    margin: 0;
    cursor: pointer;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 7px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07));
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.22);
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 22px;
    height: 22px;
    margin-top: -8px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 30%, rgba(255,255,255,0.98), rgba(255,255,255,0.44) 24%, rgba(225,233,255,0.96) 44%, rgba(128,154,233,0.96) 72%, rgba(70,90,166,0.98) 100%);
    border: 1px solid rgba(255,255,255,0.38);
    box-shadow:
      0 10px 18px rgba(0, 0, 0, 0.24),
      inset 0 1px 1px rgba(255,255,255,0.42),
      inset 0 -1px 1px rgba(0,0,0,0.12);
  }
  input[type='range']::-moz-range-track {
    height: 7px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07));
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.22);
  }
  input[type='range']::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 30%, rgba(255,255,255,0.98), rgba(255,255,255,0.44) 24%, rgba(225,233,255,0.96) 44%, rgba(128,154,233,0.96) 72%, rgba(70,90,166,0.98) 100%);
    border: 1px solid rgba(255,255,255,0.38);
    box-shadow:
      0 10px 18px rgba(0, 0, 0, 0.24),
      inset 0 1px 1px rgba(255,255,255,0.42),
      inset 0 -1px 1px rgba(0,0,0,0.12);
  }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
  button {
    position: relative;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 12px;
    padding: 10px 14px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      inset 0 -1px 0 rgba(0,0,0,0.16),
      0 8px 18px rgba(0, 0, 0, 0.16);
    transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease, background 160ms ease;
    overflow: hidden;
  }
  button:hover {
    transform: translateY(-1px) scale(1.01);
    filter: brightness(1.06);
  }
  button:active {
    transform: translateY(0) scale(0.99);
  }
  button::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.28), transparent 38%, transparent 62%, rgba(255,255,255,0.08));
    opacity: 0.85;
    pointer-events: none;
  }
  button:hover { transform: translateY(-1px); filter: brightness(1.05); background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08)); }
  button:active { transform: translateY(0); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 10px rgba(0,0,0,0.14); }
  button.secondary { background: rgba(255,255,255,0.08); }
  button.secondary::before { background: linear-gradient(135deg, rgba(255,255,255,0.14), transparent 40%); }
  .stats-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
  }
  .stats-grid-compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .report-section {
    margin-bottom: 10px;
    padding: 13px 13px;
    border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .lab-card-head { align-items: center; }
  .lab-card-head > div { display: flex; flex-direction: column; gap: 2px; }
  .lab-body {
    display: grid;
    grid-template-rows: 1fr;
    transition: grid-template-rows var(--dur-med) var(--ease-out), opacity var(--dur-med) var(--ease-out), transform var(--dur-med) var(--ease-out);
    overflow: hidden;
  }
  .lab-body-inner {
    min-height: 0;
    display: grid;
    gap: 10px;
    overflow: hidden;
  }
  .lab-body.is-collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
  }
  .lab-toggle {
    min-width: 92px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .lab-toggle-icon {
    display: inline-block;
    transition: transform 240ms ease;
    transform-origin: 50% 55%;
    font-size: 12px;
    line-height: 1;
  }
  .lab-toggle.is-collapsed .lab-toggle-icon {
    transform: rotate(-180deg);
  }
  .lab-toggle-label {
    transition: opacity 180ms ease;
  }
  .report-intro {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .report-intro span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
  .report-intro strong { font-size: 13px; }
  .section-title { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .lab-steps {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
    color: rgba(245,248,255,0.92);
    line-height: 1.45;
    font-size: 13px;
  }
  .lab-steps b { color: #fff; font-weight: 700; }
  .lab-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: start;
  }
  .lab-grid-compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .lab-grid label {
    display: grid;
    gap: 6px;
    align-content: start;
  }
  .lab-grid span {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.25;
  }
  .lab-grid input {
    width: 100%;
    min-width: 0;
    margin-top: 0;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: var(--text);
    padding: 9px 10px;
    outline: none;
  }
  .lab-grid input:focus {
    border-color: rgba(143,184,255,0.5);
    box-shadow: 0 0 0 4px rgba(143,184,255,0.12);
  }
  .lab-actions { grid-template-columns: 1fr 1fr; margin-top: 10px; }
  .lab-stepper {
    display: grid;
    gap: 6px;
  }
  .lab-stepper div {
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }
  .lab-stepper span { color: var(--muted); font-size: 12px; }
  .lab-stepper strong { font-size: 13px; }
  .lab-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .lab-metrics-report {
    margin-top: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lab-metrics-note {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: 12px;
    margin-top: -2px;
  }
  .lab-formula-note {
    color: var(--muted);
    font-size: 12px;
    margin-top: 4px;
  }
  .lab-metrics div {
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lab-metrics span { color: var(--muted); font-size: 12px; }
  .lab-metrics strong { font-size: 15px; }
  .lab-hint { margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .stats-grid div {
    padding: 12px; border-radius: 18px; background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.045)); border: 1px solid rgba(255,255,255,0.1);
    display: flex; flex-direction: column; gap: 5px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .stats-grid-compact div { padding: 11px; }
  .stats-grid span { color: var(--muted); font-size: 12px; }
  .stats-grid strong { font-size: 18px; }
  .ai-help {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.55;
    margin-bottom: 10px;
  }
  .ai-status {
    color: var(--accent-2);
  }
  .ai-help-inline { margin-top: -2px; }
  .ai-config-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  .ai-config-static {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    display: grid;
    gap: 4px;
  }
  .ai-config-static span {
    color: var(--muted);
    font-size: 12px;
  }
  .ai-config-static strong {
    color: var(--text);
    font-weight: 650;
    font-size: 14px;
  }
  .ai-env-note {
    grid-column: 1 / -1;
    margin-top: 2px;
  }
  .ai-chat {
    display: grid;
    gap: 8px;
    max-height: 220px;
    overflow: auto;
    padding-right: 4px;
    margin-bottom: 10px;
  }
  .ai-message {
    padding: 10px 12px;
    border-radius: 16px;
    line-height: 1.5;
    font-size: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.05);
  }
  .ai-message.user {
    background: rgba(154,191,255,0.12);
    margin-left: 18px;
  }
  .ai-message.assistant {
    background: rgba(132,240,221,0.1);
    margin-right: 18px;
  }
  .ai-message strong {
    display: block;
    margin-bottom: 4px;
    color: #fff;
    font-size: 12px;
  }
  .ai-quick-actions {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 10px;
  }
  .ai-input-row {
    display: grid;
    gap: 8px;
  }
  .ai-input-actions {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
  .ai-input-row textarea {
    width: 100%;
    resize: vertical;
    min-height: 84px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: var(--text);
    padding: 10px 12px;
    outline: none;
    font: inherit;
  }
  .ai-input-row textarea:focus {
    border-color: rgba(143,184,255,0.5);
    box-shadow: 0 0 0 4px rgba(143,184,255,0.12);
  }
  .record-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .record-actions button { min-height: 44px; }
  .stopwatch-card {
    padding: 12px;
    border-radius: 18px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 8px;
  }
  .stopwatch-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .stopwatch-head strong { color: rgba(245,248,255,0.95); font-size: 12px; }
  .stopwatch-time {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: 10px;
  }
  .stopwatch-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  .stopwatch-meta div {
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    display: grid;
    gap: 4px;
  }
  .stopwatch-meta span { color: var(--muted); font-size: 12px; }
  .stopwatch-meta strong { font-size: 16px; }
  .stopwatch-actions { margin-bottom: 0; }
  .record-list {
    max-height: 170px;
    overflow: auto;
    display: grid;
    gap: 8px;
    padding-right: 4px;
  }
  .record-item {
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(245,248,255,0.92);
    font-size: 12px;
    line-height: 1.45;
  }
  .record-item strong { display: block; font-size: 13px; margin-bottom: 4px; }
  .mini-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 10px 0 8px;
    padding: 6px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .mini-tab {
    padding: 10px 8px;
    border-radius: 999px;
    font-size: 12px;
    opacity: 0.82;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
  .mini-tab.active {
    background: linear-gradient(180deg, rgba(143,184,255,0.22), rgba(132,240,221,0.12));
    opacity: 1;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .analysis-panel {
    display: none;
  }
  .analysis-panel.active {
    display: block;
  }
  .chart-card canvas {
    width: 100%; display: block; border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02));
    transition: transform 180ms ease, filter 180ms ease;
  }
  .chart-card.compact-card canvas { max-height: 168px; }
  .chart-card:hover canvas {
    transform: scale(1.01);
    filter: brightness(1.04);
  }
  .scene-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    position: sticky;
    top: 14px;
    align-self: start;
    width: auto;
    height: calc(100dvh - 28px);
    overflow: hidden;
    padding: 14px;
  }
  .scene-panel > .scene-frame {
    min-height: 0;
    flex: 1;
  }
  .scene-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .scene-header p { color: var(--muted); margin: 6px 0 0; }
  .scene-debug {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
    padding: 10px 12px;
    border-radius: 18px;
    min-height: 0;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .scene-debug div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .scene-debug span { color: var(--muted); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
  .scene-debug strong {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .legend { display: flex; gap: 14px; color: var(--muted); font-size: 12px; flex-wrap: wrap; }
  .legend span { display: inline-flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; box-shadow: 0 0 12px currentColor; }
  .dot-a { background: var(--accent-2); color: var(--accent-2); }
  .dot-b { background: var(--accent-3); color: var(--accent-3); }
  .scene-frame {
    position: relative;
    flex: 1;
    min-height: 0;
    height: 100%;
    padding: 12px;
    border-radius: 26px;
    overflow: hidden;
    transform: translateZ(0);
    background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
    box-shadow:
      0 34px 96px rgba(0, 0, 0, 0.48),
      0 10px 28px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255,255,255,0.2),
      inset 0 -1px 0 rgba(255,255,255,0.04);
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  }
  .scene-frame:hover {
    transform: translateY(-1px);
    box-shadow:
      0 28px 64px rgba(0, 0, 0, 0.34),
      0 10px 20px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255,255,255,0.16),
      inset 0 -1px 0 rgba(255,255,255,0.04);
    filter: brightness(1.01);
  }
  .scene-frame:hover::after {
    opacity: 1;
    transform: translateY(-1px);
  }
  .scene-frame-highlight {
    position: absolute;
    inset: 5px 8px auto 8px;
    height: 48px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255,255,255,0.52), rgba(255,255,255,0.18), transparent);
    opacity: calc(0.26 + var(--pulse) * 0.18);
    filter: blur(4px);
    pointer-events: none;
    z-index: 2;
    animation: shimmer 7s linear infinite, breathe 9s ease-in-out infinite;
  }
  .scene-frame::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 1px solid rgba(255,255,255,0.26);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.28),
      inset 0 -1px 0 rgba(255,255,255,0.06);
    pointer-events: none;
    z-index: 2;
  }
  .scene-frame::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(circle at var(--scene-mx, 50%) var(--scene-my, 20%), rgba(255,255,255,0.22), transparent 20%),
      radial-gradient(circle at calc(var(--scene-mx, 50%) + 8%) calc(var(--scene-my, 20%) + 8%), rgba(143,184,255,0.14), transparent 18%),
      linear-gradient(145deg, rgba(255,255,255,0.3), transparent 18%, transparent 72%, rgba(255,255,255,0.18)),
      linear-gradient(180deg, rgba(255,255,255,0.12), transparent 22%, transparent 84%, rgba(0,0,0,0.2));
    pointer-events: none;
    mix-blend-mode: screen;
    z-index: 2;
    transition: opacity 180ms ease, transform 260ms ease;
  }
  .scene-frame::selection { background: transparent; }
  .site-footer {
    margin-top: 2px;
    padding: 8px 0 0;
    color: rgba(226, 235, 255, 0.68);
    font-size: 11px;
  }
  .footer-inner {
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .footer-content {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 8px;
    text-align: center;
    line-height: 1.45;
  }
  .footer-link {
    color: inherit;
    text-decoration: none;
    transition: color 160ms ease, opacity 160ms ease;
  }
  .footer-link:hover {
    color: #ffffff;
  }
  .divider {
    opacity: 0.32;
    margin: 0 1px;
  }
  .footer-content p {
    margin: 0;
  }
  @keyframes breathe {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-1px) scale(1.01); }
  }
  @keyframes floatGlow {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.035); }
  }
  @keyframes shimmer {
    0% { transform: translateX(-2%); }
    50% { transform: translateX(2%); }
    100% { transform: translateX(-2%); }
  }
  #sceneCanvas {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 22px;
    background:
      radial-gradient(circle at center, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 34%, rgba(5,8,16,0.98) 100%),
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,0.08),
      inset 0 10px 24px rgba(255,255,255,0.03);
    transition: transform 200ms ease, filter 200ms ease;
    min-height: 0;
  }
  @media (max-width: 1320px) {
    .workspace { grid-template-columns: minmax(300px, 340px) minmax(0, 1fr); gap: 0; }
    .stats-grid-compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .report-intro { grid-template-columns: 1fr; }
  }
  @media (max-width: 1080px) {
    .control-panel { width: 100%; }
    .control-panel.is-collapsed { width: 76px; }
    .workspace.is-panel-collapsed { grid-template-columns: 76px minmax(0, 1fr); }
    .panel-toggle { min-width: 60px; }
    .panel-toggle-label { display: none; }
    .scene-panel { width: calc(100vw - 24px); }
  }
  @media (max-width: 1200px) {
    body, html, #app { overflow: auto; }
    .shell { overflow: visible; height: auto; min-height: 100dvh; }
    .workspace { grid-template-columns: 1fr; overflow: visible; }
    .control-panel {
      order: 2;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: none;
      height: auto;
      padding-right: 6px;
      width: 100%;
    }
    .control-panel.is-collapsed { width: 76px; }
    .stats-grid-compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .report-intro { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .scene-panel { min-height: 0; position: sticky; top: 12px; width: 100%; height: 42vh; padding: 10px; }
  }
  @media (max-width: 860px) {
    .stats-grid-compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .lab-grid-compact { grid-template-columns: 1fr; }
    .lab-actions { grid-template-columns: 1fr; }
    .record-actions { grid-template-columns: 1fr; }
  }
  @media (max-width: 700px) {
    .shell { padding: 10px; gap: 10px; }
    .topbar { padding: 14px; }
    .workspace { gap: 10px; }
    .card { padding: 14px; }
    .record-actions { grid-template-columns: 1fr; }
    .lab-result { grid-template-columns: 1fr; }
    .scene-debug { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
`;
document.head.appendChild(style);

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const lengthInput = mustGetElement<HTMLInputElement>('#length');
const gravityInput = mustGetElement<HTMLInputElement>('#gravity');
const dampingInput = mustGetElement<HTMLInputElement>('#damping');
const theta0Input = mustGetElement<HTMLInputElement>('#theta0');
const toggleBtn = mustGetElement<HTMLButtonElement>('#toggleBtn');
const resetBtn = mustGetElement<HTMLButtonElement>('#resetBtn');
const sceneCanvas = mustGetElement<HTMLCanvasElement>('#sceneCanvas');
const phaseCanvas = mustGetElement<HTMLCanvasElement>('#phaseCanvas');
const energyCanvas = mustGetElement<HTMLCanvasElement>('#energyCanvas');
const sceneDebugCanvas = mustGetElement<HTMLSpanElement>('#sceneDebugCanvas');
const sceneDebugParent = mustGetElement<HTMLSpanElement>('#sceneDebugParent');
const sceneDebugRenderer = mustGetElement<HTMLSpanElement>('#sceneDebugRenderer');
const sceneDebugCamera = mustGetElement<HTMLSpanElement>('#sceneDebugCamera');
const aiStatusReadout = mustGetElement<HTMLSpanElement>('#aiStatusReadout');
const aiChat = mustGetElement<HTMLDivElement>('#aiChat');
const aiInput = mustGetElement<HTMLTextAreaElement>('#aiInput');
const aiSendBtn = mustGetElement<HTMLButtonElement>('#aiSendBtn');
const aiStopBtn = mustGetElement<HTMLButtonElement>('#aiStopBtn');
const recordBtn = mustGetElement<HTMLButtonElement>('#recordBtn');
const clearRecordBtn = mustGetElement<HTMLButtonElement>('#clearRecordBtn');
const exportCsvBtn = mustGetElement<HTMLButtonElement>('#exportCsvBtn');
const ballDiameterInput = mustGetElement<HTMLInputElement>('#ballDiameter');
const stringLengthInput = mustGetElement<HTMLInputElement>('#stringLength');
const cycleCountInput = mustGetElement<HTMLInputElement>('#cycleCount');
const totalTimeInput = mustGetElement<HTMLInputElement>('#totalTimeInput');
const periodInput = mustGetElement<HTMLSpanElement>('#periodInput');
const calculateGBtn = mustGetElement<HTMLButtonElement>('#calculateGBtn');
const useStopwatchBtn = mustGetElement<HTMLButtonElement>('#useStopwatchBtn');
const stopwatchBtn = mustGetElement<HTMLButtonElement>('#stopwatchBtn');
const stopwatchResetBtn = mustGetElement<HTMLButtonElement>('#stopwatchResetBtn');
const stopwatchTimeReadout = mustGetElement<HTMLDivElement>('#stopwatchTime');
const labToggleBtn = mustGetElement<HTMLButtonElement>('#labToggleBtn');
const labBody = mustGetElement<HTMLDivElement>('#labBody');
const panelToggleBtn = mustGetElement<HTMLButtonElement>('#panelToggleBtn');
const panelScrollTip = mustGetElement<HTMLDivElement>('#panelScrollTip');
const leftPanel = mustGetElement<HTMLElement>('.control-panel');
const workspace = mustGetElement<HTMLElement>('.workspace');
leftPanel.addEventListener('wheel', (event) => {
  const maxScrollTop = leftPanel.scrollHeight - leftPanel.clientHeight;
  if (maxScrollTop <= 0) return;
  event.preventDefault();
  leftPanel.scrollTop = Math.min(maxScrollTop, Math.max(0, leftPanel.scrollTop + event.deltaY));
}, { passive: false });
leftPanel.addEventListener('scroll', () => {
  const scrolled = leftPanel.scrollTop > 12;
  leftPanel.classList.toggle('is-scrolled', scrolled);
  panelScrollTip.classList.toggle('is-hidden', scrolled);
});
const stopwatchStateReadout = mustGetElement<HTMLSpanElement>('#stopwatchState');
const swingCountReadout = mustGetElement<HTMLSpanElement>('#swingCountReadout');
const recordCountReadout = mustGetElement<HTMLSpanElement>('#recordCountReadout');
const recordList = mustGetElement<HTMLDivElement>('#recordList');
const analysisTabs = mustGetElement<HTMLDivElement>('#analysisTabs');
const analysisPanels = Array.from(document.querySelectorAll<HTMLElement>('.analysis-panel'));
const valueLabels = {
  length: mustGetElement<HTMLSpanElement>('#lengthValue'),
  gravity: mustGetElement<HTMLSpanElement>('#gravityValue'),
  damping: mustGetElement<HTMLSpanElement>('#dampingValue'),
  theta0: mustGetElement<HTMLSpanElement>('#theta0Value'),
  theta: mustGetElement<HTMLSpanElement>('#thetaReadout'),
  omega: mustGetElement<HTMLSpanElement>('#omegaReadout'),
  ek: mustGetElement<HTMLSpanElement>('#ekReadout'),
  ep: mustGetElement<HTMLSpanElement>('#epReadout'),
  e: mustGetElement<HTMLSpanElement>('#eReadout'),
};
const pendulumLengthReadout = mustGetElement<HTMLSpanElement>('#pendulumLengthReadout');
const periodInputReadout = mustGetElement<HTMLSpanElement>('#periodInput');
const gravityResultReadout = mustGetElement<HTMLSpanElement>('#gravityResultReadout');
const gErrorReadout = mustGetElement<HTMLSpanElement>('#gErrorReadout');

const params: PendulumParams = { length: 1.5, gravity: 9.8, damping: 0.06, mass: 1, theta0: 5 * Math.PI / 180 };
const engine = new PendulumEngine(params.theta0, 0);
let running = true;
let last = performance.now();
let simTime = 0;
const stateTrail: Array<{ x: number; y: number }> = [];
const phaseTrail: Array<{ theta: number; omega: number }> = [];
const energySamples: SamplePoint[] = [];
const experimentRecords: Array<SamplePoint & { id: number; cycle: number }> = [];
type ConversationRole = 'user' | 'assistant';
type ConversationMessage = { role: ConversationRole; content: string };
const aiMessages: Array<{ role: 'user' | 'assistant'; title: string; content: string }> = [];
const conversationHistory: ConversationMessage[] = [];
let recording = false;
let recordId = 1;
let recordCycle = 0;
let lastPointerX = window.innerWidth * 0.5;
let lastPointerY = window.innerHeight * 0.2;
let stopwatchRunning = false;
let stopwatchStart = 0;
let stopwatchElapsed = 0;
let swingCount = 0;
let lastTheta = engine.getState().theta;
let lastOmega = engine.getState().omega;
let stopwatchFinished = false;
let measuredGravity = 0;

const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x07101f, 9, 24);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 2.7, 7.6);
camera.lookAt(0, -0.6, 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let isDraggingBob = false;
const lights = [
  new THREE.HemisphereLight(0xaecaff, 0x14203d, 1.8),
  new THREE.DirectionalLight(0xffffff, 2.6),
  new THREE.PointLight(0x8bb6ff, 1.8, 26),
  new THREE.SpotLight(0xffffff, 2.2, 30, Math.PI / 6, 0.45, 1),
  new THREE.AmbientLight(0xb9c8ff, 0.28),
];
const spotLight = lights[3] as THREE.SpotLight;
lights[1].position.set(5, 8, 6);
lights[2].position.set(-4, 3, 4);
spotLight.position.set(0, 7, 6);
spotLight.target.position.set(0, 0, 0);
lights.forEach((light) => scene.add(light));
scene.add(spotLight.target);
const pivot = new THREE.Group();
scene.add(pivot);
const support = new THREE.Mesh(
  new THREE.CylinderGeometry(0.055, 0.055, 4.8, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xdbe7ff, metalness: 0.7, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
);
support.position.set(0, 1.55, 0);
scene.add(support);
const supportCap = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 24, 24),
  new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.05, clearcoat: 1 }),
);
supportCap.position.set(0, 3.95, 0);
scene.add(supportCap);
const rodGeom = new THREE.CylinderGeometry(0.022, 0.03, 1, 24);
const rodMat = new THREE.MeshPhysicalMaterial({ color: 0xf7fbff, metalness: 0.72, roughness: 0.14, clearcoat: 0.8, clearcoatRoughness: 0.05 });
const rod = new THREE.Mesh(rodGeom, rodMat);
rod.position.y = -0.5;
pivot.add(rod);
const bob = new THREE.Mesh(
  new THREE.SphereGeometry(0.17, 96, 96),
  new THREE.MeshPhysicalMaterial({
    color: 0xaeb8c8,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 0.2,
    clearcoatRoughness: 0.08,
    reflectivity: 1,
    sheen: 0,
  }),
);
bob.position.y = -1;
pivot.add(bob);
const bobHighlight = new THREE.Mesh(
  new THREE.SphereGeometry(0.175, 96, 96),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24 }),
);
bobHighlight.position.y = -1;
pivot.add(bobHighlight);
const bobGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 48, 48),
  new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.18 }),
);
bobGlow.position.y = -1;
pivot.add(bobGlow);
const base = new THREE.Mesh(
  new THREE.CircleGeometry(4.6, 64),
  new THREE.MeshPhysicalMaterial({ color: 0x0f1730, roughness: 0.95, metalness: 0.05, clearcoat: 0.12 }),
);
base.rotation.x = -Math.PI / 2;
base.position.y = -2.6;
scene.add(base);
const trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x6fffe9, transparent: true, opacity: 0.9 }));
scene.add(trailLine);
const grid = new THREE.GridHelper(6, 12, 0x4066c4, 0x1a2854);
grid.position.y = -1.69;
scene.add(grid);
scene.environment = null;
scene.background = new THREE.Color(0x08101d);
let focusLift = 0;
let visualLength = params.length;
let visualTheta = engine.getState().theta;
function easeFocusLift(lengthValue: number) {
  const t = Math.min(Math.max((lengthValue - 0.9) / 1.8, 0), 1);
  const eased = t * t * (3 - 2 * t);
  return 0.02 + eased * 1.02;
}

const scenePointer = new THREE.Vector2();
function updateScenePointer(event: PointerEvent) {
  const rect = sceneCanvas.getBoundingClientRect();
  scenePointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  scenePointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
}

function getBobWorldPosition() {
  const pos = new THREE.Vector3();
  bob.getWorldPosition(pos);
  return pos;
}

function setPendulumFromPointer(event: PointerEvent) {
  const rect = sceneCanvas.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  const lengthMeters = params.length / 100;
  const worldX = nx * lengthMeters * 1.2;
  const worldY = -Math.sqrt(Math.max(lengthMeters ** 2 - worldX ** 2, 0));
  const theta = Math.atan2(worldX, -worldY || -0.0001);
  const current = engine.getState();
  engine.reset(theta, current.omega * 0.85);
  simTime = 0;
  if (recording) {
    pushExperimentRecord(theta, current.omega * 0.85);
    renderRecords();
  }
  if (Math.abs(ny) > 2) return;
}

function updateLabels() {
  valueLabels.length.textContent = `${(params.length * 100).toFixed(2)} cm`;
  valueLabels.gravity.textContent = params.gravity.toFixed(1);
  valueLabels.damping.textContent = params.damping.toFixed(2);
  valueLabels.theta0.textContent = `${(params.theta0 * 180 / Math.PI).toFixed(0)}°`;
  const pendulumLength = Number(stringLengthInput.value) / 100 + Number(ballDiameterInput.value) / 200;
  pendulumLengthReadout.textContent = `${(pendulumLength * 100).toFixed(2)} cm`;
}

function switchAnalysisPanel(panel: 'record' | 'energy' | 'phase') {
  analysisTabs.querySelectorAll<HTMLButtonElement>('.mini-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  analysisPanels.forEach((node) => {
    node.classList.toggle('active', node.dataset.panel === panel);
  });
}

let labCollapsed = false;
function setLabCollapsed(collapsed: boolean) {
  labCollapsed = collapsed;
  labBody.classList.toggle('is-collapsed', collapsed);
  labToggleBtn.classList.toggle('is-collapsed', collapsed);
  labToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  const label = labToggleBtn.querySelector<HTMLSpanElement>('.lab-toggle-label');
  if (label) label.textContent = collapsed ? '展开' : '收起';
}

let panelCollapsed = false;
function setPanelCollapsed(collapsed: boolean) {
  panelCollapsed = collapsed;
  leftPanel.classList.toggle('is-collapsed', collapsed);
  workspace.classList.toggle('is-panel-collapsed', collapsed);
  panelToggleBtn.classList.toggle('is-collapsed', collapsed);
  panelToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  const label = panelToggleBtn.querySelector<HTMLSpanElement>('.panel-toggle-label');
  if (label) label.textContent = collapsed ? '展开窗格' : '收起窗格';
}

function syncParams() {
  params.length = Number(lengthInput.value);
  params.gravity = Number(gravityInput.value);
  params.damping = Number(dampingInput.value);
  params.theta0 = Number(theta0Input.value);
  updateLabels();
}

function getLabLengthMeters() {
  return Number(stringLengthInput.value) / 100 + Number(ballDiameterInput.value) / 200;
}

function calculateGravityFromInputs(totalTimeSeconds: number) {
  const n = Math.max(1, Number(cycleCountInput.value));
  const T = totalTimeSeconds / n;
  const lCm = getLabLengthMeters();
  const l = lCm / 100;
  const g = (4 * Math.PI * Math.PI * l) / (T * T);
  return { g, l, T, n, lCm };
}

function updateGravityResult(totalTimeSeconds: number) {
  const { g, l, T, n, lCm } = calculateGravityFromInputs(totalTimeSeconds);
  measuredGravity = g;
  gravityResultReadout.textContent = `${g.toFixed(4)} m/s²`;
  gErrorReadout.textContent = params.gravity > 0 ? `${(((g - params.gravity) / params.gravity) * 100).toFixed(2)}%` : '--';
  pendulumLengthReadout.textContent = `${lCm.toFixed(2)} cm`;
  totalTimeInput.value = totalTimeSeconds.toFixed(2);
  periodInput.textContent = T.toFixed(4);
  periodInputReadout.textContent = `${T.toFixed(4)} s`;
  cycleCountInput.value = String(n);
  return { g, l, T, n, lCm };
}

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
}

function computeEnergy(theta: number, omega: number) {
  const ek = 0.5 * params.mass * (params.length * omega) ** 2;
  const ep = params.mass * params.gravity * params.length * (1 - Math.cos(theta));
  return { ek, ep, total: ek + ep };
}

function updateEnergyReadout(theta: number, omega: number) {
  const { ek, ep, total } = computeEnergy(theta, omega);
  valueLabels.theta.textContent = formatSigned(theta);
  valueLabels.omega.textContent = formatSigned(omega);
  valueLabels.ek.textContent = ek.toFixed(3);
  valueLabels.ep.textContent = ep.toFixed(3);
  valueLabels.e.textContent = total.toFixed(3);
}

function pushEnergySample(theta: number, omega: number) {
  const { total } = computeEnergy(theta, omega);
  const sample = { t: simTime, theta, omega, energy: total };
  energySamples.push(sample);
  if (energySamples.length > 240) energySamples.shift();
}

function pushExperimentRecord(theta: number, omega: number) {
  const { total } = computeEnergy(theta, omega);
  experimentRecords.push({ t: simTime, theta, omega, energy: total, id: recordId++, cycle: recordCycle + 1 });
  if (experimentRecords.length > 120) experimentRecords.shift();
}


function clearCanvas(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
}

function drawChartAxes(ctx: CanvasRenderingContext2D, padding: number, title: string) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = '#dce7ff';
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.fillText(title, padding, 18);
  ctx.strokeStyle = 'rgba(165, 184, 241, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();
}

function drawEnergyChart() {
  const ctx = energyCanvas.getContext('2d');
  if (!ctx) return;
  clearCanvas(ctx);
  const padding = 28;
  drawChartAxes(ctx, padding, '能量 / 时间');
  if (energySamples.length < 2) return;
  const width = energyCanvas.width - padding * 2;
  const height = energyCanvas.height - padding * 2;
  const maxEnergy = Math.max(...energySamples.map((p) => p.energy), 0.001);
  const minEnergy = Math.min(...energySamples.map((p) => p.energy), 0);
  ctx.beginPath();
  energySamples.forEach((p, i) => {
    const x = padding + (i / (energySamples.length - 1)) * width;
    const y = energyCanvas.height - padding - ((p.energy - minEnergy) / (maxEnergy - minEnergy || 1)) * height;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#6fffe9';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const latest = energySamples[energySamples.length - 1];
  ctx.fillStyle = '#ffcc66';
  ctx.beginPath();
  const lx = padding + width;
  const ly = energyCanvas.height - padding - ((latest.energy - minEnergy) / (maxEnergy - minEnergy || 1)) * height;
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPhaseChart() {
  const ctx = phaseCanvas.getContext('2d');
  if (!ctx) return;
  clearCanvas(ctx);
  const padding = 28;
  drawChartAxes(ctx, padding, '相图 / θ-ω');
  if (phaseTrail.length < 2) return;
  const width = phaseCanvas.width - padding * 2;
  const height = phaseCanvas.height - padding * 2;
  const thetaRange = 3.2;
  const omegaRange = 6.5;
  ctx.beginPath();
  phaseTrail.forEach((p, i) => {
    const x = padding + ((p.theta + thetaRange) / (thetaRange * 2)) * width;
    const y = phaseCanvas.height - padding - ((p.omega + omegaRange) / (omegaRange * 2)) * height;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#ff7ce8';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function updateScene() {
  const { theta, omega } = engine.getState();
  visualLength += (params.length - visualLength) * 0.065;
  visualTheta += (theta - visualTheta) * 0.16;
  const wobble = Math.sin(simTime * 6.5) * Math.min(Math.abs(omega) * 0.03, 0.12);
  pivot.rotation.z = visualTheta + wobble;
  const lenScale = visualLength;
  const rodLift = easeFocusLift(lenScale);
  focusLift += (rodLift - focusLift) * 0.045;
  pivot.position.y = focusLift;
  rod.scale.y = lenScale;
  rod.position.y = -0.5 * lenScale;
  bob.position.y = -lenScale;
  bobHighlight.position.y = -lenScale;
  bobGlow.position.y = -lenScale;

  const sway = Math.min(Math.abs(omega) * 0.06, 0.16);
  const pulse = 1 + Math.min(Math.abs(theta) * 0.015, 0.05);
  bob.scale.setScalar(pulse);
  bobHighlight.scale.setScalar(pulse * 1.01);
  bobGlow.scale.setScalar(1.12 + sway);

  const x = lenScale * Math.sin(visualTheta);
  const y = -lenScale * Math.cos(visualTheta) + focusLift;
  stateTrail.push({ x, y });
  if (stateTrail.length > 240) stateTrail.shift();
  const positions = new Float32Array(stateTrail.flatMap((p) => [p.x, p.y, 0]));
  trailLine.geometry.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trailLine.geometry = geometry;
}

function getSceneSize() {
  const rect = sceneCanvas.parentElement?.getBoundingClientRect() ?? sceneCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  return { width, height, rect };
}

function updateSceneDebug() {
  const canvasRect = sceneCanvas.getBoundingClientRect();
  const parentRect = sceneCanvas.parentElement?.getBoundingClientRect();
  sceneDebugCanvas.textContent = `${sceneCanvas.width}×${sceneCanvas.height} / css ${Math.round(canvasRect.width)}×${Math.round(canvasRect.height)}`;
  sceneDebugParent.textContent = parentRect
    ? `${Math.round(parentRect.width)}×${Math.round(parentRect.height)}`
    : 'n/a';
  sceneDebugRenderer.textContent = renderer.domElement ? 'ready' : 'missing';
  sceneDebugCamera.textContent = `fov ${camera.fov} | asp ${camera.aspect.toFixed(2)} | z ${camera.position.z.toFixed(2)}`;
}

function resizeRendererIfNeeded() {
  const { width, height } = getSceneSize();
  const needsResize = sceneCanvas.width !== width || sceneCanvas.height !== height;
  if (!needsResize) return false;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  return true;
}

function render() {
  resizeRendererIfNeeded();
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  updateSceneDebug();
}

function updateLightTheme(clientX: number, clientY: number) {
  const root = document.documentElement;
  const x = (clientX / window.innerWidth) * 100;
  const y = (clientY / window.innerHeight) * 100;
  root.style.setProperty('--mx', `${x.toFixed(2)}%`);
  root.style.setProperty('--my', `${y.toFixed(2)}%`);
  const pulse = 0.55 + ((clientX + clientY) / (window.innerWidth + window.innerHeight)) * 0.32;
  root.style.setProperty('--pulse', pulse.toFixed(3));
  root.style.setProperty('--pulse-soft', (pulse * 0.58).toFixed(3));
}

function updateCardGlow(event: PointerEvent) {
  const target = event.target as HTMLElement | null;
  const card = target?.closest?.('.glass') as HTMLElement | null;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  card.style.setProperty('--card-x', `${x.toFixed(2)}%`);
  card.style.setProperty('--card-y', `${y.toFixed(2)}%`);
}

function updateSceneGlow(event: PointerEvent) {
  const rect = sceneCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  sceneCanvas.style.setProperty('--scene-mx', `${x.toFixed(2)}%`);
  sceneCanvas.style.setProperty('--scene-my', `${y.toFixed(2)}%`);
  pointer.set(x / 50 - 1, -(y / 50 - 1));
}

function formatStopwatch(ms: number) {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = Math.floor(total % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function updateStopwatchDisplay() {
  stopwatchTimeReadout.textContent = formatStopwatch(stopwatchElapsed);
  swingCountReadout.textContent = `${Math.min(swingCount, 10)} / 10`;
  if (stopwatchFinished) {
    stopwatchStateReadout.textContent = '已完成 10 次摆动';
  } else if (stopwatchRunning) {
    stopwatchStateReadout.textContent = '计时中';
  } else if (stopwatchElapsed > 0) {
    stopwatchStateReadout.textContent = '已暂停';
  } else {
    stopwatchStateReadout.textContent = '等待开始';
  }
}

function resetStopwatch() {
  stopwatchRunning = false;
  stopwatchStart = 0;
  stopwatchElapsed = 0;
  swingCount = 0;
  stopwatchFinished = false;
  lastTheta = engine.getState().theta;
  lastOmega = engine.getState().omega;
  stopwatchBtn.textContent = '开始秒表';
  updateStopwatchDisplay();
}

function markSwingCrossing(theta: number, omega: number, prevTheta: number, prevOmega: number) {
  const crossedUp = prevTheta < 0 && theta >= 0 && omega > 0;
  const crossedDown = prevTheta > 0 && theta <= 0 && omega < 0;
  const validCross = crossedUp || crossedDown;
  const meaningfulSpeed = Math.abs(omega) > 0.02 || Math.abs(prevOmega) > 0.02;
  return validCross && meaningfulSpeed;
}

function handleStopwatch(theta: number, omega: number) {
  if (!stopwatchRunning || stopwatchFinished) {
    lastTheta = theta;
    lastOmega = omega;
    return;
  }
  if (markSwingCrossing(theta, omega, lastTheta, lastOmega)) {
    swingCount += 1;
    recordCycle = swingCount;
    if (recording) {
      pushExperimentRecord(theta, omega);
      renderRecords();
    }
    if (swingCount >= 10) {
      stopwatchFinished = true;
      stopwatchRunning = false;
      stopwatchElapsed = performance.now() - stopwatchStart;
      stopwatchBtn.textContent = '重新开始';
    }
  }
  lastTheta = theta;
  lastOmega = omega;
}

function renderRecords() {
  recordCountReadout.textContent = String(experimentRecords.length);
  recordList.innerHTML = experimentRecords.length
    ? experimentRecords
        .slice()
        .reverse()
        .map((item) => {
          const time = item.t.toFixed(2);
          return `<div class="record-item"><strong>第 ${item.cycle} 周期 · #${item.id} · t=${time}s</strong>θ=${item.theta.toFixed(3)} rad · ω=${item.omega.toFixed(3)} rad/s · E=${item.energy.toFixed(3)} J</div>`;
        })
        .join('')
    : '<div class="record-item">尚无记录。开始记录后，系统将按每次摆动周期自动保存实验数据。</div>';
}

function getAiConfig() {
  const dashscopeApiKey = (import.meta as ImportMeta & { env?: { VITE_DASHSCOPE_API_KEY?: string } }).env?.VITE_DASHSCOPE_API_KEY || '';
  return {
    apiKey: dashscopeApiKey,
    model: 'qwen-plus-2025-07-28',
    reasoningEffort: 'medium',
  };
}

function saveAiConfig() {
  localStorage.removeItem('scnet-ai-model');
  localStorage.removeItem('scnet-ai-reasoning-effort');
}

function persistConversation(responseId: string | undefined) {
  if (responseId) localStorage.setItem('scnet-ai-previous-response-id', responseId);
  localStorage.setItem('scnet-ai-history', JSON.stringify(conversationHistory));
}

function restoreConversation() {
  try {
    const raw = localStorage.getItem('scnet-ai-history');
    if (!raw) return;
    const parsed = JSON.parse(raw) as ConversationMessage[];
    if (!Array.isArray(parsed)) return;
    conversationHistory.splice(0, conversationHistory.length, ...parsed.slice(-12));
  } catch {
    conversationHistory.length = 0;
  }
}

function renderAiMessages() {
  aiChat.innerHTML = aiMessages
    .map((msg, index) => `<div class="ai-message ${msg.role}" data-ai-index="${index}"><strong>${msg.title}</strong><span>${msg.content}</span></div>`)
    .join('');
  aiChat.scrollTop = aiChat.scrollHeight;
}

function setAiStatus(text: string) {
  aiStatusReadout.textContent = text;
  aiStatusReadout.classList.toggle('ai-status', text.includes('生成') || text.includes('发送') || text.includes('请求'));
}

function setAiConfigStatus() {
  const key = getAiConfig().apiKey;
  setAiStatus(key ? '已配置' : '未配置');
}

function appendAiMessage(role: 'user' | 'assistant', title: string, content: string) {
  aiMessages.push({ role, title, content });
  if (aiMessages.length > 12) aiMessages.shift();
  renderAiMessages();
}

function updateAiMessage(index: number, content: string) {
  const message = aiMessages[index];
  if (!message) return;
  message.content = content;
  renderAiMessages();
}

function summarizeExperiment() {
  const latest = experimentRecords[experimentRecords.length - 1];
  const theta = latest?.theta ?? engine.getState().theta;
  const omega = latest?.omega ?? engine.getState().omega;
  const { ek, ep, total } = computeEnergy(theta, omega);
  return `当前摆长 ${(params.length).toFixed(2)} cm，阻尼 ${params.damping.toFixed(2)}，初始角度 ${(params.theta0 * 180 / Math.PI).toFixed(0)}°。最近数据 θ=${theta.toFixed(3)} rad，ω=${omega.toFixed(3)} rad/s，机械能约 ${total.toFixed(3)} J。Ek=${ek.toFixed(3)} J，Ep=${ep.toFixed(3)} J。`;
}

function buildAiMessages(question: string) {
  const system = {
    role: 'system',
    content: '你是一个单摆实验助手。回答要简洁、准确、中文表达，优先结合实验数据。',
  };
  const history = conversationHistory.map((msg) => ({ role: msg.role, content: msg.content }));
  const context = {
    role: 'user',
    content: `实验背景：${summarizeExperiment()}\n当前问题：${question}`,
  };
  return [system, ...history, context];
}

type ChatCompletionChunk = {
  id?: string;
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
};

let aiAbortController: AbortController | null = null;
let aiStreaming = false;
let aiActiveAssistantIndex = -1;
let aiActiveUserText = '';
let aiActiveAssistantText = '';

async function callScnetChatStream(question: string, onDelta: (chunk: string) => void) {
  const { apiKey, model } = getAiConfig();
  if (!apiKey) {
    throw new Error('密钥不可用，请检查是否已正确配置 AI 服务密钥。');
  }
  aiAbortController = new AbortController();
  aiStreaming = true;
  aiStopBtn.disabled = false;
  aiStopBtn.textContent = '停止生成';
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    signal: aiAbortController.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildAiMessages(question),
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.6,
      top_p: 0.8,
    }),
  });
  if (!response.ok || !response.body) {
    if (response.status === 401) throw new Error('密钥不可用，请检查是否已正确配置 AI 服务密钥。');
    if (response.status === 403) throw new Error('当前账号没有权限使用该模型，请确认模型权限或额度。');
    if (response.status === 429) throw new Error('请求太频繁了，请稍后再试。');
    if (response.status >= 500) throw new Error('AI 服务暂时不可用，请稍后再试。');
    throw new Error('请求失败，请稍后再试。');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let responseId = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const dataText = line.slice(5).trim();
      if (!dataText || dataText === '[DONE]') continue;
      let parsed: ChatCompletionChunk | null = null;
      try {
        parsed = JSON.parse(dataText) as ChatCompletionChunk;
      } catch {
        continue;
      }
      if (typeof parsed?.id === 'string') responseId = parsed.id;
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        fullText += delta;
        onDelta(fullText);
      }
    }
  }
  if (responseId) localStorage.setItem('scnet-ai-previous-response-id', responseId);
  aiStreaming = false;
  aiAbortController = null;
  aiStopBtn.disabled = true;
  aiStopBtn.textContent = '停止生成';
  return fullText.trim();
}

function generateAiReply(question: string) {
  const lower = question.toLowerCase();
  if (lower.includes('总结') || lower.includes('数据')) {
    return summarizeExperiment();
  }
  if (lower.includes('原理') || lower.includes('公式')) {
    return '小角度单摆的周期近似满足 T = 2π√(l/g)。实验中通过测量总周期时间 T总，再用 g = 4π²l / T² 计算重力加速度。';
  }
  if (lower.includes('阻尼')) {
    return '阻尼会让振幅随时间衰减，能量逐步损失。阻尼越大，摆动衰减越快，轨迹在相图中也会更快收缩。';
  }
  return '我可以帮你分析当前实验参数、解释公式，或者整理成实验报告。';
}

function seedAiConversation() {
  if (aiMessages.length > 0) return;
  appendAiMessage('assistant', 'AI 助手', '你好，我可以帮你分析当前实验。');
}

function exportRecordsToCsv() {
  if (experimentRecords.length === 0) {
    exportCsvBtn.textContent = '暂无可导出数据';
    window.setTimeout(() => {
      exportCsvBtn.textContent = '导出 CSV';
    }, 1500);
    return;
  }
  const { g, l, T, n } = calculateGravityFromInputs(Number(totalTimeInput.value) || 0);
  const labHeader = ['d_cm', 'l_shaft_cm', 'l_m', 'n', 'T_total_s', 'T_s', 'g_calc_ms2'];
  const labRow = [
    Number(ballDiameterInput.value).toFixed(2),
    Number(stringLengthInput.value).toFixed(2),
    l.toFixed(4),
    String(n),
    (Number(totalTimeInput.value) || 0).toFixed(2),
    T.toFixed(4),
    g.toFixed(6),
  ];
  const header = ['id', 'time_s', 'theta_rad', 'omega_rad_s', 'energy_j'];
  const rows = experimentRecords.map((item) => [
    item.id,
    item.t.toFixed(4),
    item.theta.toFixed(6),
    item.omega.toFixed(6),
    item.energy.toFixed(6),
  ]);
  const csv = [
    labHeader,
    labRow,
    [],
    header,
    ...rows,
  ]
    .map((row) => (row.length === 0 ? '' : row.map((value) => `"${String(value).split('"').join('""')}"`).join(',')))
    .join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pendulum-records-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function resetExperiment() {
  engine.reset(params.theta0, 0);
  simTime = 0;
  stateTrail.length = 0;
  phaseTrail.length = 0;
  energySamples.length = 0;
  experimentRecords.length = 0;
  recording = false;
  recordCycle = 0;
  recordBtn.textContent = '开始记录';
  recordBtn.style.background = '';
  resetStopwatch();
  renderRecords();
}

function fillStopwatchToLabInput() {
  if (stopwatchElapsed <= 0) return;
  totalTimeInput.value = (stopwatchElapsed / 1000).toFixed(2);
  updateGravityResult(stopwatchElapsed / 1000);
}

function syncLabPreview() {
  const totalTime = Number(totalTimeInput.value);
  const l = getLabLengthMeters();
  pendulumLengthReadout.textContent = `${(l * 100).toFixed(2)} cm`;
  const n = Math.max(1, Number(cycleCountInput.value));
  if (Number.isFinite(totalTime) && totalTime > 0) {
    const T = totalTime / n;
    periodInput.textContent = T.toFixed(4);
    periodInputReadout.textContent = `${T.toFixed(4)} s`;
    const g = (4 * Math.PI * Math.PI * l) / (T * T);
    gravityResultReadout.textContent = `${g.toFixed(4)} m/s²`;
    gErrorReadout.textContent = params.gravity > 0 ? `${(((g - params.gravity) / params.gravity) * 100).toFixed(2)}%` : '--';
    measuredGravity = g;
  } else {
    periodInput.textContent = '--';
    periodInputReadout.textContent = '--';
    gravityResultReadout.textContent = '--';
    gErrorReadout.textContent = '--';
  }
}

function loop(now: number) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  syncParams();
  if (running && !isDraggingBob) {
    engine.step(dt, params);
    simTime += dt;
  }
  const { theta, omega } = engine.getState();
  phaseTrail.push({ theta, omega });
  if (phaseTrail.length > 260) phaseTrail.shift();
  pushEnergySample(theta, omega);
  updateEnergyReadout(theta, omega);
  handleStopwatch(theta, omega);
  if (stopwatchRunning) {
    stopwatchElapsed = now - stopwatchStart;
  }
  if (recording) {
    recordCycle = swingCount;
  }
  updateStopwatchDisplay();
  updateScene();
  drawEnergyChart();
  drawPhaseChart();
  renderRecords();
  render();
  requestAnimationFrame(loop);
}

lengthInput.addEventListener('input', syncParams);
gravityInput.addEventListener('input', syncParams);
dampingInput.addEventListener('input', syncParams);
theta0Input.addEventListener('input', syncParams);
ballDiameterInput.addEventListener('input', syncLabPreview);
stringLengthInput.addEventListener('input', syncLabPreview);
cycleCountInput.addEventListener('input', syncLabPreview);
totalTimeInput.addEventListener('input', syncLabPreview);
document.addEventListener('pointermove', (event) => {
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  updateLightTheme(event.clientX, event.clientY);
  updateCardGlow(event);
});
sceneCanvas.addEventListener('pointermove', (event) => {
  updateSceneGlow(event);
});
sceneCanvas.addEventListener('pointerdown', (event) => {
  updateScenePointer(event);
  const rect = sceneCanvas.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  pointer.set(ndcX, ndcY);
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(bob, true);
  if (intersects.length > 0) {
    isDraggingBob = true;
    sceneCanvas.setPointerCapture(event.pointerId);
  }
});
sceneCanvas.addEventListener('pointermove', (event) => {
  updateScenePointer(event);
  if (!isDraggingBob) return;
  const rect = sceneCanvas.getBoundingClientRect();
  const localX = (event.clientX - rect.left) / rect.width;
  const clampedX = Math.min(0.98, Math.max(0.02, localX));
  const theta = (clampedX - 0.5) * Math.PI * 1.8;
  const current = engine.getState();
  engine.reset(theta, current.omega * 0.92);
  simTime = 0;
  updateSceneGlow(event);
});
sceneCanvas.addEventListener('pointerup', (event) => {
  if (isDraggingBob) {
    isDraggingBob = false;
    sceneCanvas.releasePointerCapture(event.pointerId);
  }
});
sceneCanvas.addEventListener('pointercancel', () => {
  isDraggingBob = false;
});
toggleBtn.addEventListener('click', () => {
  running = !running;
  toggleBtn.textContent = running ? '暂停' : '继续';
});
recordBtn.addEventListener('click', () => {
  if (!recording) {
    recording = true;
    recordCycle = swingCount;
    pushExperimentRecord(engine.getState().theta, engine.getState().omega);
    renderRecords();
    recordBtn.textContent = '停止记录';
    recordBtn.style.background = 'linear-gradient(180deg, rgba(132,240,221,0.95), rgba(80,170,155,0.9))';
    return;
  }
  recording = false;
  recordBtn.textContent = '开始记录';
  recordBtn.style.background = '';
});
clearRecordBtn.addEventListener('click', () => {
  experimentRecords.length = 0;
  renderRecords();
});
exportCsvBtn.addEventListener('click', exportRecordsToCsv);
restoreConversation();
renderAiMessages();

async function sendAiQuestion() {
  const text = aiInput.value.trim();
  if (!text || aiStreaming) return;
  if (!getAiConfig().apiKey) {
    appendAiMessage('assistant', '系统', '未检测到 VITE_DASHSCOPE_API_KEY，请先在环境变量中配置 API Key。');
    setAiStatus('缺少 API Key');
    return;
  }
  saveAiConfig();
  appendAiMessage('user', '你', text);
  const assistantIndex = aiMessages.length;
  aiActiveAssistantIndex = assistantIndex;
  aiActiveUserText = text;
  aiActiveAssistantText = '';
  appendAiMessage('assistant', '模型', '');
  conversationHistory.push({ role: 'user', content: text });
  if (conversationHistory.length > 12) conversationHistory.splice(0, conversationHistory.length - 12);
  aiInput.value = '';
  aiSendBtn.disabled = true;
  aiSendBtn.textContent = '生成中...';
  aiStopBtn.disabled = false;
  setAiStatus('正在生成');
  let responseId = '';
  try {
    responseId = await callScnetChatStream(text, (partial) => {
      aiActiveAssistantText = partial;
      updateAiMessage(assistantIndex, partial);
    });
    const latestAssistant = aiMessages[assistantIndex]?.content ?? aiActiveAssistantText;
    conversationHistory.push({ role: 'assistant', content: latestAssistant });
    if (conversationHistory.length > 12) conversationHistory.splice(0, conversationHistory.length - 12);
    persistConversation(responseId || undefined);
    setAiStatus('已完成');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (aiActiveAssistantText) {
        updateAiMessage(assistantIndex, aiActiveAssistantText);
      } else {
        aiMessages.splice(assistantIndex, 1);
        renderAiMessages();
      }
      setAiStatus('已停止');
    } else {
      const message = error instanceof Error ? error.message : '请求失败，请稍后再试。';
      aiMessages.splice(assistantIndex, 1);
      renderAiMessages();
      appendAiMessage('assistant', '系统', message);
      conversationHistory.pop();
      setAiStatus('请求失败');
    }
  } finally {
    aiStreaming = false;
    aiAbortController = null;
    aiActiveAssistantIndex = -1;
    aiActiveUserText = '';
    aiActiveAssistantText = '';
    aiStopBtn.disabled = true;
    aiSendBtn.disabled = false;
    aiSendBtn.textContent = '发送';
    aiInput.focus();
  }
}

aiSendBtn.addEventListener('click', () => {
  void sendAiQuestion();
});
aiInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    aiSendBtn.click();
  }
});
panelToggleBtn.addEventListener('click', () => {
  setPanelCollapsed(!panelCollapsed);
});
labToggleBtn.addEventListener('click', () => {
  setLabCollapsed(!labCollapsed);
});
calculateGBtn.addEventListener('click', () => {
  const totalTime = Number(totalTimeInput.value);
  if (Number.isFinite(totalTime) && totalTime > 0) {
    updateGravityResult(totalTime);
  }
});
analysisTabs.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('.mini-tab');
  if (!button?.dataset.panel) return;
  switchAnalysisPanel(button.dataset.panel as 'record' | 'energy' | 'phase');
});
document.querySelectorAll<HTMLButtonElement>('[data-ai-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    aiInput.value = button.dataset.aiPrompt ?? '';
    void sendAiQuestion();
  });
});
aiStopBtn.addEventListener('click', () => {
  if (aiAbortController) aiAbortController.abort();
});
setAiConfigStatus();
useStopwatchBtn.addEventListener('click', fillStopwatchToLabInput);
stopwatchBtn.addEventListener('click', () => {
  if (stopwatchFinished) {
    resetStopwatch();
    stopwatchRunning = true;
    stopwatchStart = performance.now();
    stopwatchBtn.textContent = '暂停秒表';
    return;
  }
  if (!stopwatchRunning && stopwatchElapsed === 0) {
    stopwatchRunning = true;
    stopwatchStart = performance.now();
    stopwatchBtn.textContent = '暂停秒表';
    return;
  }
  stopwatchRunning = !stopwatchRunning;
  if (stopwatchRunning) {
    stopwatchStart = performance.now() - stopwatchElapsed;
    stopwatchBtn.textContent = '暂停秒表';
  } else {
    stopwatchElapsed = performance.now() - stopwatchStart;
    stopwatchBtn.textContent = '继续秒表';
  }
});
stopwatchResetBtn.addEventListener('click', resetStopwatch);
resetBtn.addEventListener('click', resetExperiment);

updateLightTheme(window.innerWidth * 0.5, window.innerHeight * 0.2);
updateLabels();
syncLabPreview();
updateEnergyReadout(engine.getState().theta, engine.getState().omega);
updateStopwatchDisplay();
renderRecords();
seedAiConversation();
setAiConfigStatus();
switchAnalysisPanel('record');
requestAnimationFrame(loop);
