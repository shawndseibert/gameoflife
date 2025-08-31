// Show/hide color controls logic
document.getElementById('toggleColorsBtn').onclick = function() {
    const colorControls = document.getElementById('colorControls');
    if (colorControls.style.display === '' || colorControls.style.display === 'none') {
        colorControls.style.display = 'flex';
    } else {
        colorControls.style.display = 'none';
    }
};
// Grid mode: 'toroidal' (wrap) or 'bounded' (edges dead)
let gridMode = 'toroidal';
// Game Of Life implementation
// Easily tweak variables and mechanics below!

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables (easy to experiment with)
let gridSize = 50;
let speed = 50;
let cellSize = 20;
let running = false;
let grid = [];
let fadeGrid = [];
let smoothing = 0;
let timer = null;

// Color customization
let liveColor = '#ffff00'; // Live Cell: 255,255,0
let deadColor = '#222222';
let fadeColor = '#800040'; // Fade: 128,0,64
let defaultLiveColor = '#ffff00'; // Live Cell: 255,255,0
let defaultFadeColor = '#800040'; // Fade: 128,0,64
let defaultDeadColor = '#222222';

// Set color pickers to default on load
window.addEventListener('DOMContentLoaded', () => {
    // Ensure color controls are hidden on initial load
    const colorControls = document.getElementById('colorControls');
    if (colorControls) colorControls.style.display = 'none';
    // Smoothing slider logic
    const smoothingSlider = document.getElementById('smoothing');
    const smoothingValue = document.getElementById('smoothingValue');
    if (smoothingSlider && smoothingValue) {
        smoothingSlider.value = smoothing;
        smoothingValue.textContent = smoothing;
        smoothingSlider.addEventListener('input', function() {
            smoothing = parseFloat(this.value);
            smoothingValue.textContent = smoothing.toFixed(2);
            drawGrid();
        });
    }
    const livePicker = document.getElementById('liveColor');
    const fadePicker = document.getElementById('fadeColor');
    const deadPicker = document.getElementById('deadColor');
    // Always set pickers and color variables to default on load
    if (livePicker) livePicker.value = defaultLiveColor;
    if (fadePicker) fadePicker.value = defaultFadeColor;
    if (deadPicker) deadPicker.value = defaultDeadColor;
    liveColor = defaultLiveColor;
    fadeColor = defaultFadeColor;
    deadColor = defaultDeadColor;
    document.documentElement.style.setProperty('--accent-live', defaultLiveColor);
    // Also update accent color for title and glow effects
    const h1 = document.querySelector('h1');
    if (h1) {
        h1.style.color = defaultLiveColor;
        h1.style.textShadow = `0 2px 8px ${defaultLiveColor}, 0 2px 8px #000a`;
    }

    // Mirror mode UI logic
    const mirrorMode = document.getElementById('mirrorMode');
    const mirrorDivisionsContainer = document.getElementById('mirrorDivisionsContainer');
    if (mirrorMode && mirrorDivisionsContainer) {
        mirrorMode.onchange = function() {
            if (mirrorMode.value === 'circular') {
                mirrorDivisionsContainer.style.display = 'flex';
            } else {
                mirrorDivisionsContainer.style.display = 'none';
            }
        };
    mirrorMode.value = 'none';
    mirrorDivisionsContainer.style.display = 'none';
    }
    // Info button popup logic
    const infoBtn = document.getElementById('infoBtn');
    const infoPopup = document.getElementById('infoPopup');
    const closeInfo = document.getElementById('closeInfo');
    if (infoBtn && infoPopup && closeInfo) {
        infoBtn.addEventListener('click', function() {
            infoPopup.classList.add('active');
        });
        closeInfo.addEventListener('click', function() {
            infoPopup.classList.remove('active');
        });
        infoPopup.addEventListener('click', function(e) {
            if (e.target === infoPopup) {
                infoPopup.classList.remove('active');
            }
        });
        document.addEventListener('keydown', function(e) {
            if (infoPopup.classList.contains('active') && (e.key === 'Escape' || e.key === 'Esc')) {
                infoPopup.classList.remove('active');
            }
        });
        // Touch accessibility: close on swipe down or tap outside
        let touchStartY = null;
        infoPopup.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                touchStartY = e.touches[0].clientY;
            }
        });
        infoPopup.addEventListener('touchend', function(e) {
            if (touchStartY !== null && e.changedTouches.length === 1) {
                const touchEndY = e.changedTouches[0].clientY;
                if (touchEndY - touchStartY > 80) {
                    infoPopup.classList.remove('active');
                }
                touchStartY = null;
            }
        });
    }
});

