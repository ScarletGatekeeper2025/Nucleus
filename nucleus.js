// ==========================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ==========================================
const CONFIG = {
    defaultTime: 10.0,
    bossTime: 20.0,             // Duración del jefe (20s)
    bossShiftInterval: 5.0,     // Cambio de zona segura cada 5s
    bossPulseInterval: 4.0,     // Pulso del jefe cada 4s
    bossPulseAmount: 20,        // Impacto del pulso (±20%)
    tickRateMs: 100,
    injectAmount: 12,
    ventAmount: 25,
    ventCooldownMs: 4000,
    hyperDrainRate: 4.5,
    sustainMin: 20,
    sustainMax: 80,
    exitHoldMs: 3000,           // Tiempo para salir al menú (3s)
    comboWindowMs: 500,         // Ventana de tiempo para combo por alternancia
    cooldownReductionMs: 500    // Reducción de recarga de Purga por combo
};

const TIER_THEMES = [
    { bg: '#0d0f12', accent: '#00f0ff' }, 
    { bg: '#100f1a', accent: '#a100ff' }, 
    { bg: '#1a0d0d', accent: '#ff8400' }, 
    { bg: '#1c1c0d', accent: '#e1ff00' }, 
    { bg: '#1f050b', accent: '#ff003c' }  
];

const ANOMALIES = {
    TAQUIONES: {
        id: 'taquiones',
        name: "🚨 FUGA DE TAQUIONES: Drenaje continuo fuerte",
        apply: (stability, scale, delta) => stability - (1.2 * scale * delta)
    },
    SOBRECARGA: {
        id: 'sobrecarga',
        name: "⚡ SOBRECARGA DINÁMICA: Aumento de presión continuo",
        apply: (stability, scale, delta) => stability + (1.2 * scale * delta)
    },
    TORMENTA: {
        id: 'tormenta',
        name: "🌀 TORMENTA CUÁNTICA: Fluctuaciones moderadas",
        apply: (stability, scale, delta) => stability + (Math.random() - 0.5) * 4 * scale
    },
    TORMENTA_SEVERA: {
        id: 'tormenta_severa',
        name: "🌪️ TORMENTA SEVERA: Turbulencia violenta y picos agresivos",
        apply: (stability, scale, delta) => {
            let noise = (Math.random() - 0.5) * 9 * scale;
            let microPulse = Math.random() < 0.08 ? (Math.random() > 0.5 ? 10 : -10) * scale : 0;
            return stability + noise + microPulse;
        }
    },
    SALTOS_CUANTICOS: {
        id: 'saltos_cuanticos',
        name: "☣️ MICROSALTOS CUÁNTICOS: Teleportación instantánea de masa",
        apply: (stability, scale, delta) => {
            let baseNoise = (Math.random() - 0.5) * 2 * scale;
            let jump = Math.random() < 0.10 ? (Math.random() - 0.5) * 30 * scale : 0;
            return stability + baseNoise + jump;
        }
    }
};

// ==========================================
// 2. ESTADO GLOBAL
// ==========================================
let state = {
    streak: 0,
    highScore: 0,
    stability: 50,
    timeLeft: CONFIG.defaultTime,
    maxTime: CONFIG.defaultTime,
    missionType: 'sustain', 
    collapseTarget: 'both',     // 'min' (0%), 'max' (100%), o 'both'
    currentAnomalyKey: null,
    ventReady: true,
    ventCooldownEndTime: 0,
    currentTier: 1,
    isBossCycle: false,
    checkpoint: 0,
    canRevert: false,
    bossTargetMin: 30,
    bossTargetMax: 60,
    nextShiftTime: 0,
    nextPulseTime: 0,
    pulseWarning: false,
    // Estado táctico y de combos
    clickHistory: [],
    lastActionType: null,       // 'inject' o 'extract'
    lastActionTime: 0
};

let gameInterval = null;
let ventTimeout = null;
let frenzyTimeout = null;

// ==========================================
// 3. INICIALIZACIÓN Y CONFIGURACIÓN DE EVENTOS
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    let savedHighScore = localStorage.getItem('nucleus_highscore');
    if (savedHighScore) {
        state.highScore = parseInt(savedHighScore, 10);
        let menuElem = document.getElementById('menu-highscore');
        if (menuElem) menuElem.innerText = state.highScore;
    }
    setupHoldToExitButtons();
});

