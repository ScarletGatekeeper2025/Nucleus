// ==========================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ==========================================
const CONFIG = {
    defaultTime: 10.0,
    bossTime: 20.0,
    bossShiftInterval: 5.0,
    bossPulseInterval: 4.0,
    bossPulseAmount: 20,
    tickRateMs: 100,
    injectAmount: 12,
    ventAmount: 25,
    ventCooldownMs: 4000,
    hyperDrainRate: 4.5,
    sustainMin: 20,
    sustainMax: 80,
    exitHoldMs: 3000,
    comboWindowMs: 500,
    cooldownReductionMs: 500
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
    collapseTarget: 'both',
    currentAnomalyKey: null,
    ventReady: true,
    ventCooldownEndTime: 0,
    currentTier: 1,
    isBossCycle: false,
    bossArchetype: 'TRADICIONAL',
    checkpoint: 0,
    canRevert: false,
    bossTargetMin: 30,
    bossTargetMax: 60,
    nextShiftTime: 0,
    nextPulseTime: 0,
    pulseWarning: false,
    // Estado dinámico de Arquetipos
    blindActive: false,
    gravityInverted: false,
    consecutiveClicks: 0,
    // Estado táctico y de combos
    clickHistory: [],
    lastActionType: null,
    lastActionTime: 0,
    // Telemetría Táctica (Post-Mortem)
    sessionStartTime: 0,
    totalClicks: 0,
    frenzyCount: 0,
    ventsUsed: 0,
    isPaused: false,
    isMuted: false
};

let gameInterval = null;
let ventTimeout = null;
let frenzyTimeout = null;

// ==========================================
// 3. INICIALIZACIÓN Y EVENTOS
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    let savedHighScore = localStorage.getItem('nucleus_highscore');
    if (savedHighScore) {
        state.highScore = parseInt(savedHighScore, 10);
        let menuElem = document.getElementById('menu-highscore');
        if (menuElem) menuElem.innerText = state.highScore;
    }
    setupHoldToExitButtons();

    // Conecta el botón de Game Over con 800ms de sostener
    let btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
        attachHoldBehavior(btnRestart, 800, "Reintentar Secuencia", () => {
            restartGame();
        });
    }

    // --- MODAL DE INSTRUCCIONES ---
    const modalHelp = document.getElementById('modal-instructions');
    const btnHelp = document.getElementById('btn-help');
    const btnCloseHelp = document.getElementById('btn-close-help');

    if (btnHelp && modalHelp && btnCloseHelp) {
        btnHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            modalHelp.classList.add('show');
        });

        btnCloseHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            modalHelp.classList.remove('show');
        });
    }
});


// Atajos de teclado globales (QoL)
window.addEventListener('keydown', (e) => {
    let gameActive = document.getElementById('game-screen')?.classList.contains('active');
    
    // Mute funciona en cualquier pantalla
    if (e.key.toLowerCase() === 'm') {
        toggleMute();
        return;
    }

    if (!gameActive) return;

    // Pausa / Reanudar
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        togglePause();
        return;
    }

    // Si está pausado, ignorar controles de acción
    if (state.isPaused) return;

    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        adjustStability(-CONFIG.injectAmount, 'extract');
    } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        adjustStability(CONFIG.injectAmount, 'inject');
    } else if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        triggerVenting();
    }
});

function triggerHaptic(type) {
    if (!('vibrate' in navigator)) return;
    if (type === 'impact') navigator.vibrate(40);
    if (type === 'critical') navigator.vibrate([20, 30, 20]);
}

