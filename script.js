// ==================== 捕捉爱意 (Catch the Love) 游戏 ====================

// 游戏配置 - 大规模优化（The Great Upscale）
const CANVAS_WIDTH = 800;  // 增加宽度以适应现代手机
const CANVAS_HEIGHT = 700; // 增加高度增加反应时间
const BASKET_WIDTH = 150;  // 加宽篮子，极大降低操作难度
const BASKET_HEIGHT = 80;
const ITEM_SIZE = 50;     // 增大物体，视觉更清晰，接取更容易

// 游戏状态
let canvas, ctx;
let basketX;
let items = [];
let score = 0;
let lives = 3;
let level = 1;
let completedLevels = 0;
let isPlaying = false;
let isPaused = false;
let animationId = null;
let spawnTimer = 0;
let targetScore = 100;

// 掉落物品配置
const ITEM_TYPES = [
    { emoji: '💖', points: 10, speedMult: 1, chance: 0.6 },
    { emoji: '🌹', points: 30, speedMult: 1.2, chance: 0.3 },
    { emoji: '💎', points: 50, speedMult: 1.5, chance: 0.1 }
];

// 倒计时逻辑 (保持不变)
const getTargetTime = () => {
    // 正式时间设定： 2026年2月27日 下午 12点 (马来西亚时间)
    return new Date('2026-02-27T12:00:00+08:00');
};

let targetTime = getTargetTime();
let countdownInterval = null;
let timeReached = false;

// 音效系统 (精简版)
let audioContext = null;
let soundEnabled = true;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'catch') {
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } else if (type === 'miss') {
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        }
    } catch (e) { }
}

// 初始化

// ...保持其他逻辑...
function initUI() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    basketX = (CANVAS_WIDTH - BASKET_WIDTH) / 2;
    updateUI();
    draw(); // 确保加载时篮子可见

    // 初始化时隐藏教程弹窗（交给开场序列去触发）
    document.getElementById('tutorialModal').style.display = 'none';
}