// Lógica de agitación visual (Screen Shake)
function applyScreenShake(type) {
    const core = document.querySelector('.bar-container');
    if (!core) return;

    if (type === 'impact') {
        core.classList.add('shake-impact');
        setTimeout(() => core.classList.remove('shake-impact'), 150);
    } else if (type === 'warning') {
        core.classList.add('shake-warning');
        core.classList.remove('shake-critical');
    } else if (type === 'critical') {
        core.classList.add('shake-critical');
        core.classList.remove('shake-warning');
    } else {
        core.classList.remove('shake-warning', 'shake-impact', 'shake-critical');
    }
}

// Configuración de botones "Mantener 3s para Salir"
function setupHoldToExitButtons() {
    let exitBtns = document.querySelectorAll('.btn-hold-exit, #btn-exit');
    if (!exitBtns.length) return;

    exitBtns.forEach(exitBtn => {
        let holdTimer = null;
        let animFrame = null;
        let startTime = 0;
        const defaultText = exitBtn.getAttribute('data-default-text') || exitBtn.innerText || "Salir al Menú";
        exitBtn.setAttribute('data-default-text', defaultText);

        function cancelHold() {
            if (holdTimer) clearTimeout(holdTimer);
            if (animFrame) cancelAnimationFrame(animFrame);
            holdTimer = null;
            animFrame = null;
            exitBtn.style.background = '';
            exitBtn.innerText = defaultText;
        }

        function startHold(e) {
            if (e.type === 'touchstart') e.preventDefault();
            cancelHold();

            startTime = Date.now();

            function updateProgress() {
                let elapsed = Date.now() - startTime;
                let pct = Math.min(100, (elapsed / CONFIG.exitHoldMs) * 100);
                let remaining = Math.ceil((CONFIG.exitHoldMs - elapsed) / 1000);

                exitBtn.style.background = `linear-gradient(to right, rgba(255, 0, 60, 0.4) ${pct}%, transparent ${pct}%)`;
                exitBtn.innerText = `Mantén (${remaining}s)...`;

                if (elapsed < CONFIG.exitHoldMs) {
                    animFrame = requestAnimationFrame(updateProgress);
                }
            }

            animFrame = requestAnimationFrame(updateProgress);

            holdTimer = setTimeout(() => {
                cancelHold();
                goToMenu();
            }, CONFIG.exitHoldMs);
        }

        exitBtn.onmousedown = startHold;
        exitBtn.ontouchstart = startHold;

        exitBtn.onmouseup = cancelHold;
        exitBtn.onmouseleave = cancelHold;
        exitBtn.ontouchend = cancelHold;
        exitBtn.ontouchcancel = cancelHold;
    });
}

