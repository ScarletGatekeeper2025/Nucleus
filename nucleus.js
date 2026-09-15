// ESTADO GLOBAL DEL JUEGO
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
    checkpoint: 0,     // Almacena el ciclo de la última década superada
    canRevert: false   // Indica si la reversión temporal está disponible
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
    
    // Evaluar si el ciclo entrante es un Ciclo de Jefe (Ciclos 10, 20, 30...)
    if ((state.streak + 1) % 10 === 0 && state.streak > 0) {
        state.isBossCycle = true;
        state.timeLeft = 7.0;
        state.maxTime = 7.0;
        state.missionType = 'sustain';
        document.getElementById('mission-desc').innerText = "⚠️ CICLO DE JEFE (FASE 1): Mantén la masa entre 30% y 70%. ¡Directiva cambiará a mitad de tiempo!";
        state.anomaly = "☣️ SINGULARIDAD COMPUESTA: Fuga de Taquiones + Tormenta Cuántica";
        document.getElementById('anomaly-box').innerText = state.anomaly;
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
        // En Jefe actúan Drenaje y Fluctuación simultáneamente
        state.stability -= 1.2 * difficultyScale * (tickRate / 100);
        state.stability += (Math.random() - 0.5) * 4 * difficultyScale;

        // Cambio dinámico de directiva a los 3.5 segundos en el Jefe
        if (state.timeLeft <= 3.5 && state.missionType === 'sustain') {
            state.missionType = 'collapse';
            document.getElementById('mission-desc').innerText = "🚨 ALERTA DE JEFE (FASE 2): ¡COLAPSO INMINENTE! Forzar masa a 0% o 100% ¡YA!";
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

    // 4. Hipercriticidad
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
        let minRange = state.isBossCycle ? 30 : 20;
        let maxRange = state.isBossCycle ? 70 : 80;
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
    state.stability += amount;
    if (state.stability < 0) state.stability = 0;
    if (state.stability > 100) state.stability = 100;

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
        if (state.isBossCycle) {
            state.streak += 3; // Recompensa de jefe: +3 a la racha
            state.checkpoint = state.streak; // Anclaje de checkpoint
            state.canRevert = true;
            state.ventReady = true; // Reinicio directo de ventilación
        } else {
            state.streak += 1;
        }

        if (state.streak > state.highScore) {
            state.highScore = state.streak;
            localStorage.setItem('nucleus_highscore', state.highScore);
        }
        switchScreen('success-screen');
    } else {
        setupGameOverUI(reason);
        switchScreen('gameover-screen');
    }
}

function setupGameOverUI(reason) {
    document.getElementById('gameover-reason').innerText = reason;
    
    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();

    // Inyección dinámica del botón de reversión si está disponible
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
        state.streak = 0; // Si no hay anclaje disponible, resetea a 0
    }
}

function revertToAnchor() {
    state.streak = state.checkpoint;
    state.canRevert = false; // Se consume el uso único
    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();
    startGame();
}

function nextCycle() {
    startGame();
}

function goToMenu() {
    clearInterval(gameInterval);
    clearTimeout(ventTimeout);
    state.streak = 0;
    state.canRevert = false;
    document.getElementById('menu-highscore').innerText = state.highScore;
    switchScreen('menu-screen');
    document.documentElement.style.setProperty('--bg-color', '#0d0f12');
    document.documentElement.style.setProperty('--accent-color', '#00f0ff');
}