function setupEventListeners() {
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('soundBtn').addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        document.getElementById('soundBtn').textContent = soundEnabled ? '🔊 音效开' : '🔇 音效关';
    });
    document.getElementById('startGameBtn').addEventListener('click', closeTutorial);
    document.getElementById('closeTutorial').addEventListener('click', () => {
        document.getElementById('tutorialModal').style.display = 'none';
        initAudio(); // 交互时初始化音频
    });
    document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);
    document.getElementById('retryBtn').addEventListener('click', retryLevel);
    document.getElementById('closeLoseModal').addEventListener('click', () => {
        document.getElementById('loseModal').style.display = 'none';
    });
    document.getElementById('playMoreBtn').addEventListener('click', () => {
        document.getElementById('winModal').style.display = 'none';
        startGame();
    });
    document.getElementById('surpriseBtn').addEventListener('click', () => {
        const btn = document.getElementById('surpriseBtn');
        if (!btn.classList.contains('disabled') && !btn.disabled) {
            localStorage.setItem('surpriseUnlocked', 'true');
            window.location.href = 'loading.html';
        }
    });

    // 移动控制 & 星尘互动
    canvas.addEventListener('mousemove', (e) => {
        if (!isPlaying || isPaused) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        basketX = ((e.clientX - rect.left) * scaleX) - BASKET_WIDTH / 2;
        basketX = Math.max(0, Math.min(CANVAS_WIDTH - BASKET_WIDTH, basketX));

        if (Math.random() > 0.92) createSparkle(e.clientX, e.clientY);
    });

    // 为整个背景添加 圣境视差效果 (Sanctuary Parallax)
    document.addEventListener('mousemove', (e) => {
        const shards = document.querySelectorAll('.shard');
        const x = (e.clientX / window.innerWidth - 0.5) * 30;
        const y = (e.clientY / window.innerHeight - 0.5) * 30;

        shards.forEach((shard, i) => {
            const factor = (i + 1) * 0.5;
            shard.style.transform = `translate(${x * factor}px, ${y * factor}px) rotate(${x * 0.05}deg)`;
        });

        // 极光星云偏移
        const nebula = document.querySelector('.nebula-mist');
        if (nebula) {
            nebula.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px) scale(1.1)`;
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        if (!isPlaying || isPaused) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        basketX = ((e.touches[0].clientX - rect.left) * scaleX) - BASKET_WIDTH / 2;
        basketX = Math.max(0, Math.min(CANVAS_WIDTH - BASKET_WIDTH, basketX));
    }, { passive: false });

    // 点击或触摸直接移动篮子以降低难度
    canvas.addEventListener('touchstart', (e) => {
        if (!isPlaying || isPaused) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        basketX = ((e.touches[0].clientX - rect.left) * scaleX) - BASKET_WIDTH / 2;
        basketX = Math.max(0, Math.min(CANVAS_WIDTH - BASKET_WIDTH, basketX));
    }, { passive: true });

    canvas.addEventListener('mousedown', (e) => {
        if (!isPlaying || isPaused) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        basketX = ((e.clientX - rect.left) * scaleX) - BASKET_WIDTH / 2;
        basketX = Math.max(0, Math.min(CANVAS_WIDTH - BASKET_WIDTH, basketX));
    });
}

function startGame() {
    isPlaying = true;
    items = [];
    score = 0;
    lives = 3;
    targetScore = level * 100;
    updateUI();
    gameLoop();
}

function gameLoop() {
    if (!isPlaying || isPaused) return;
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

function update() {
    spawnTimer++;
    const spawnRate = Math.max(30, 80 - (level * 15)); // 增加刷新间隔，让节奏更从容
    if (spawnTimer >= spawnRate) {
        spawnItem();
        spawnTimer = 0;
    }

    const fallSpeed = 3 + (level * 0.4); // 适配大网格的速度
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += fallSpeed * item.type.speedMult;

        // 碰撞检测
        if (item.y + ITEM_SIZE > CANVAS_HEIGHT - BASKET_HEIGHT &&
            item.x + ITEM_SIZE > basketX &&
            item.x < basketX + BASKET_WIDTH) {
            score += item.type.points;
            playSound('catch');
            items.splice(i, 1);
            updateUI();

            if (score >= targetScore) {
                winLevel();
            }
            continue;
        }

        // 漏掉
        if (item.y > CANVAS_HEIGHT) {
            items.splice(i, 1);
            lives--;
            playSound('miss');
            updateUI();
            if (lives <= 0) gameOver();
        }
    }
}

function spawnItem() {
    const rand = Math.random();
    let type = ITEM_TYPES[0];
    let acc = 0;
    for (const t of ITEM_TYPES) {
        acc += t.chance;
        if (rand < acc) {
            type = t;
            break;
        }
    }
    items.push({
        x: Math.random() * (CANVAS_WIDTH - ITEM_SIZE),
        y: -ITEM_SIZE,
        type: type
    });
}


function winLevel() {
    isPlaying = false;
    cancelAnimationFrame(animationId);

    if (level >= completedLevels) {
        completedLevels = Math.min(3, level);
    }

    saveProgress();
    updateSurpriseButton();
    const winScoreEl = document.getElementById('winScore');
    if (winScoreEl) winScoreEl.textContent = score;

    const nextBtn = document.getElementById('nextLevelBtn');
    const playMoreBtn = document.getElementById('playMoreBtn');

    if (level === 3) {
        if (nextBtn) {
            if (timeReached) {
                nextBtn.textContent = 'OPEN SURPRISE';
                if (playMoreBtn) playMoreBtn.classList.remove('hidden');
            } else {
                nextBtn.textContent = 'REPLAY LVL 3';
                if (playMoreBtn) playMoreBtn.classList.add('hidden');
            }
        }

        if (!timeReached) {
            const now = new Date();
            const target = getTargetTime();
            const diff = target - now;
            const mins = Math.max(0, Math.ceil(diff / 60000));
            setTimeout(() => {
                alert(`老婆耐心等待哦 还有 （${mins} 分钟）抱歉哦， 我爱你`);
            }, 300);
        }
    } else {
        if (nextBtn) nextBtn.textContent = `LEVEL ${level + 1} →`;
        if (playMoreBtn) playMoreBtn.classList.add('hidden');
    }

    const winModal = document.getElementById('winModal');
    if (winModal) winModal.style.display = 'flex';
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    // 针对新布局，如果丢失了具体的得分显示 ID，我们可以跳过或更新 UI
    const scoreEl = document.getElementById('score');
    console.log("Game Over. Final Score: " + score);

    const loseModal = document.getElementById('loseModal');
    if (loseModal) loseModal.style.display = 'flex';
}

function nextLevel() {
    document.getElementById('winModal').style.display = 'none';
    if (level < 3) {
        level++;
        startGame();
    } else {
        // 已满3关，如果时间到就去惊喜，否则重玩第3关
        if (timeReached) {
            localStorage.setItem('surpriseUnlocked', 'true');
            window.location.href = 'loading.html';
        } else {
            startGame();
        }
    }
}

function retryLevel() {
    document.getElementById('loseModal').style.display = 'none';
    startGame();
}

function restartGame() {
    level = 1;
    score = 0;
    lives = 3;
    completedLevels = 0; // 彻底重置所有通关进度

    saveProgress();
    updateSurpriseButton();
    updateUI();

    document.getElementById('winModal').style.display = 'none';
    document.getElementById('loseModal').style.display = 'none';
    startGame();
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseBtn').textContent = isPaused ? '▶️ 继续' : '⏸️ 暂停';
    if (!isPaused) gameLoop();
}

function closeTutorial() {
    document.getElementById('tutorialModal').style.display = 'none';
    initAudio();
    startGame();
}

// 倒计时显示
function startCountdown() {
    const update = () => {
        const now = new Date();
        const diff = targetTime - now;

        if (diff <= 0) {
            timeReached = true;
            document.getElementById('countdownTime').textContent = '00:00:00';
            updateSurpriseButton();
            clearInterval(countdownInterval);
        } else {
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            document.getElementById('countdownTime').textContent = `${h}:${m}:${s}`;
        }
    };
    update();
    countdownInterval = setInterval(update, 1000);
}

function updateUI() {
    document.getElementById('level').textContent = level;
    document.getElementById('score').textContent = score;
    document.getElementById('targetScore').textContent = targetScore;

    // 针对新布局，如果 lives 为 0 显示特殊符号
    const livesEl = document.getElementById('lives');
    livesEl.textContent = lives > 0 ? '❤️'.repeat(lives) : '💔';

    document.getElementById('levelProgress').textContent = `${completedLevels}/3`;
}

function updateSurpriseButton() {
    const btn = document.getElementById('surpriseBtn');
    const hint = document.getElementById('surpriseHint');

    // 强制同步时间状态
    const now = new Date();
    const target = getTargetTime();
    timeReached = now >= target;

    if (completedLevels >= 3 && timeReached) {
        btn.classList.remove('disabled');
        btn.disabled = false;
        hint.textContent = '✨ 惊喜已解锁，点击开启！ ✨';
        hint.style.color = '#d81b60'; // 醒目的粉色
    } else {
        btn.classList.add('disabled');
        btn.disabled = true;

        if (completedLevels >= 3 && !timeReached) {
            const diff = target - now;
            const mins = Math.max(0, Math.ceil(diff / 60000));
            hint.textContent = `老婆耐心等待哦 还有 （${mins} 分钟）抱歉哦， 我爱你`;
            hint.style.color = '#d81b60';
        } else {
            const cond = [];
            if (completedLevels < 3) cond.push(`通关 3 关 (当前: ${completedLevels}/3)`);
            if (!timeReached) cond.push('等待时间开启 (1:09 AM)');
            hint.textContent = `待达成: ${cond.join(' & ')}`;
            hint.style.color = '#666'; // 灰色表示未达成
        }
    }
}

// 珠光星尘生成器 (替代会误导的花瓣)
function createPetalRain() {
    const container = document.querySelector('.nebula-mist');
    if (!container) return;

    setInterval(() => {
        const dust = document.createElement('div');
        dust.style.position = 'fixed';
        dust.style.left = Math.random() * 100 + 'vw';
        dust.style.top = '-10px';
        dust.style.width = '2px';
        dust.style.height = '2px';
        dust.style.backgroundColor = 'rgba(229, 195, 195, 0.4)';
        dust.style.boxShadow = '0 0 10px rgba(229, 195, 195, 0.2)';
        dust.style.borderRadius = '50%';
        dust.style.pointerEvents = 'none';
        dust.style.zIndex = '-1';
        document.body.appendChild(dust);

        dust.animate([
            { transform: 'translateY(0) scale(1)', opacity: 0 },
            { transform: 'translateY(20vh) scale(1.5)', opacity: 0.3, offset: 0.2 },
            { transform: 'translateY(100vh) scale(0.5)', opacity: 0 }
        ], {
            duration: 8000 + Math.random() * 5000,
            easing: 'linear'
        }).onfinish = () => dust.remove();
    }, 800);
}

// 魔法触碰效果 (用于移动端模拟触感)
function createTouchFeedback(x, y) {
    const circle = document.createElement('div');
    circle.style.position = 'fixed';
    circle.style.left = x + 'px';
    circle.style.top = y + 'px';
    circle.style.width = '20px';
    circle.style.height = '20px';
    circle.style.borderRadius = '50%';
    circle.style.border = '2px solid #E5C3C3';
    circle.style.pointerEvents = 'none';
    circle.style.zIndex = '10000';
    document.body.appendChild(circle);

    circle.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.8 },
        { transform: 'translate(-50%, -50%) scale(2.5)', opacity: 0 }
    ], {
        duration: 400,
        easing: 'ease-out'
    }).onfinish = () => circle.remove();
}

// 进度保存
function saveProgress() {
    localStorage.setItem('catchLoveProgress', JSON.stringify({ level, completedLevels }));
}

function loadProgress() {
    const saved = localStorage.getItem('catchLoveProgress');
    if (saved) {
        const p = JSON.parse(saved);
        level = p.level || 1;
        completedLevels = p.completedLevels || 0;
    }
}

function createSparkle(x, y) {
    const sparkle = document.createElement('div');
    sparkle.style.position = 'fixed';
    sparkle.style.left = x + 'px';
    sparkle.style.top = y + 'px';
    sparkle.style.width = '4px';
    sparkle.style.height = '4px';
    sparkle.style.borderRadius = '50%';
    sparkle.style.backgroundColor = '#ffd700';
    sparkle.style.boxShadow = '0 0 10px #ffd700';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.zIndex = '9999';
    document.body.appendChild(sparkle);

    const animateX = (Math.random() - 0.5) * 100;
    const animateY = (Math.random() - 0.5) * 100;

    sparkle.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${animateX}px, ${animateY}px) scale(0)`, opacity: 0 }
    ], {
        duration: 1000,
        easing: 'ease-out'
    }).onfinish = () => sparkle.remove();
}