function clearTimers() {
    if (gameInterval) clearInterval(gameInterval);
    if (ventTimeout) clearTimeout(ventTimeout);
    if (frenzyTimeout) clearTimeout(frenzyTimeout);
    gameInterval = null;
    ventTimeout = null;
    frenzyTimeout = null;
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    let target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

function updateTheme() {
    let tierIndex = Math.min(Math.floor(state.streak / 10), TIER_THEMES.length - 1);
    let theme = TIER_THEMES[tierIndex];
    document.documentElement.style.setProperty('--bg-color', theme.bg);
    document.documentElement.style.setProperty('--accent-color', theme.accent);
    state.currentTier = Math.floor(state.streak / 10) + 1;
}

function randomizeBossTarget() {
    let minRange = Math.floor(Math.random() * 55) + 10;
    state.bossTargetMin = minRange;
    state.bossTargetMax = minRange + 30;
}

// ==========================================
// 4. CONFIGURACIÓN DE MISIONES Y COLAPSO
// ==========================================
function setupMission() {
    state.stability = 50;
    state.clickHistory = [];
    state.lastActionType = null;
    state.lastActionTime = 0;
    
    let isBoss = (state.streak + 1) % 10 === 0 && state.streak > 0;

    if (isBoss) {
        state.isBossCycle = true;
        state.timeLeft = CONFIG.bossTime;
        state.maxTime = CONFIG.bossTime;
        state.missionType = 'sustain';
        state.currentAnomalyKey = null;
        state.nextShiftTime = CONFIG.bossTime - CONFIG.bossShiftInterval;
        state.nextPulseTime = CONFIG.bossTime - CONFIG.bossPulseInterval;
        state.pulseWarning = false;
        randomizeBossTarget();
    } else {
        state.isBossCycle = false;
        state.timeLeft = CONFIG.defaultTime;
        state.maxTime = CONFIG.defaultTime;
        state.missionType = Math.random() > 0.4 ? 'sustain' : 'collapse';
        
        if (state.missionType === 'collapse') {
            let roll = Math.random();
            if (roll < 0.15) {
                state.collapseTarget = 'both';
            } else if (roll < 0.575) {
                state.collapseTarget = 'min';
            } else {
                state.collapseTarget = 'max';
            }
        }
        
        let anomalyKeys = Object.keys(ANOMALIES);
        state.currentAnomalyKey = anomalyKeys[Math.floor(Math.random() * anomalyKeys.length)];
    }
}

// ==========================================
// 5. EVALUACIÓN DE LÍMITES Y CONDICIONES
// ==========================================
function checkBoundariesAndConditions() {
    if (state.stability <= 0 || state.stability >= 100) {
        if (state.missionType === 'collapse') {
            if (state.stability <= 0) {
                if (state.collapseTarget === 'min' || state.collapseTarget === 'both') {
                    endGame(true);
                } else {
                    endGame(false, "Fallo: Vaciaste el núcleo (0%) cuando la directiva exigía Sobrecarga (100%).");
                }
            } else if (state.stability >= 100) {
                if (state.collapseTarget === 'max' || state.collapseTarget === 'both') {
                    endGame(true);
                } else {
                    endGame(false, "Fallo: Provocaste una Sobrecarga (100%) cuando la directiva exigía Dispersión (0%).");
                }
            }
        } else {
            endGame(false, "El núcleo colapsó por exceso o vaciamiento absoluto de masa.");
        }
        return true;
    }
    return false;
}

// ==========================================
// 6. RENDERIZADO UNIFICADO DE INTERFAZ Y SHAKE
// ==========================================
function renderUI() {
    let streakElem = document.getElementById('game-streak');
    if (streakElem) streakElem.innerText = state.streak;
    
    let highElem = document.getElementById('game-highscore');
    if (highElem) highElem.innerText = state.highScore;

    let tierElem = document.getElementById('game-tier');
    if (tierElem) tierElem.innerText = state.currentTier;

    let missionDesc = document.getElementById('mission-desc');
    let anomalyBox = document.getElementById('anomaly-box');
    let targetZone = document.getElementById('target-zone');

    if (targetZone) {
        if (state.missionType === 'sustain' || state.isBossCycle) {
            let min = state.isBossCycle ? (state.bossTargetMin || 30) : CONFIG.sustainMin;
            let max = state.isBossCycle ? (state.bossTargetMax || 60) : CONFIG.sustainMax;
            
            targetZone.style.display = 'block';
            targetZone.style.left = min + '%';
            targetZone.style.width = (max - min) + '%';
        } else {
            targetZone.style.display = 'none';
        }
    }

    if (missionDesc && anomalyBox) {
        if (state.isBossCycle) {
            let warningText = state.pulseWarning ? " ⚠️ ¡PULSO EN 1s!" : "";
            missionDesc.innerText = `⚠️ JEFE: Mantén la masa en la zona destacada.${warningText}`;
            anomalyBox.innerText = "☣️ SINGULARIDAD DE DÉCADA: Zona Móvil + Pulsos de ±20%";
        } else {
            if (state.missionType === 'sustain') {
                missionDesc.innerText = `Mantén la masa dentro del rango destacado hasta que expire el tiempo.`;
            } else {
                if (state.collapseTarget === 'min') {
                    missionDesc.innerText = "🚨 COLAPSO POR DISPERSIÓN: Vacía la masa a 0% obligatoriamente.";
                } else if (state.collapseTarget === 'max') {
                    missionDesc.innerText = "🚨 COLAPSO POR SOBRECARGA: Eleva la masa a 100% obligatoriamente.";
                } else {
                    missionDesc.innerText = "⚡ COLAPSO ANÁRQUICO: Colapsa el núcleo en cualquier extremo (0% o 100%).";
                }
            }
            if (state.currentAnomalyKey && ANOMALIES[state.currentAnomalyKey]) {
                anomalyBox.innerText = ANOMALIES[state.currentAnomalyKey].name;
            }
        }
    }

    let valElem = document.getElementById('stability-value');
    if (valElem) valElem.innerText = Math.round(state.stability) + "%";

    let fillElem = document.getElementById('stability-fill');
    if (fillElem) fillElem.style.width = state.stability + "%";
    
    let timeVal = document.getElementById('time-value');
    if (timeVal) timeVal.innerText = state.timeLeft.toFixed(1) + "s";

    let timeFill = document.getElementById('time-fill');
    if (timeFill) {
        let timePercent = (state.timeLeft / state.maxTime) * 100;
        timeFill.style.width = timePercent + "%";
    }

    let critMsg = document.getElementById('critical-msg');
    if (critMsg) critMsg.style.display = state.stability >= 99.9 ? 'block' : 'none';

    // Evaluación dinámica del efecto de agitación (Screen Shake)
    if (state.timeLeft <= 1.5 && state.timeLeft > 0) {
        applyScreenShake('critical');
    } else if (state.stability < 15 || state.stability > 85) {
        applyScreenShake('warning');
    } else {
        applyScreenShake('none');
    }
}

// ==========================================
// 7. BUCLE PRINCIPAL (Game Tick)
// ==========================================
function startGame() {
    clearTimers();
    updateTheme();
    setupMission();

    state.ventReady = true;
    let btnVent = document.getElementById('btn-vent');
    if (btnVent) btnVent.disabled = false;
    
    let ventCooldownElem = document.getElementById('vent-cooldown');
    if (ventCooldownElem) ventCooldownElem.innerText = "Sistema listo";

    switchScreen('game-screen');
    renderUI();
    
    gameInterval = setInterval(gameTick, CONFIG.tickRateMs);
}

function gameTick() {
    let delta = CONFIG.tickRateMs / 1000;
    state.timeLeft = Math.max(0, state.timeLeft - delta);
    let difficultyScale = 1 + (state.currentTier - 1) * 0.5;

    if (state.isBossCycle) {
        state.stability = ANOMALIES.TORMENTA.apply(state.stability, difficultyScale, delta);

        if (state.timeLeft <= state.nextShiftTime && state.timeLeft > 0) {
            randomizeBossTarget();
            state.nextShiftTime -= CONFIG.bossShiftInterval;
        }

        if (state.timeLeft <= state.nextPulseTime + 1.0 && state.timeLeft > state.nextPulseTime) {
            state.pulseWarning = true;
        } else {
            state.pulseWarning = false;
        }

        if (state.timeLeft <= state.nextPulseTime && state.timeLeft > 0) {
            let direction = Math.random() > 0.5 ? 1 : -1;
            state.stability += (CONFIG.bossPulseAmount * direction);
            applyScreenShake('impact');
            state.nextPulseTime -= CONFIG.bossPulseInterval;
            state.pulseWarning = false;
        }
    } else {
        if (state.currentAnomalyKey && ANOMALIES[state.currentAnomalyKey]) {
            let anomaly = ANOMALIES[state.currentAnomalyKey];
            state.stability = anomaly.apply(state.stability, difficultyScale, delta * 10);
        }
    }

    state.stability = Math.max(0, Math.min(100, state.stability));

    if (checkBoundariesAndConditions()) return;

    if (state.stability >= 99.9) {
        state.stability -= CONFIG.hyperDrainRate * difficultyScale;
    }

    if (state.timeLeft <= 0) {
        if (state.isBossCycle) {
            if (state.stability >= state.bossTargetMin && state.stability <= state.bossTargetMax) {
                endGame(true);
            } else {
                endGame(false, `Tiempo expiró fuera de la zona del Jefe (${Math.round(state.stability)}% vs ${state.bossTargetMin}%-${state.bossTargetMax}%).`);
            }
        } else if (state.missionType === 'sustain') {
            if (state.stability >= CONFIG.sustainMin && state.stability <= CONFIG.sustainMax) {
                endGame(true);
            } else {
                endGame(false, "El tiempo expiró fuera del rango seguro.");
            }
        } else {
            endGame(false, "No lograste colapsar el núcleo a tiempo.");
        }
        return;
    }

    renderUI();
}

// ==========================================
// 8. ACCIONES DE JUGADOR Y COMBOS TÁCTICOS
// ==========================================
function completeVentCooldown() {
    state.ventReady = true;
    let btn = document.getElementById('btn-vent');
    let ventLabel = document.getElementById('vent-cooldown');
    if (btn) btn.disabled = false;
    if (ventLabel) ventLabel.innerText = "Sistema listo";
}

function adjustStability(amount, actionType = null) {
    let now = Date.now();
    let currentType = actionType || (amount > 0 ? 'inject' : 'extract');

    // 1. Evaluación de Frenesí (4+ clics en < 1s)
    state.clickHistory.push(now);
    state.clickHistory = state.clickHistory.filter(t => now - t <= 1000);

    let controlBtns = document.querySelectorAll('.controls-container button, .action-btn');
    if (state.clickHistory.length >= 4) {
        controlBtns.forEach(btn => btn.classList.add('btn-frenzy'));
        if (frenzyTimeout) clearTimeout(frenzyTimeout);
        frenzyTimeout = setTimeout(() => {
            controlBtns.forEach(btn => btn.classList.remove('btn-frenzy'));
        }, 600);
    }

    // 2. Evaluación de Combo por Alternancia (Inyectar <-> Extraer en < 500ms)
    if (state.lastActionType && currentType !== state.lastActionType && (now - state.lastActionTime <= CONFIG.comboWindowMs)) {
        // Reducir la recarga de Purga si está activa
        if (!state.ventReady && state.ventCooldownEndTime > now) {
            state.ventCooldownEndTime -= CONFIG.cooldownReductionMs;
            let remaining = Math.max(0, state.ventCooldownEndTime - now);

            clearTimeout(ventTimeout);
            if (remaining <= 0) {
                completeVentCooldown();
            } else {
                let ventLabel = document.getElementById('vent-cooldown');
                if (ventLabel) ventLabel.innerText = `Recargando (-0.5s Combo!)...`;
                ventTimeout = setTimeout(completeVentCooldown, remaining);
            }
        }
    }

    state.lastActionType = currentType;
    state.lastActionTime = now;

    // Aplicar cambio de masa fijo
    state.stability = Math.max(0, Math.min(100, state.stability + amount));
    if (checkBoundariesAndConditions()) return;
    renderUI();
}

function triggerVenting() {
    if (!state.ventReady) return;

    applyScreenShake('impact');
    adjustStability(-CONFIG.ventAmount, 'vent');
    state.ventReady = false;

    let btnVent = document.getElementById('btn-vent');
    if (btnVent) btnVent.disabled = true;
    
    let label = document.getElementById('vent-cooldown');
    if (label) label.innerText = "Recargando sistemas...";

    state.ventCooldownEndTime = Date.now() + CONFIG.ventCooldownMs;
    ventTimeout = setTimeout(completeVentCooldown, CONFIG.ventCooldownMs);
}

function endGame(success, reason = "") {
    clearTimers();
    applyScreenShake('none');

    let controlBtns = document.querySelectorAll('.controls-container button, .action-btn');
    controlBtns.forEach(btn => btn.classList.remove('btn-frenzy'));

    if (success) {
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
        setupGameOverUI(reason);
        switchScreen('gameover-screen');
    }
}

function setupGameOverUI(reason) {
    let reasonElem = document.getElementById('gameover-reason');
    if (reasonElem) reasonElem.innerText = reason;
    
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
        if (screen) screen.insertBefore(revertBtn, screen.children[2]);
    } else {
        state.streak = 0;
    }
}

function revertToAnchor() {
    state.streak = state.checkpoint;
    state.canRevert = false;
    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();
    startGame();
}

function nextCycle() {
    startGame();
}

function goToMenu() {
    clearTimers();
    applyScreenShake('none');
    state.streak = 0;
    state.canRevert = false;
    let menuElem = document.getElementById('menu-highscore');
    if (menuElem) menuElem.innerText = state.highScore;
    switchScreen('menu-screen');
    document.documentElement.style.setProperty('--bg-color', TIER_THEMES[0].bg);
    document.documentElement.style.setProperty('--accent-color', TIER_THEMES[0].accent);
}