// Stamp variables
let currentStamp = 'none';

let mousePos = null; // Track mouse position for ghost

// Mechanics: Change rules here
const rules = {
    survive: [2, 3], // live cell survives with 2 or 3 neighbors
    born: [3]        // dead cell becomes alive with 3 neighbors
};

// Stamp patterns (relative coordinates)
const stamps = {
    glider: [
        [0,1],[1,2],[2,0],[2,1],[2,2]
    ],
    blinker: [
        [0,0],[0,1],[0,2]
    ],
    block: [
        [0,0],[0,1],[1,0],[1,1]
    ]
    ,
    toad: [
        [1,0],[1,1],[1,2],[0,1],[0,2],[0,3]
    ],
    beacon: [
        [0,0],[0,1],[1,0],[2,3],[3,2],[3,3]
    ],
    lwss: [
        [0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]
    ],
    pulsar: [
        [2,0],[2,1],[2,2],[2,6],[2,7],[2,8],
        [4,0],[4,1],[4,2],[4,6],[4,7],[4,8],
        [0,2],[1,2],[3,2],[5,2],[6,2],[8,2],
        [0,4],[1,4],[3,4],[5,4],[6,4],[8,4],
        [0,5],[1,5],[3,5],[5,5],[6,5],[8,5],
        [0,3],[1,3],[3,3],[5,3],[6,3],[8,3],
        [2,3],[2,4],[2,5],[2,8],[2,7],[2,6],
        [4,3],[4,4],[4,5],[4,8],[4,7],[4,6]
    ],
    pentadecathlon: [
        [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
        [2,0],[2,2],[9,0],[9,2]
    ],
    diehard: [
        [0,6],[1,0],[1,1],[2,1],[2,5],[2,6],[2,7]
    ],
    acorn: [
        [0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]
    ],
    rpentomino: [
        [0,1],[0,2],[1,0],[1,1],[2,1]
    ],
    ttetromino: [
        [0,1],[1,0],[1,1],[1,2]
    ],
    cross: [
        [1,0],[0,1],[1,1],[2,1],[1,2]
    ]
};

function setupGrid() {
    grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    fadeGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
}

function randomizeGrid() {
    grid = grid.map(row => row.map(() => Math.random() > 0.7 ? 1 : 0));
    fadeGrid = grid.map(row => row.map(cell => cell ? 0 : 0));
}

function hexToRgb(hex) {
    // Support both hex and rgb(...) formats
    if (hex.startsWith('rgb')) {
        // Extract numbers from rgb(...)
        const match = hex.match(/rgb\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
        }
        return [0, 0, 0];
    }
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function blendColors(rgbA, rgbB, t) {
    // t: 0 (rgbB) to 1 (rgbA)
    return [
        Math.round(rgbA[0] * t + rgbB[0] * (1 - t)),
        Math.round(rgbA[1] * t + rgbB[1] * (1 - t)),
        Math.round(rgbA[2] * t + rgbB[2] * (1 - t))
    ];
}

function drawGrid() {
    // Responsive canvas size
    let size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.7, 600);
    cellSize = Math.floor(size / gridSize);
    const pxSize = gridSize * cellSize;
    canvas.width = pxSize;
    canvas.height = pxSize;
    canvas.style.width = pxSize + 'px';
    canvas.style.height = pxSize + 'px';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const liveRGB = hexToRgb(liveColor);
    const fadeRGB = hexToRgb(fadeColor);
    const deadRGB = hexToRgb(deadColor);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            let rgb;
            if (grid[y][x]) {
                rgb = hexToRgb(liveColor);
            } else {
                // Fade effect for dead cells
                let fade = fadeGrid[y][x];
                if (fade > 0) {
                    let t = fade / fadeTime;
                    if (t > 0.5) {
                        rgb = blendColors(liveRGB, fadeRGB, (t - 0.5) * 2);
                    } else {
                        rgb = blendColors(fadeRGB, deadRGB, t * 2);
                    }
                } else {
                    rgb = hexToRgb(deadColor);
                }
            }
            // Smoothing: blend with neighbors
            if (typeof smoothing !== 'undefined' && smoothing > 0) {
                let neighbors = [];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        let nx = x + dx;
                        let ny = y + dy;
                        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                            if (grid[ny][nx]) {
                                neighbors.push(hexToRgb(liveColor));
                            } else {
                                let fade = fadeGrid[ny][nx];
                                if (fade > 0) {
                                    let t = fade / fadeTime;
                                    if (t > 0.5) {
                                        neighbors.push(blendColors(liveRGB, fadeRGB, (t - 0.5) * 2));
                                    } else {
                                        neighbors.push(blendColors(fadeRGB, deadRGB, t * 2));
                                    }
                                } else {
                                    neighbors.push(hexToRgb(deadColor));
                                }
                            }
                        }
                    }
                }
                if (neighbors.length > 0) {
                    let avg = [rgb[0], rgb[1], rgb[2]];
                    for (let n of neighbors) {
                        avg[0] += n[0] * smoothing;
                        avg[1] += n[1] * smoothing;
                        avg[2] += n[2] * smoothing;
                    }
                    avg[0] /= (1 + neighbors.length * smoothing);
                    avg[1] /= (1 + neighbors.length * smoothing);
                    avg[2] /= (1 + neighbors.length * smoothing);
                    rgb = avg;
                }
            }
            ctx.fillStyle = `rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])})`;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        }
    }

    // Draw ghost preview if applicable (does NOT modify grid or fadeGrid)
    if (currentStamp !== 'none' && stamps[currentStamp] && mousePos) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        const pattern = stamps[currentStamp];
        pattern.forEach(([dy, dx]) => {
            let ny = mousePos.y + dy;
            let nx = mousePos.x + dx;
            if (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) {
                // Only draw if cell is currently dead (so ghost doesn't cover live cells)
                if (!grid[ny][nx]) {
                    ctx.fillStyle = liveColor;
                    ctx.fillRect(nx * cellSize, ny * cellSize, cellSize - 1, cellSize - 1);
                }
            }
        });
        ctx.restore();
    }
}
// Color customization UI logic
document.getElementById('liveColor').oninput = function() {
    liveColor = this.value;
    drawGrid();
};
document.getElementById('deadColor').oninput = function() {
    deadColor = this.value;
    drawGrid();
};
document.getElementById('fadeColor').oninput = function() {
    fadeColor = this.value;
    drawGrid();
};

