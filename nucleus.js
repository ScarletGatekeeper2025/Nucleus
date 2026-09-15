// ESTADO GLOBAL DEL JUEGO
let state = {
    streak: 0,
    highScore: 0,
    stability: 50,
    timeLeft: 10,
    maxTime: 10,
    missionType: 'sustain', // 'sustain' o 'collapse'
    anomaly: 'Ninguna',
    anomalyType: 0, // 0: limpia, 1: drenaje, 2: subida, 3: caos
    ventReady: true,
    currentTier: 1
};

let gameInterval = null;
let ventTimeout = null; // Guardar referencia para limpiar el cooldown al reiniciar
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
    state.timeLeft = 10;
    state.maxTime = 10;
    state.stability = 50;
    
    state.missionType = Math.random() > 0.4 ? 'sustain' : 'collapse';
    
    if (state.missionType === 'sustain') {
        document.getElementById('mission-desc').innerText = "Mantén la estabilidad entre 20% y 80% hasta el fin del tiempo.";
    } else {
        document.getElementById('mission-desc').innerText = "Provoca el colapso absoluto: lleva la estabilidad a 0% o 100% antes de que expire el tiempo.";
    }

    generateAnomaly();
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
    clearInterval(gameInterval);
    clearTimeout(ventTimeout); // Limpiar temporizador de ventilación previo
    
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
    if (state.anomalyType === 1) {
        state.stability -= 1.2 * difficultyScale * (tickRate / 100);
    } else if (state.anomalyType === 2) {
        state.stability += 1.2 * difficultyScale * (tickRate / 100);
    } else if (state.anomalyType === 3) {
        state.stability += (Math.random() - 0.5) * 4 * difficultyScale;
    }

    // 2. Acotar límites absolutos
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;

    // 3. VICTORIA EN MODO COLAPSO (Evaluada ANTES de la penalización de Hipercriticidad)
    if (state.missionType === 'collapse' && (state.stability <= 0 || state.stability >= 100)) {
        endGame(true);
        return;
    }

    // 4. Aplicar Hipercriticidad (solo si el juego continúa)
    if (state.stability >= 99.9) {
        document.getElementById('critical-msg').style.display = 'block';
        state.stability -= 4.5 * difficultyScale; 
    } else {
        document.getElementById('critical-msg').style.display = 'none';
    }

    // Renderizar datos
    document.getElementById('stability-value').innerText = Math.round(state.stability) + "%";
    document.getElementById('stability-fill').style.width = state.stability + "%";
    
    let timePercent = (state.timeLeft / state.maxTime) * 100;
    document.getElementById('time-value').innerText = state.timeLeft.toFixed(1) + "s";
    document.getElementById('time-fill').style.width = timePercent + "%";

    // Derrotas instantáneas del modo Sostener
    if (state.missionType === 'sustain') {
        if (state.stability <= 0 || state.stability >= 100) {
            endGame(false, "El núcleo llegó al límite absoluto físico y estalló.");
            return;
        }
    }

    // Evaluación al agotarse el tiempo
    if (state.timeLeft <= 0) {
        if (state.missionType === 'sustain') {
            // Ajustado a la regla visual oficial (20% - 80%)
            if (state.stability >= 20 && state.stability <= 80) {
                endGame(true);
            } else {
                endGame(false, "El tiempo expiró mientras la estabilidad estaba fuera del rango seguro (20%-80%).");
            }
        } else {
            endGame(false, "No lograste colapsar el bucle a tiempo. Se generó una paradoja infinita.");
        }
        return;
    }
}

function adjustStability(amount) {
    state.stability += amount;
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;

    // Evaluar victoria inmediata al hacer clic en modo Colapso
    if (state.missionType === 'collapse' && (state.stability <= 0 || state.stability >= 100)) {
        endGame(true);
    }
}

function triggerVenting() {
    if (!state.ventReady) return;
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
        state.streak += 1;
        if (state.streak > state.highScore) {
            state.highScore = state.streak;
            localStorage.setItem('nucleus_highscore', state.highScore);
        }
        switchScreen('success-screen');
    } else {
        state.streak = 0;
        document.getElementById('gameover-reason').innerText = reason;
        switchScreen('gameover-screen');
    }
}

function nextCycle() {
    startGame();
}

function goToMenu() {
    clearInterval(gameInterval);
    clearTimeout(ventTimeout);
    state.streak = 0;
    document.getElementById('menu-highscore').innerText = state.highScore;
    switchScreen('menu-screen');
    document.documentElement.style.setProperty('--bg-color', '#0d0f12');
    document.documentElement.style.setProperty('--accent-color', '#00f0ff');
}

