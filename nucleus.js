/* ==========================================================================
   NUCLEUS - v0.3.0 (The Audio Update)
   ========================================================================== */

// 1. CONFIGURACIÓN DEL MOTOR DE AUDIO (Howler.js + Audio Sprite)
const sfx = new Howl({
    src: ['sfx_nucleus.mp3'], // Archivo único de sonido
    volume: 0.6,
    sprite: {
        inject: [0, 250],        // Inyección de masa (+12%)
        extract: [300, 250],     // Extracción de masa (-12%)
        vent: [600, 1000],       // Ventilación de emergencia (-25%)
        bossAlert: [1700, 1400], // Sirena de inicio de Ciclo de Jefe
        critical: [3200, 400],   // Beep de alerta de Hipercriticidad
        win: [3700, 900],        // Fanfarria de éxito de ciclo
        lose: [4700, 1200],      // Sonido de colapso / Game Over
        click: [6000, 150]       // Clic genérico de interfaz
    }
});

// Estado de sonido global
let isMuted = false;

function toggleMute() {
    isMuted = !isMuted;
    Howler.mute(isMuted);
    let btn = document.getElementById('btn-mute');
    if (btn) {
        btn.innerText = isMuted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
    }
}

// 2. ESTADO GLOBAL DEL JUEGO
let state = {
    streak: 0,
    highScore: 0,
    stability: 50,
    timeLeft: 10,
    maxTime: 10,
    missionType: 'sustain', 
    anomaly: 'Ninguna',
    anomalyType: 0, 
    ventReady: true,
    currentTier: 1,
    isBossCycle: false,
    checkpoint: 0,     // Última década superada
    canRevert: false   // Disponibilidad de reversión temporal
};

let gameInterval = null;
let ventTimeout = null;
const tickRate = 100;

const tierThemes = [
    { bg: '#0d0f12', accent: '#00f0ff' }, 
    { bg: '#100f1a', accent: '#a100ff' }, 
    { bg: '#1a0d0d', accent: '#ff8400' }, 
    { bg: '#1c1c0d', accent: '#e1ff00' }, 
    { bg: '#1f050b', accent: '#ff003c' }  
];

window.onload = function() {
    if (localStorage.getItem('nucleus_highscore')) {
        state.highScore = parseInt(localStorage.getItem('nucleus_highscore'));
        document.getElementById('menu-highscore').innerText = state.highScore;
    }
};

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateTierTheme() {
    let tierIndex = Math.min(Math.floor(state.streak / 10), tierThemes.length - 1);
    let theme = tierThemes[tierIndex];
    document.documentElement.style.setProperty('--bg-color', theme.bg);
    document.documentElement.style.setProperty('--accent-color', theme.accent);
    state.currentTier = Math.floor(state.streak / 10) + 1;
    document.getElementById('game-tier').innerText = state.currentTier;
}

function generateMission() {
    state.stability = 50;
    
    // Evaluar si el ciclo es un Ciclo de Jefe (Ciclos 10, 20, 30...)
    if ((state.streak + 1) % 10 === 0 && state.streak > 0) {
        state.isBossCycle = true;
        state.timeLeft = 7.0;
        state.maxTime = 7.0;
        state.missionType = 'sustain';
        document.getElementById('mission-desc').innerText = "⚠️ CICLO DE JEFE (FASE 1): Mantén la masa entre 30% y 70%. ¡Directiva cambiará a mitad de tiempo!";
        state.anomaly = "☣️ SINGULARIDAD COMPUESTA: Fuga de Taquiones + Tormenta Cuántica";
        document.getElementById('anomaly-box').innerText = state.anomaly;
        
        // Sonido de alerta de Jefe
        sfx.play('bossAlert');
    } else {
        state.isBossCycle = false;
        state.timeLeft = 10.0;
        state.maxTime = 10.0;
        state.missionType = Math.random() > 0.4 ? 'sustain' : 'collapse';
        
        if (state.missionType === 'sustain') {
            document.getElementById('mission-desc').innerText = "Mantén la estabilidad entre 20% y 80% hasta el fin del tiempo.";
        } else {
            document.getElementById('mission-desc').innerText = "Provoca el colapso absoluto: lleva la estabilidad a 0% o 100% antes de que expire el tiempo.";
        }
        generateAnomaly();
    }
}

function generateAnomaly() {
    let chance = Math.random();
    if (chance < 0.33) {
        state.anomaly = "🚨 FUGA DE TAQUIONES: Drenaje continuo fuerte";
        state.anomalyType = 1;
    } else if (chance < 0.66) {
        state.anomaly = "⚡ SOBRECARGA DINÁMICA: Aumento de presión continuo";
        state.anomalyType = 2;
    } else {
        state.anomaly = "🌀 TORMENTA CUÁNTICA: Fluctuaciones impredecibles";
        state.anomalyType = 3;
    }
    document.getElementById('anomaly-box').innerText = state.anomaly;
}

function startGame() {
    sfx.play('click');
    clearInterval(gameInterval);
    clearTimeout(ventTimeout);
    
    updateTierTheme();
    generateMission();
    
    state.ventReady = true;
    document.getElementById('btn-vent').disabled = false;
    document.getElementById('vent-cooldown').innerText = "Sistema listo";

    document.getElementById('game-streak').innerText = state.streak;
    document.getElementById('game-highscore').innerText = state.highScore;

    switchScreen('game-screen');
    gameInterval = setInterval(gameTick, tickRate);
}