function getNeighbors(y, x) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            let ny = y + dy;
            let nx = x + dx;
            if (gridMode === 'toroidal') {
                ny = (ny + gridSize) % gridSize;
                nx = (nx + gridSize) % gridSize;
                count += grid[ny][nx];
            } else {
                // bounded: out-of-bounds neighbors are dead
                if (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) {
                    count += grid[ny][nx];
                }
            }
        }
    }
    return count;
}
// Grid mode toggle button logic
const gridModeToggle = document.getElementById('gridModeToggle');
function updateGridModeButton() {
    gridModeToggle.textContent = gridMode === 'toroidal' ? 'Toroidal' : 'Bounded';
}
gridModeToggle.onclick = function() {
    gridMode = gridMode === 'toroidal' ? 'bounded' : 'toroidal';
    updateGridModeButton();
};
updateGridModeButton();

function step() {
    let newGrid = grid.map(arr => arr.slice());
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            let neighbors = getNeighbors(y, x);
            if (grid[y][x]) {
                newGrid[y][x] = rules.survive.includes(neighbors) ? 1 : 0;
            } else {
                newGrid[y][x] = rules.born.includes(neighbors) ? 1 : 0;
            }
            // If cell just died, start fade
            if (grid[y][x] && !newGrid[y][x]) {
                fadeGrid[y][x] = fadeTime;
            }
            // Decrement fade only during game step
            if (!newGrid[y][x] && fadeGrid[y][x] > 0) {
                fadeGrid[y][x] = Math.max(0, fadeGrid[y][x] - 1);
            }
            // Reset fade for alive cells
            if (newGrid[y][x]) {
                fadeGrid[y][x] = 0;
            }
        }
    }
    grid = newGrid;
    drawGrid();
}

