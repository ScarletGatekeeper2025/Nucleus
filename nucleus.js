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
const tickRate = 100; // 10 ticks por segundo para fluidez

// Paletas de color dinámicas según la decena
const tierThemes = [
    { bg: '#0d0f12', accent: '#00f0ff' }, // Nivel 1-9 (Cian)
    { bg: '#100f1a', accent: '#a100ff' }, // Nivel 10-19 (Púrpura)
    { bg: '#1a0d0d', accent: '#ff8400' }, // Nivel 20-29 (Naranja)
    { bg: '#1c1c0d', accent: '#e1ff00' }, // Nivel 30-39 (Amarillo-Ácido)
    { bg: '#1f050b', accent: '#ff003c' }  // Nivel 40+ (Rojo Apocalipsis)
];

// Cargar récord inicial al iniciar la página
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
    
    // Decidir tipo de misión de forma aleatoria (40% colapso, 60% sostener)
    state.missionType = Math.random() > 0.4 ? 'sustain' : 'collapse';
    
    if (state.missionType === 'sustain') {
        document.getElementById('mission-desc').innerText = "Mantén la estabilidad entre 20% y 80% hasta el fin del tiempo.";
    } else {
        document.getElementById('mission-desc').innerText = "Provoca el colapso absoluto: lleva la estabilidad a 0% o 100% antes de que expire el tiempo.";
    }

    generateAnomaly();
}

function generateAnomaly() {
    let intensityMultiplier = 1 + (state.currentTier - 1) * 0.4;
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

    // Procesar comportamiento de anomalías
    if (state.anomalyType === 1) {
        state.stability -= 1.2 * difficultyScale * (tickRate / 100);
    } else if (state.anomalyType === 2) {
        state.stability += 1.2 * difficultyScale * (tickRate / 100);
    } else if (state.anomalyType === 3) {
        state.stability += (Math.random() - 0.5) * 4 * difficultyScale;
    }

    // --- MECÁNICA: SOBRESTABILIDAD DEL 100% ---
    if (state.stability >= 99.9) {
        state.stability = 100;
        document.getElementById('critical-msg').style.display = 'block';
        state.stability -= 4.5 * difficultyScale; 
    } else {
        document.getElementById('critical-msg').style.display = 'none';
    }

    // Acotar valores límites
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;

    // Renderizar datos en pantalla
    document.getElementById('stability-value').innerText = Math.round(state.stability) + "%";
    document.getElementById('stability-fill').style.width = state.stability + "%";
    
    let timePercent = (state.timeLeft / state.maxTime) * 100;
    document.getElementById('time-value').innerText = state.timeLeft.toFixed(1) + "s";
    document.getElementById('time-fill').style.width = timePercent + "%";

    // Evaluar derrotas instantáneas del modo Sostener
    if (state.missionType === 'sustain') {
        if (state.stability <= 0 || state.stability >= 100) {
            endGame(false, "El núcleo llegó al límite absoluto físico y estalló.");
            return;
        }
    }

    // Evaluar cierre de ciclo al agotarse el tiempo
    if (state.timeLeft <= 0) {
        if (state.missionType === 'sustain') {
            if (state.stability > 15 && state.stability < 85) {
                endGame(true);
            } else {
                endGame(false, "El tiempo expiró mientras el núcleo estaba demasiado inestable.");
            }
        } else {
            endGame(false, "No lograste colapsar el bucle a tiempo. Se generó un bucle infinito eterno.");
        }
    } else {
        // En modo colapso, si toca extremos antes de terminar el tiempo gana de inmediato
        if (state.missionType === 'collapse' && (state.stability <= 0 || state.stability >= 100)) {
            endGame(true);
        }
    }
}

function adjustStability(amount) {
    state.stability += amount;
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;
}

function triggerVenting() {
    if (!state.ventReady) return;
    adjustStability(-25);
    state.ventReady = false;
    document.getElementById('btn-vent').disabled = true;
    document.getElementById('vent-cooldown').innerText = "Recargando sistemas...";
    
    setTimeout(() => {
        state.ventReady = true;
        document.getElementById('btn-vent').disabled = false;
        document.getElementById('vent-cooldown').innerText = "Sistema listo";
    }, 4000); // Cooldown de 4 segundos
}

function endGame(success, reason = "") {
    clearInterval(gameInterval);
    if (success) {
        state.streak += 1;
        if (state.streak > state.highScore) {
            state.highScore = state.streak;
            localStorage.setItem('nucleus_highscore', state.highScore);
        }
        switchScreen('success-screen');
    } else {
        state.streak = 0; // Perder rompe la racha actual
        document.getElementById('gameover-reason').innerText = reason;
        switchScreen('gameover-screen');
    }
}

function nextCycle() {
    startGame();
}

function goToMenu() {
    clearInterval(gameInterval);
    state.streak = 0; // Regresar al menú voluntariamente rompe la racha actual
    document.getElementById('menu-highscore').innerText = state.highScore;
    switchScreen('menu-screen');
    document.documentElement.style.setProperty('--bg-color', '#0d0f12');
    document.documentElement.style.setProperty('--accent-color', '#00f0ff');
}