function gameTick() {
    state.timeLeft -= (tickRate / 1000);
    if (state.timeLeft <= 0) state.timeLeft = 0;

    let difficultyScale = 1 + (state.currentTier - 1) * 0.5;

    // 1. Aplicar Anomalías
    if (state.isBossCycle) {
        state.stability -= 1.2 * difficultyScale * (tickRate / 100);
        state.stability += (Math.random() - 0.5) * 4 * difficultyScale;

        // Cambio dinámico de directiva a los 3.5s
        if (state.timeLeft <= 3.5 && state.missionType === 'sustain') {
            state.missionType = 'collapse';
            document.getElementById('mission-desc').innerText = "🚨 ALERTA DE JEFE (FASE 2): ¡COLAPSO INMINENTE! Forzar masa a 0% o 100% ¡YA!";
            sfx.play('bossAlert');
        }
    } else {
        if (state.anomalyType === 1) state.stability -= 1.2 * difficultyScale * (tickRate / 100);
        else if (state.anomalyType === 2) state.stability += 1.2 * difficultyScale * (tickRate / 100);
        else if (state.anomalyType === 3) state.stability += (Math.random() - 0.5) * 4 * difficultyScale;
    }

    // 2. Acotar límites absolutos
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;

    // 3. VICTORIA EN MODO COLAPSO
    if (state.missionType === 'collapse' && (state.stability <= 0 || state.stability >= 100)) {
        endGame(true);
        return;
    }

    // 4. Hipercriticidad y sonido de advertencia
    if (state.stability >= 99.9) {
        document.getElementById('critical-msg').style.display = 'block';
        state.stability -= 4.5 * difficultyScale; 
        if (Math.random() < 0.3) sfx.play('critical');
    } else {
        document.getElementById('critical-msg').style.display = 'none';
    }

    // Renderizar datos UI
    document.getElementById('stability-value').innerText = Math.round(state.stability) + "%";
    document.getElementById('stability-fill').style.width = state.stability + "%";
    
    let timePercent = (state.timeLeft / state.maxTime) * 100;
    document.getElementById('time-value').innerText = state.timeLeft.toFixed(1) + "s";
    document.getElementById('time-fill').style.width = timePercent + "%";

    // Derrotas instantáneas en modo Sostener
    if (state.missionType === 'sustain') {
        if (state.stability <= 0 || state.stability >= 100) {
            endGame(false, "El núcleo superó el límite crítico durante la fase de sostenimiento.");
            return;
        }
    }

    // Evaluación al agotarse el tiempo
    if (state.timeLeft <= 0) {
        if (state.missionType === 'sustain') {
            if (state.stability >= 20 && state.stability <= 80) {
                endGame(true);
            } else {
                endGame(false, "El tiempo expiró fuera del rango seguro.");
            }
        } else {
            endGame(false, "No lograste colapsar el núcleo a tiempo.");
        }
        return;
    }
}

function adjustStability(amount) {
    if (amount > 0) sfx.play('inject');
    else sfx.play('extract');

    state.stability += amount;
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;

    if (state.missionType === 'collapse' && (state.stability <= 0 || state.stability >= 100)) {
        endGame(true);
    }
}

function triggerVenting() {
    if (!state.ventReady) return;
    sfx.play('vent');
    
    adjustStability(-25);
    state.ventReady = false;
    document.getElementById('btn-vent').disabled = true;
    document.getElementById('vent-cooldown').innerText = "Recargando sistemas...";
    
    ventTimeout = setTimeout(() => {
        state.ventReady = true;
        let btn = document.getElementById('btn-vent');
        let label = document.getElementById('vent-cooldown');
        if (btn) btn.disabled = false;
        if (label) label.innerText = "Sistema listo";
    }, 4000);
}

function endGame(success, reason = "") {
    clearInterval(gameInterval);
    clearTimeout(ventTimeout);

    if (success) {
        sfx.play('win');
        if (state.isBossCycle) {
            state.streak += 3;
            state.checkpoint = state.streak;
            state.canRevert = true;
            state.ventReady = true;
        } else {
            state.streak += 1;
        }

        if (state.streak > state.highScore) {
            state.highScore = state.streak;
            localStorage.setItem('nucleus_highscore', state.highScore);
        }
        switchScreen('success-screen');
    } else {
        sfx.play('lose');
        setupGameOverUI(reason);
        switchScreen('gameover-screen');
    }
}

function setupGameOverUI(reason) {
    document.getElementById('gameover-reason').innerText = reason;
    
    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();

    if (state.canRevert && state.checkpoint > 0) {
        let revertBtn = document.createElement('button');
        revertBtn.id = 'btn-revert';
        revertBtn.className = 'btn';
        revertBtn.style.borderColor = 'var(--warning-color)';
        revertBtn.style.color = 'var(--warning-color)';
        revertBtn.innerText = `Reversión Temporal (Volver al Ciclo ${state.checkpoint})`;
        revertBtn.onclick = revertToAnchor;
        
        let screen = document.getElementById('gameover-screen');
        screen.insertBefore(revertBtn, screen.children[2]);
    } else {
        state.streak = 0;
    }
}

function revertToAnchor() {
    sfx.play('click');
    state.streak = state.checkpoint;
    state.canRevert = false;
    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();
    startGame();
}

function nextCycle() {
    sfx.play('click');
    startGame();
}

function goToMenu() {
    sfx.play('click');
    clearInterval(gameInterval);
    clearTimeout(ventTimeout);
    state.streak = 0;
    state.canRevert = false;
    document.getElementById('menu-highscore').innerText = state.highScore;
    switchScreen('menu-screen');
    document.documentElement.style.setProperty('--bg-color', '#0d0f12');
    document.documentElement.style.setProperty('--accent-color', '#00f0ff');
}