function startGame() {
    if (!running) {
        running = true;
        timer = setInterval(step, speed);
    }
}

function stopGame() {
    running = false;
    clearInterval(timer);
}

function clearGrid() {
    setupGrid();
    drawGrid();
}

// Controls

document.getElementById('startBtn').onclick = startGame;
document.getElementById('stopBtn').onclick = stopGame;
document.getElementById('clearBtn').onclick = () => { clearGrid(); };
document.getElementById('randomBtn').onclick = () => { randomizeGrid(); drawGrid(); };
document.getElementById('gridSize').oninput = function() {
    gridSize = parseInt(this.value);
    document.getElementById('gridSizeValue').textContent = gridSize;
    setupGrid();
    drawGrid();
};
document.getElementById('speed').oninput = function() {
    speed = parseInt(this.value);
    document.getElementById('speedValue').textContent = speed;
    // Reset colors to default on new game
    liveColor = defaultLiveColor;
    fadeColor = defaultFadeColor;
    deadColor = defaultDeadColor;
    const livePicker = document.getElementById('liveColor');
    const fadePicker = document.getElementById('fadeColor');
    const deadPicker = document.getElementById('deadColor');
    if (livePicker) livePicker.value = defaultLiveColor;
    if (fadePicker) fadePicker.value = defaultFadeColor;
    if (deadPicker) deadPicker.value = defaultDeadColor;
    document.documentElement.style.setProperty('--accent-live', defaultLiveColor);
    if (!running) {
        running = true;
        timer = setInterval(step, speed);
    }
};

// Click to toggle cell
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX / cellSize);
        const y = Math.floor((e.clientY - rect.top) * scaleY / cellSize);
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        if (stampSelect.value !== 'none') {
            placeStamp(x, y, stampSelect.value);
        } else {
            // Always set cell to live when stamp is none
            grid[y][x] = 1;
        }
        drawGrid();
    }
});

// Track mouse for ghost preview
// ...existing code...
// Menu toggle logic
document.getElementById('menuToggleBtn').onclick = function() {
    const mainControls = document.getElementById('mainControls');
    mainControls.style.display = (mainControls.style.display === 'none') ? 'block' : 'none';
};

// Touch support for mobile
canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.touches[0].clientX - rect.left) * scaleX / cellSize);
        const y = Math.floor((e.touches[0].clientY - rect.top) * scaleY / cellSize);
        mousePos = {x, y};
        // Simulate click for touch
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            if (currentStamp !== 'none' && stamps[currentStamp]) {
                stamps[currentStamp].forEach(([dy, dx]) => {
                    let ny = y + dy;
                    let nx = x + dx;
                    if (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) {
                        grid[ny][nx] = 1;
                    }
                });
            } else {
                grid[y][x] = grid[y][x] ? 0 : 1;
            }
            drawGrid();
        }
    }
});

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.touches[0].clientX - rect.left) * scaleX / cellSize);
        const y = Math.floor((e.touches[0].clientY - rect.top) * scaleY / cellSize);
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            mousePos = {x, y};
        } else {
            mousePos = null;
        }
        drawGrid();
    }
});

canvas.addEventListener('touchend', function() {
    mousePos = null;
    drawGrid();
});

canvas.addEventListener('mouseleave', function() {
    mousePos = null;
    drawGrid();
});

// Initial setup
setupGrid();
drawGrid();

// Set initial slider positions and value readouts
document.getElementById('gridSize').value = gridSize;
document.getElementById('gridSizeValue').textContent = gridSize;
document.getElementById('speed').value = speed;
document.getElementById('speedValue').textContent = speed;
let fadeTime = 1;
document.getElementById('fadeTime').value = fadeTime;
document.getElementById('fadeTimeValue').textContent = fadeTime;

// Set stamp menu to None on load
document.getElementById('stampSelect').value = 'none';
currentStamp = 'none';

// Redraw on window resize for responsiveness
window.addEventListener('resize', drawGrid);

// Fade Time slider event
document.getElementById('fadeTime').oninput = function() {
    fadeTime = parseInt(this.value);
    document.getElementById('fadeTimeValue').textContent = fadeTime;
};