// 修改初始化部分
document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    initUI();
    setupEventListeners();
    startCountdown();
    createPetalRain();

    // 启动开场仪式动画
    startIntroSequence();
});

// ===== 宇宙粒子爱心开场动画 (Cosmos Intro) =====
function startIntroSequence() {
    const overlay = document.getElementById('introOverlay');
    const cvs = document.getElementById('cosmosCanvas');
    const ctx2 = cvs.getContext('2d');
    const mainContainer = document.getElementById('mainGameContainer');
    const m1 = document.getElementById('m1');
    const m2 = document.getElementById('m2');
    const m3 = document.getElementById('m3');

    let W, H, cx, cy;
    function resize() {
        W = cvs.width = window.innerWidth;
        H = cvs.height = window.innerHeight;
        cx = W / 2; cy = H / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    const TOTAL = 500;
    const cosParticles = [];
    let cosPhase = 'drift';
    let formProgress = 0;

    function heartPoint(t, scale) {
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        return { x: cx + x * scale, y: cy + y * scale };
    }

    class CosmosParticle {
        constructor() {
            this.x = Math.random() * (W || window.innerWidth);
            this.y = Math.random() * (H || window.innerHeight);
            this.vx = (Math.random() - 0.5) * 0.8;
            this.vy = (Math.random() - 0.5) * 0.8 - 0.2;
            this.size = Math.random() * 2.5 + 0.5;
            this.baseSize = this.size;
            this.alpha = Math.random() * 0.5 + 0.1;
            this.twinkle = Math.random() * Math.PI * 2;
            this.color = `hsl(${330 + Math.random() * 30},${80 + Math.random() * 20}%,${60 + Math.random() * 20}%)`;
            const t = Math.random() * Math.PI * 2;
            const s = Math.min(window.innerWidth, window.innerHeight) * 0.03;
            const hp = heartPoint(t, s);
            this.tx = hp.x; this.ty = hp.y;
            this.explodeVx = (Math.random() - 0.5) * 12;
            this.explodeVy = (Math.random() - 0.5) * 12;
        }
        update(fp) {
            this.twinkle += 0.04;
            if (cosPhase === 'drift') {
                this.x += this.vx; this.y += this.vy;
                if (this.x < 0 || this.x > W) this.vx *= -1;
                if (this.y < 0 || this.y > H) this.vy *= -1;
                this.alpha = 0.12 + 0.08 * Math.sin(this.twinkle);
                this.size = this.baseSize;
            } else if (cosPhase === 'form' || cosPhase === 'hold') {
                const ease = fp < 1 ? fp * fp * (3 - 2 * fp) : 1;
                this.x += (this.tx - this.x) * ease * 0.04 * (0.5 + fp);
                this.y += (this.ty - this.y) * ease * 0.04 * (0.5 + fp);
                this.alpha = 0.3 + ease * 0.7;
                this.size = this.baseSize * (1 + ease * 1.5);
            } else if (cosPhase === 'explode') {
                this.x += this.explodeVx;
                this.y += this.explodeVy;
                this.explodeVy += 0.06;
                this.alpha *= 0.96;
                this.size *= 0.96;
            }
        }
        draw() {
            ctx2.globalAlpha = Math.max(0, this.alpha);
            ctx2.fillStyle = this.color;
            ctx2.shadowBlur = 6;
            ctx2.shadowColor = this.color;
            ctx2.beginPath();
            ctx2.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
            ctx2.fill();
            ctx2.shadowBlur = 0;
        }
    }

    for (let i = 0; i < TOTAL; i++) cosParticles.push(new CosmosParticle());

    let rafId;
    const t0 = performance.now();
    const events = [
        { at: 1500, fn: () => m1.classList.add('show') },
        { at: 5000, fn: () => cosPhase = 'form' },
        { at: 7500, fn: () => { cosPhase = 'hold'; m1.classList.remove('show'); } },
        { at: 8300, fn: () => m2.classList.add('show') },
        { at: 11500, fn: () => m2.classList.remove('show') },
        { at: 12300, fn: () => m3.classList.add('show') },
        { at: 15200, fn: () => { m3.classList.remove('show'); cosPhase = 'explode'; } },
        { at: 16800, fn: () => revealGame() },
    ];

    function checkEvents() {
        const elapsed = performance.now() - t0;
        for (const ev of events) {
            if (!ev.done && elapsed >= ev.at) { ev.fn(); ev.done = true; }
        }
    }

    function drawBg() {
        const t = performance.now() * 0.0002;
        const grd = ctx2.createRadialGradient(
            cx + Math.cos(t) * W * 0.2, cy + Math.sin(t) * H * 0.2, 0,
            cx, cy, Math.max(W, H)
        );
        grd.addColorStop(0, `hsla(${320 + Math.sin(t * 0.7) * 20},60%,8%,1)`);
        grd.addColorStop(0.5, `hsla(${280 + Math.cos(t * 0.5) * 20},50%,4%,1)`);
        grd.addColorStop(1, '#000');
        ctx2.fillStyle = grd;
        ctx2.fillRect(0, 0, W, H);

        if (cosPhase === 'form' || cosPhase === 'hold') {
            const hgrd = ctx2.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.4);
            hgrd.addColorStop(0, `rgba(255,80,120,${formProgress * 0.15})`);
            hgrd.addColorStop(1, 'transparent');
            ctx2.fillStyle = hgrd;
            ctx2.fillRect(0, 0, W, H);
        }
    }

    function loop() {
        checkEvents();
        if (cosPhase === 'form') formProgress = Math.min(1, formProgress + 0.004);
        else if (cosPhase === 'hold') formProgress = Math.min(1, formProgress + 0.001);

        drawBg();
        ctx2.globalAlpha = 1;
        cosParticles.forEach(p => { p.update(formProgress); p.draw(); });
        ctx2.globalAlpha = 1;
        rafId = requestAnimationFrame(loop);
    }
    loop();

    function revealGame() {
        const flash = document.createElement('div');
        flash.className = 'supernova-flash';
        document.body.appendChild(flash);
        requestAnimationFrame(() => {
            flash.style.opacity = '1';
            setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => flash.remove(), 1200);
            }, 300);
        });
        overlay.style.opacity = '0';
        mainContainer.style.opacity = '1';
        mainContainer.style.transform = 'scale(1)';
        mainContainer.style.pointerEvents = 'auto';
        setTimeout(() => {
            cancelAnimationFrame(rafId);
            overlay.remove();
            document.getElementById('tutorialModal').style.display = 'flex';
        }, 2000);
    }
}