function applyScreenShake(type) {
    triggerHaptic(type);

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
    state.blindActive = false;
    state.gravityInverted = false;
    state.consecutiveClicks = 0;
    
    let isBoss = (state.streak + 1) % 10 === 0 && state.streak > 0;
    
    if (isBoss) {
        state.isBossCycle = true;
        state.bossArchetype = selectBossArchetype(state.streak);
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
        state.bossArchetype = 'TRADICIONAL';
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
            // Cambiado aquí para usar tu frase
            endGame(false, "El tejido del tiempo se desgarró por completo.");
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
    let targetZone2 = document.getElementById('target-zone-2');
    let gameScreen = document.getElementById('game-screen');

    // Gestión de zonas seguras
    if (targetZone) {
        if (state.missionType === 'sustain' || state.isBossCycle) {
            targetZone.style.display = 'block';

            if (state.isBossCycle && state.bossArchetype === 'BIPOLAR') {
                targetZone.style.left = '15%';
                targetZone.style.width = '15%';

                if (targetZone2) {
                    targetZone2.style.display = 'block';
                    targetZone2.style.left = '70%';
                    targetZone2.style.width = '15%';
                }
            } else {
                let min = state.isBossCycle ? (state.bossTargetMin || 30) : CONFIG.sustainMin;
                let max = state.isBossCycle ? (state.bossTargetMax || 60) : CONFIG.sustainMax;
                
                targetZone.style.left = min + '%';
                targetZone.style.width = (max - min) + '%';
                if (targetZone2) targetZone2.style.display = 'none';
            }
        } else {
            targetZone.style.display = 'none';
            if (targetZone2) targetZone2.style.display = 'none';
        }
    }

    // Clases CSS según el arquetipo activo
    if (gameScreen) {
        if (state.isBossCycle && state.bossArchetype === 'CIEGO' && state.blindActive) {
            gameScreen.classList.add('blind-active');
        } else {
            gameScreen.classList.remove('blind-active');
        }

        if (state.isBossCycle && state.bossArchetype === 'GRAVITACIONAL' && state.gravityInverted) {
            gameScreen.classList.add('gravity-inverted');
        } else {
            gameScreen.classList.remove('gravity-inverted');
        }
    }

    if (missionDesc && anomalyBox) {
        if (state.isBossCycle) {
            let warningText = state.pulseWarning ? " ⚠️ ¡PULSO EN 1s!" : "";
            missionDesc.innerText = `⚠️ JEFE DE DÉCADA: Controla la estabilidad.${warningText}`;
            anomalyBox.innerText = getBossArchetypeName(state.bossArchetype);
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
    playUIClickSFX();
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

        if (state.bossArchetype === 'CIEGO') {
            let cycleTime = state.timeLeft % 4.0;
            state.blindActive = (cycleTime <= 1.8);
        } else if (state.bossArchetype === 'GRAVITACIONAL') {
            state.gravityInverted = state.pulseWarning || (state.timeLeft % 6.0 <= 2.5);
        }

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
            if (state.bossArchetype === 'BIPOLAR') {
                let inZone1 = (state.stability >= 15 && state.stability <= 30);
                let inZone2 = (state.stability >= 70 && state.stability <= 85);
                if (inZone1 || inZone2) {
                    endGame(true);
                } else {
                    endGame(false, `Tiempo expiró fuera de las zonas extremas (${Math.round(state.stability)}%).`);
                }
            } else {
                if (state.stability >= state.bossTargetMin && state.stability <= state.bossTargetMax) {
                    endGame(true);
                } else {
                    endGame(false, `Tiempo expiró fuera de la zona del Jefe (${Math.round(state.stability)}% vs ${state.bossTargetMin}%-${state.bossTargetMax}%).`);
                }
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
function resetTelemetry() {
    state.sessionStartTime = Date.now();
    state.totalClicks = 0;
    state.frenzyCount = 0;
    state.ventsUsed = 0;
}

function completeVentCooldown() {
    state.ventReady = true;
    let btn = document.getElementById('btn-vent');
    let ventLabel = document.getElementById('vent-cooldown');
    if (btn) btn.disabled = false;
    if (ventLabel) ventLabel.innerText = "Sistema listo";
}

function adjustStability(amount, actionType = null) {
    playClickSFX(amount > 0 ? 520 : 380); 
    
    let now = Date.now();
    let currentType = actionType || (amount > 0 ? 'inject' : 'extract');

    if (!state.sessionStartTime) state.sessionStartTime = now;

    if (actionType !== 'vent') {
        state.totalClicks++;
    }

    if (state.isBossCycle && state.bossArchetype === 'GRAVITACIONAL' && state.gravityInverted) {
        amount = -amount;
    }

    if (state.isBossCycle && state.bossArchetype === 'RESONANTE') {
        if (state.lastActionType === currentType) {
            state.consecutiveClicks++;
            if (state.consecutiveClicks >= 3) {
                let surge = (Math.random() > 0.5 ? 15 : -15);
                state.stability += surge;
                applyScreenShake('impact');
                state.consecutiveClicks = 0;
            }
        } else {
            state.consecutiveClicks = 0;
        }
    }

    state.clickHistory.push(now);
    state.clickHistory = state.clickHistory.filter(t => now - t <= 1000);

    let controlBtns = document.querySelectorAll('.controls-grid button');
    if (state.clickHistory.length >= 4) {
        if (controlBtns.length > 0 && !controlBtns[0].classList.contains('btn-frenzy')) {
            state.frenzyCount++;
        }

        controlBtns.forEach(btn => btn.classList.add('btn-frenzy'));
        if (frenzyTimeout) clearTimeout(frenzyTimeout);
        frenzyTimeout = setTimeout(() => {
            controlBtns.forEach(btn => btn.classList.remove('btn-frenzy'));
        }, 600);
    }

    if (state.lastActionType && currentType !== state.lastActionType && (now - state.lastActionTime <= CONFIG.comboWindowMs)) {
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

    state.stability = Math.max(0, Math.min(100, state.stability + amount));
    if (checkBoundariesAndConditions()) return;
    renderUI();
}

function triggerVenting() {
    if (!state.ventReady) return;
    playVentSFX();

    state.ventsUsed++;
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

function renderTelemetryBox(containerId) {
    let telemetryBox = document.getElementById(containerId);
    if (!telemetryBox) return;

    let survivalTime = state.sessionStartTime > 0 
        ? Math.max(1, Math.round((Date.now() - state.sessionStartTime) / 1000)) 
        : 0;

    telemetryBox.innerHTML = `
        <div class="telemetry-card">
            <span class="telemetry-label">Tiempo Acumulado</span>
            <span class="telemetry-value">${survivalTime}s</span>
        </div>
        <div class="telemetry-card">
            <span class="telemetry-label">Clics Totales</span>
            <span class="telemetry-value">${state.totalClicks}</span>
        </div>
        <div class="telemetry-card">
            <span class="telemetry-label">Ráfagas Frenesí</span>
            <span class="telemetry-value">${state.frenzyCount}</span>
        </div>
        <div class="telemetry-card">
            <span class="telemetry-label">Ventilaciones</span>
            <span class="telemetry-value">${state.ventsUsed}</span>
        </div>
    `;
}

function setupSuccessContinueButton() {
    let nextBtn = document.getElementById('btn-next-cycle');
    if (!nextBtn) return;

    // 1.2 segundos en ciclos de Jefe, 800ms en ciclos normales
    let holdTime = state.isBossCycle ? 1200 : 350;
    let label = state.isBossCycle ? "Mantén para Avanzar de Década" : "Continuar al Siguiente Ciclo";

    attachHoldBehavior(nextBtn, holdTime, label, () => {
        if (state.isBossCycle) playDecadeSFX();
        else playUIClickSFX();
        nextCycle();
    });
}

function attachHoldBehavior(btn, durationMs, labelText, onComplete) {
    let holdTimer = null;
    let animFrame = null;
    let startTime = 0;

    btn.onclick = null;

    function cancelHold() {
        if (holdTimer) clearTimeout(holdTimer);
        if (animFrame) cancelAnimationFrame(animFrame);
        holdTimer = null;
        animFrame = null;
        btn.style.background = '';
        btn.innerText = labelText;
    }

    function startHold(e) {
        if (e.type === 'touchstart') e.preventDefault();
        cancelHold();

        startTime = Date.now();

        function updateProgress() {
            let elapsed = Date.now() - startTime;
            let pct = Math.min(100, (elapsed / durationMs) * 100);
            let remaining = Math.max(0, (durationMs - elapsed) / 1000).toFixed(1);

            btn.style.background = `linear-gradient(to right, rgba(0, 240, 255, 0.4) ${pct}%, transparent ${pct}%)`;
            btn.innerText = `Mantén (${remaining}s)...`;

            if (elapsed < durationMs) {
                animFrame = requestAnimationFrame(updateProgress);
            }
        }

        animFrame = requestAnimationFrame(updateProgress);

        holdTimer = setTimeout(() => {
            cancelHold();
            onComplete();
        }, durationMs);
    }

    btn.onmousedown = startHold;
    btn.ontouchstart = startHold;
    btn.onmouseup = cancelHold;
    btn.onmouseleave = cancelHold;
    btn.ontouchend = cancelHold;
    btn.ontouchcancel = cancelHold;

    btn.innerText = labelText;
}

function resetToStandardButton(btn, text, onClickCallback) {
    btn.onmousedown = null;
    btn.ontouchstart = null;
    btn.onmouseup = null;
    btn.onmouseleave = null;
    btn.ontouchend = null;
    btn.ontouchcancel = null;
    btn.style.background = '';
    btn.innerText = text;
    btn.onclick = onClickCallback;
}

function endGame(success, reason = "") {
    clearTimers();
    applyScreenShake('none');

    let gameScreen = document.getElementById('game-screen');
    if (gameScreen) {
        gameScreen.classList.remove('blind-active', 'gravity-inverted');
    }

    let controlBtns = document.querySelectorAll('.controls-grid button');
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

        renderTelemetryBox('success-telemetry-box');
        setupSuccessContinueButton();
        switchScreen('success-screen');
    } else {
        setupGameOverUI(reason);
        switchScreen('gameover-screen');
    }
}

function setupGameOverUI(reason) {
    playResetSFX();
    let reasonElem = document.getElementById('gameover-reason');
    if (reasonElem) {
        reasonElem.innerText = reason || "El tejido del tiempo se desgarró por completo.";
    }

    renderTelemetryBox('telemetry-box');

    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();

    if (state.canRevert && state.checkpoint > 0) {
        let revertBtn = document.createElement('button');
        revertBtn.id = 'btn-revert';
        revertBtn.className = 'btn btn-hold';
        revertBtn.style.borderColor = 'var(--warning-color)';
        revertBtn.style.color = 'var(--warning-color)';
        
        // Integración de sostener durante 1 segundo (1000ms)
        attachHoldBehavior(revertBtn, 1000, `Reversión Temporal (Volver al Ciclo ${state.checkpoint})`, () => {
            revertToAnchor();
        });
        
        let screen = document.getElementById('gameover-screen');
        if (screen) screen.insertBefore(revertBtn, screen.children[2]);
    } else {
        state.streak = 0;
        resetTelemetry();
    }
}

function revertToAnchor() {
    playGoldSFX();
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
    playUIClickSFX();
    clearTimers();
    applyScreenShake('none');
    state.streak = 0;
    state.canRevert = false;
    resetTelemetry();
    let menuElem = document.getElementById('menu-highscore');
    if (menuElem) menuElem.innerText = state.highScore;
    switchScreen('menu-screen');
    document.documentElement.style.setProperty('--bg-color', TIER_THEMES[0].bg);
    document.documentElement.style.setProperty('--accent-color', TIER_THEMES[0].accent);
}

function restartGame() {
    playWarningSFX();
    state.streak = 0;
    state.checkpoint = 0;
    state.canRevert = false;
    resetTelemetry();

    // Elimina el botón de Reversión Temporal si existía
    let oldBtn = document.getElementById('btn-revert');
    if (oldBtn) oldBtn.remove();

    startGame();
}

function togglePause() {
    let gameActive = document.getElementById('game-screen')?.classList.contains('active');
    if (!gameActive) return;

    state.isPaused = !state.isPaused;
    let pauseOverlay = document.getElementById('pause-overlay');

    if (state.isPaused) {
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = null;
        if (pauseOverlay) pauseOverlay.style.display = 'flex';
    } else {
        if (pauseOverlay) pauseOverlay.style.display = 'none';
        gameInterval = setInterval(gameTick, CONFIG.tickRateMs);
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;
    let muteBtn = document.getElementById('btn-mute');
    if (muteBtn) muteBtn.innerText = state.isMuted ? '🔇' : '🔊';
}

// ==========================================
// 9. SISTEMA DE ARQUETIPOS DE JEFES (ROGUE-LIKE)
// ==========================================
const BOSS_ARCHETYPES = ['CIEGO', 'BIPOLAR', 'GRAVITACIONAL', 'RESONANTE'];

function selectBossArchetype(streak) {
    let bossNumber = Math.floor((streak + 1) / 10);

    // Primer Jefe (Ciclo 10): 100% Tradicional
    if (bossNumber <= 1) {
        return 'TRADICIONAL';
    }

    // Jefes posteriores (Ciclo 20, 30...):
    // 5% Tradicional y 95% repartido equitativamente (23.75% para cada arquetipo)
    let roll = Math.random();

    if (roll < 0.05) {
        return 'TRADICIONAL';
    }

    return BOSS_ARCHETYPES[Math.floor(Math.random() * BOSS_ARCHETYPES.length)];
}

function getBossArchetypeName(archetype) {
    switch (archetype) {
        case 'CIEGO': return '👁️ NÚCLEO CIEGO: Apagón visual periódico';
        case 'BIPOLAR': return '⚖️ NÚCLEO BIPOLAR: Doble zona segura extrema';
        case 'GRAVITACIONAL': return '🌌 NÚCLEO GRAVITACIONAL: Inversión de controles';
        case 'RESONANTE': return '⚡ NÚCLEO RESONANTE: Sobrecarga por clics repetidos';
        default: return '☣️ SINGULARIDAD DE DÉCADA: Zona Móvil + Pulsos';
    }
}

// ==========================================
// 10. SISTEMA DE AUDIO NATIVO (WEB AUDIO API)
// ==========================================
let audioCtx = null;

function getAudioContext() {
    if (state.isMuted) return null; // Bloquea el audio si está silenciado
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

const unlockAudio = () => {
    if (!state.isMuted) getAudioContext();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
};

window.addEventListener('click', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function playClickSFX(freq = 520, type = 'sine') {
    if (state.isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
}

function playVentSFX() {
    if (state.isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
}

function playWarningSFX() {
    if (state.isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(90, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
}

function playUIClickSFX() {
    playClickSFX(650, 'sine');
}

function playGoldSFX() {
    if (state.isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

function playDecadeSFX() {
    if (state.isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const notes = [440, 554.37, 659.25, 880];
        
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + (index * 0.06));

            gain.gain.setValueAtTime(0.1, ctx.currentTime + (index * 0.06));
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (index * 0.06) + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + (index * 0.06));
            osc.stop(ctx.currentTime + (index * 0.06) + 0.15);
        });
    } catch (e) {}
}

function playResetSFX() {
    if (state.isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
}

// Asegurar disponibilidad global
window.playUIClickSFX = playUIClickSFX;
window.playGoldSFX = playGoldSFX;
window.playDecadeSFX = playDecadeSFX;
window.playResetSFX = playResetSFX;
window.playClickSFX = playClickSFX;
window.playVentSFX = playVentSFX;
window.playWarningSFX = playWarningSFX;