// Stamp selector
document.getElementById('stampSelect').onchange = function() {
    currentStamp = this.value;
};

// Paint feature for mouse and touch
let painting = false;

canvas.addEventListener('mousedown', function(e) {
    painting = true;
        handlePaint(e);
});
canvas.addEventListener('mouseup', function() {
    painting = false;
});
canvas.addEventListener('mouseleave', function() {
    painting = false;
    mousePos = null;
    drawGrid();
});
canvas.addEventListener('mousemove', function(e) {
    if (painting) {
        handlePaint(e);
    }
    // Track mouse for ghost preview
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        mousePos = {x, y};
    } else {
        mousePos = null;
    }
    drawGrid();
});

function handlePaint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / cellSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / cellSize);
    const mirrorMode = document.getElementById('mirrorMode')?.value || 'none';
    const divisions = parseInt(document.getElementById('mirrorDivisions')?.value || '4');
    let coords = getMirroredCoords(x, y, mirrorMode, divisions);
    coords.forEach(([mx, my]) => {
        if (mx >= 0 && mx < gridSize && my >= 0 && my < gridSize) {
            if (currentStamp !== 'none' && stamps[currentStamp]) {
                stamps[currentStamp].forEach(([dy, dx]) => {
                    let ny = my + dy;
                    let nx = mx + dx;
                    if (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) {
                        grid[ny][nx] = 1;
                    }
                });
            } else {
                grid[my][mx] = 1;
            }
        }
    });
    drawGrid();
}

function getMirroredCoords(x, y, mode, divisions) {
    let coords = [[x, y]];
    const midX = Math.floor(gridSize / 2);
    const midY = Math.floor(gridSize / 2);
    switch (mode) {
        case 'vertical':
            coords.push([gridSize - 1 - x, y]);
            break;
        case 'horizontal':
            coords.push([x, gridSize - 1 - y]);
            break;
        case 'quadrants':
            coords.push([gridSize - 1 - x, y]);
            coords.push([x, gridSize - 1 - y]);
            coords.push([gridSize - 1 - x, gridSize - 1 - y]);
            break;
        case 'circular':
            // Mirror around center in N divisions
            let angle = Math.atan2(y - midY, x - midX);
            let r = Math.sqrt((x - midX) ** 2 + (y - midY) ** 2);
            for (let i = 1; i < divisions; i++) {
                let theta = angle + (2 * Math.PI * i) / divisions;
                let mx = Math.round(midX + r * Math.cos(theta));
                let my = Math.round(midY + r * Math.sin(theta));
                coords.push([mx, my]);
            }
            break;
    }
    // Remove duplicates and out-of-bounds
    return coords.filter(([mx, my], idx, arr) =>
        mx >= 0 && mx < gridSize && my >= 0 && my < gridSize &&
        arr.findIndex(([ax, ay]) => ax === mx && ay === my) === idx
    );
}

// Touch support for mobile paint
canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
        painting = true;
        handleTouchPaint(e);
    }
});
canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1 && painting) {
        handleTouchPaint(e);
    }
});
canvas.addEventListener('touchend', function() {
    painting = false;
    mousePos = null;
    drawGrid();
});
function handleTouchPaint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.touches[0].clientX - rect.left) * scaleX / cellSize);
    const y = Math.floor((e.touches[0].clientY - rect.top) * scaleY / cellSize);
    mousePos = (x >= 0 && x < gridSize && y >= 0 && y < gridSize) ? {x, y} : null;
    const mirrorMode = document.getElementById('mirrorMode')?.value || 'none';
    const divisions = parseInt(document.getElementById('mirrorDivisions')?.value || '4');
    let coords = getMirroredCoords(x, y, mirrorMode, divisions);
    coords.forEach(([mx, my]) => {
        if (mx >= 0 && mx < gridSize && my >= 0 && my < gridSize) {
            if (currentStamp !== 'none' && stamps[currentStamp]) {
                stamps[currentStamp].forEach(([dy, dx]) => {
                    let ny = my + dy;
                    let nx = mx + dx;
                    if (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) {
                        grid[ny][nx] = 1;
                    }
                });
            } else {
                grid[my][mx] = 1;
            }
        }
    });
    drawGrid();
}