// 修改 draw 函数中的颜色
function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.shadowBlur = 0; // 确保清除所有阴影，防止篮子出现“重叠影子”

    // 奢华玫瑰金渐变篮子
    const gradient = ctx.createLinearGradient(basketX, 0, basketX + BASKET_WIDTH, 0);
    gradient.addColorStop(0, '#E5C3C3');
    gradient.addColorStop(0.5, '#f7d7d7');
    gradient.addColorStop(1, '#E5C3C3');

    // 绘制篮子主体 - 适配 700 高度并增加发光效果
    const basketY = CANVAS_HEIGHT - BASKET_HEIGHT + 10;
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 20; // 增加柔和的发光感
    ctx.shadowColor = 'rgba(229, 195, 195, 0.5)';
    ctx.roundRect(basketX, basketY, BASKET_WIDTH, BASKET_HEIGHT - 30, 20);
    ctx.fill();

    // 篮子描边增加细节
    ctx.shadowBlur = 0; // 描边不需要发光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 物品绘制 (使用更柔和的阴影)
    ctx.font = `${ITEM_SIZE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 77, 109, 0.3)';
    for (const item of items) {
        ctx.fillText(item.type.emoji, item.x + ITEM_SIZE / 2, item.y + ITEM_SIZE / 2);
    }
    ctx.shadowBlur = 0;
}

// 在 setupEventListeners 中添加全局点击反馈
document.addEventListener('touchstart', (e) => {
    createTouchFeedback(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
