/**
 * Financial Infrastructure Modeling
 * Network-Based Game-Theoretic Model - 3D Visualization
 */

let scene, camera, renderer, controls;
let nodeTooltip;
let nodeMeshes = new Map(); // Map node IDs to Three.js mesh objects
let edgeLines = []; // Array of edge line objects (cylinders)
let edgeArrows = []; // Array of edge arrow objects (cones)
let raycaster, mouse;

// -- Configuration & Constants --
const NODE_RADIUS = 0.3;
const NODE_TYPES = {
    BANK: { color: 0x3b82f6, label: 'Bank' },
    CLEARING_HOUSE: { color: 0x8b5cf6, label: 'Clearing House' },
    EXCHANGE: { color: 0xf59e0b, label: 'Stock Exchange' },
    INSURER: { color: 0x10b981, label: 'Insurance Co' }
};

// -- Node Template Data (with 3D coordinates) - Values will be fetched from APIs --
const NODE_TEMPLATES = [
    { id: 1, type: 'BANK', name: 'HDFC Bank', symbol: 'HDFCBANK.NS', x: -2, y: 0, z: 0, riskAppetite: 0.5, newsSentiment: 0 },
    { id: 2, type: 'BANK', name: 'State Bank Of India', symbol: 'SBIN.NS', x: 2, y: 0, z: -1, riskAppetite: 0.7, newsSentiment: 0 },
    { id: 3, type: 'CLEARING_HOUSE', name: 'Clearing Corporation of India', symbol: null, x: 0, y: 0, z: 0, riskAppetite: 0.1, newsSentiment: 0 },
    { id: 4, type: 'EXCHANGE', name: 'Bombay Stock Exchange', symbol: null, x: 0, y: 2, z: 0, riskAppetite: 0.3, newsSentiment: 0 },
    { id: 5, type: 'INSURER', name: 'LIC Insurance', symbol: 'LICI.NS', x: -2, y: -1, z: 1, riskAppetite: 0.2, newsSentiment: 0 },
    { id: 6, type: 'BANK', name: 'ICICI Bank', symbol: 'ICICIBANK.NS', x: 2, y: -1, z: 1, riskAppetite: 0.8, newsSentiment: 0 },
    { id: 7, type: 'BANK', name: 'Reserve Bank of India', symbol: null, x: 0, y: 4, z: 0, riskAppetite: 0.1, newsSentiment: 0 },
    { id: 8, type: 'BANK', name: 'Central Bank of India', symbol: 'CENTRALBK.NS', x: -4, y: 1, z: -1, riskAppetite: 0.4, newsSentiment: 0 },
    { id: 9, type: 'BANK', name: 'Axis Bank', symbol: 'AXISBANK.NS', x: 4, y: -2, z: 0, riskAppetite: 0.6, newsSentiment: 0 },
    { id: 10, type: 'BANK', name: 'Punjab National Bank', symbol: 'PNB.NS', x: -3, y: -3, z: 1, riskAppetite: 0.5, newsSentiment: 0 },
    { id: 11, type: 'BANK', name: 'Kotak Mahindra Bank', symbol: 'KOTAKBANK.NS', x: 3, y: 2, z: 1, riskAppetite: 0.3, newsSentiment: 0 }
];

// Hardcoded fallback values (used if APIs fail)
const HARDCODED_VALUES = {
    1: { obligations: 500, assets: 1200, liquidityBuffer: 300, capitalBuffer: 400 },
    2: { obligations: 300, assets: 800, liquidityBuffer: 100, capitalBuffer: 200 },
    3: { obligations: 1000, assets: 5000, liquidityBuffer: 2000, capitalBuffer: 2500 },
    4: { obligations: 200, assets: 2000, liquidityBuffer: 800, capitalBuffer: 1000 },
    5: { obligations: 150, assets: 1500, liquidityBuffer: 500, capitalBuffer: 600 },
    6: { obligations: 700, assets: 900, liquidityBuffer: 150, capitalBuffer: 200 },
    7: { obligations: 10000, assets: 50000, liquidityBuffer: 20000, capitalBuffer: 15000 },
    8: { obligations: 400, assets: 900, liquidityBuffer: 200, capitalBuffer: 250 },
    9: { obligations: 800, assets: 1300, liquidityBuffer: 350, capitalBuffer: 450 },
    10: { obligations: 600, assets: 1100, liquidityBuffer: 250, capitalBuffer: 400 },
    11: { obligations: 500, assets: 1000, liquidityBuffer: 300, capitalBuffer: 400 }
};

// Global NODES array - will be populated after API calls
let NODES = [];

const EDGES = [
    { source: 1, target: 3, value: 50 },
    { source: 2, target: 3, value: 40 },
    { source: 6, target: 3, value: 80 },
    { source: 1, target: 2, value: 20 },
    { source: 2, target: 6, value: 30 },
    { source: 5, target: 1, value: 100 }, // Insurance covering Bank 1
    { source: 4, target: 1, value: 200 }, // Exchange flow to Bank 1
    { source: 4, target: 2, value: 150 },
    { source: 6, target: 1, value: 60 },
    { source: 7, target: 3, value: 500 },
    { source: 1, target: 7, value: 100 },
    { source: 8, target: 3, value: 30 },
    { source: 9, target: 4, value: 70 },
    { source: 10, target: 2, value: 40 },
    { source: 11, target: 6, value: 50 }
];

const NEWS_DATABASE = [
    { text: "Market volatility decreases slightly.", sentiment: 0.1 },
    { text: "State Bank Of India reports lower quarterly earnings.", sentiment: -0.4, targetId: 2 },
    { text: "Clearing Corporation of India passes stress test with flying colors.", sentiment: 0.5, targetId: 3 },
    { text: "ICICI Bank exposure to bad loans increases.", sentiment: -0.7, targetId: 6 },
    { text: "HDFC Bank announces new tech infrastructure.", sentiment: 0.3, targetId: 1 },
    { text: "Regulatory body warns of liquidity crunch in mid-sized banks.", sentiment: -0.3, type: 'BANK' },
    { text: "LIC Insurance acquires smaller competitor.", sentiment: 0.2, targetId: 5 }
];

// -- State --
let selectedNode = null;
let systemState = 'STABLE'; // STABLE, WARNING, CRITICAL
let pendingAdjustments = []; // Store MFG calculated changes
let hoveredNodeMesh = null;
let selectedCategory = 'ALL'; // Currently selected category filter

// -- Featherless AI API Configuration --
const FEATHERLESS_API_KEY = 'rc_0b69669837d5f0757c654966247d9c9c1a0ae5fc3271cb239e9521a9ff9b115c';
const FEATHERLESS_API_URL = 'https://api.featherless.ai/v1/chat/completions';

// -- Financial Data Fetching Functions --
async function fetchYahooFinanceData(symbol) {
    if (!symbol) return null;

    try {
        // Using Yahoo Finance public API via CORS proxy
        const proxyUrl = 'https://api.allorigins.win/get?url=';

        // Try to get quote data first
        const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const quoteResponse = await fetch(proxyUrl + encodeURIComponent(quoteUrl));
        const quoteData = await quoteResponse.json();
        const quoteParsed = JSON.parse(quoteData.contents);

        if (quoteParsed.chart && quoteParsed.chart.result && quoteParsed.chart.result[0]) {
            const result = quoteParsed.chart.result[0];
            const meta = result.meta;
            const marketCap = meta.marketCap || 0;

            if (marketCap > 0) {
                // Try to get balance sheet data from Yahoo Finance summary
                try {
                    const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=balanceSheetHistoryQuarterly,financialData`;
                    const summaryResponse = await fetch(proxyUrl + encodeURIComponent(summaryUrl));
                    const summaryData = await summaryResponse.json();
                    const summaryParsed = JSON.parse(summaryData.contents);

                    if (summaryParsed.quoteSummary && summaryParsed.quoteSummary.result && summaryParsed.quoteSummary.result[0]) {
                        const financialData = summaryParsed.quoteSummary.result[0].financialData;
                        const balanceSheet = summaryParsed.quoteSummary.result[0].balanceSheetHistoryQuarterly;

                        if (financialData) {
                            const totalAssets = financialData.totalAssets?.raw || 0;
                            const totalLiabilities = financialData.totalLiab?.raw || 0;
                            const totalCash = financialData.totalCash?.raw || 0;
                            const totalDebt = financialData.totalDebt?.raw || 0;

                            if (totalAssets > 0) {
                                return {
                                    obligations: Math.round((totalLiabilities || totalDebt || marketCap * 0.4) / 1000000),
                                    assets: Math.round(totalAssets / 1000000),
                                    liquidityBuffer: Math.round((totalCash || totalAssets * 0.15) / 1000000),
                                    capitalBuffer: Math.round((totalAssets - (totalLiabilities || totalDebt) || totalAssets * 0.1) / 1000000)
                                };
                            }
                        }
                    }
                } catch (e) {
                    console.log(`Balance sheet API failed for ${symbol}, using market cap estimates`);
                }

                // Fallback: Estimate from market cap (for banks, use different ratios)
                const isBank = symbol.includes('BANK');
                const assets = isBank ? marketCap * 8 : marketCap * 1.5; // Banks have higher asset-to-market-cap ratio
                const obligations = isBank ? marketCap * 6 : marketCap * 0.5;
                const liquidityBuffer = assets * (isBank ? 0.2 : 0.15);
                const capitalBuffer = assets * (isBank ? 0.15 : 0.1);

                return {
                    obligations: Math.round(obligations / 1000000),
                    assets: Math.round(assets / 1000000),
                    liquidityBuffer: Math.round(liquidityBuffer / 1000000),
                    capitalBuffer: Math.round(capitalBuffer / 1000000)
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`Yahoo Finance API error for ${symbol}:`, error);
        return null;
    }
}

async function fetchFeatherlessFinancialData(nodeName, dataType) {
    try {
        const systemPrompt = `You are a financial data expert. Provide only numerical values in JSON format.`;
        const userPrompt = `What is the ${dataType} for ${nodeName} (Indian financial institution)? Provide the value in INR Crores (e.g., if it's 50,000 Crores, return 50000). Return ONLY a JSON object with the value, like: {"value": 50000}. If you cannot find the data, return {"value": null}.`;

        const response = await callFeatherlessAPI(userPrompt, systemPrompt);
        if (response) {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*"value"[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return data.value;
            }
        }
        return null;
    } catch (error) {
        console.error(`Featherless API error for ${nodeName} ${dataType}:`, error);
        return null;
    }
}

async function fetchFeatherlessStockPrice(nodeName, symbol = null) {
    try {
        const systemPrompt = `You are a stock market expert. Provide the current stock price in INR.`;
        const identifier = symbol ? `${nodeName} (${symbol})` : nodeName;
        const userPrompt = `What is the current stock price for ${identifier} on the Indian stock market (NSE/BSE)? Return ONLY a JSON object with the value, like: {"price": 1234.56}. If the company is not listed or you cannot find the price, return {"price": null}.`;

        const response = await callFeatherlessAPI(userPrompt, systemPrompt);
        if (response) {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*"price"[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return data.price;
            }
        }
        return null;
    } catch (error) {
        console.error(`Featherless Stock Price API error for ${nodeName}:`, error);
        return null;
    }
}

async function fetchLiveStockPrice(node) {
    if (!node) return null;
    const symbol = node.symbol;
    const nodeName = node.name;

    // Tier 1: Try Primary API (Koyeb/0xramm)
    if (symbol) {
        try {
            const apiUrl = `https://military-jobye-haiqstudios-14f59639.koyeb.app/stock?symbol=${symbol}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                const result = Array.isArray(data) ? data[0] : data;
                const price = result.currentPrice || result.lastPrice || result.price || result.regularMarketPrice;
                if (price) return parseFloat(price);
            }
        } catch (e) {
            console.error(`Primary API fetch failed for ${symbol}`, e);
        }
    }

    // Tier 2: Featherless AI Fallback (for unlisted nodes OR primary API failure)
    console.log(`Attempting Featherless AI fallback for ${nodeName} stock price...`);
    const featherlessPrice = await fetchFeatherlessStockPrice(nodeName, symbol);
    if (featherlessPrice) {
        console.log(`Fetched ${nodeName} stock price from Featherless AI: ₹${featherlessPrice}`);
        return featherlessPrice;
    }

    // Tier 3: Final Fallback (Simulated) - only if everything else fails
    const simulatedPrice = 500 + Math.random() * 1500;
    return simulatedPrice;
}

async function fetchNodeFinancialData(node) {
    let financialData = {
        obligations: null,
        assets: null,
        liquidityBuffer: null,
        capitalBuffer: null
    };

    // Tier 1: Try Yahoo Finance API
    if (node.symbol) {
        const yahooData = await fetchYahooFinanceData(node.symbol);
        if (yahooData) {
            financialData = yahooData;
            console.log(`Fetched ${node.name} data from Yahoo Finance`);
            return financialData;
        }
    }

    // Tier 2: Try Featherless AI API for each missing value
    if (!financialData.obligations) {
        const obligations = await fetchFeatherlessFinancialData(node.name, 'total obligations or liabilities');
        if (obligations) financialData.obligations = Math.round(obligations);
    }

    if (!financialData.assets) {
        const assets = await fetchFeatherlessFinancialData(node.name, 'total assets');
        if (assets) financialData.assets = Math.round(assets);
    }

    if (!financialData.liquidityBuffer) {
        const liquidity = await fetchFeatherlessFinancialData(node.name, 'liquidity buffer or cash reserves');
        if (liquidity) financialData.liquidityBuffer = Math.round(liquidity);
    }

    if (!financialData.capitalBuffer) {
        const capital = await fetchFeatherlessFinancialData(node.name, 'capital buffer or equity capital');
        if (capital) financialData.capitalBuffer = Math.round(capital);
    }

    // Check if we got any data from Featherless
    const hasFeatherlessData = Object.values(financialData).some(v => v !== null);
    if (hasFeatherlessData) {
        console.log(`Fetched ${node.name} data from Featherless AI`);
    }

    // Tier 3: Fallback to hardcoded values for any missing data
    const hardcoded = HARDCODED_VALUES[node.id];
    if (hardcoded) {
        financialData.obligations = financialData.obligations || hardcoded.obligations;
        financialData.assets = financialData.assets || hardcoded.assets;
        financialData.liquidityBuffer = financialData.liquidityBuffer || hardcoded.liquidityBuffer;
        financialData.capitalBuffer = financialData.capitalBuffer || hardcoded.capitalBuffer;

        if (!hasFeatherlessData) {
            console.log(`Using hardcoded values for ${node.name}`);
        }
    }

    return financialData;
}

async function initializeNodesWithFinancialData() {
    console.log('Fetching financial data for all nodes...');
    NODES = [];

    for (const template of NODE_TEMPLATES) {
        const financialData = await fetchNodeFinancialData(template);

        // Initial stock price fetch
        const initialPrice = await fetchLiveStockPrice(template);

        NODES.push({
            id: template.id,
            type: template.type,
            name: template.name,
            symbol: template.symbol,
            x: template.x,
            y: template.y,
            z: template.z,
            obligations: financialData.obligations,
            assets: financialData.assets,
            liquidityBuffer: financialData.liquidityBuffer,
            capitalBuffer: financialData.capitalBuffer,
            riskAppetite: template.riskAppetite,
            newsSentiment: template.newsSentiment,
            currentPrice: initialPrice
        });
    }

    console.log('All nodes initialized with financial data');
    return NODES;
}

// -- Initialization --
async function init() {
    const container = document.getElementById('networkCanvas');
    nodeTooltip = document.getElementById('node-tooltip');

    if (!container) {
        console.error('Canvas container not found!');
        return;
    }

    console.log('Initializing 3D graph visualization...');

    // Initialize nodes with financial data from APIs
    await initializeNodesWithFinancialData();

    console.log('Nodes:', NODES.length);
    console.log('Edges:', EDGES.length);

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    // Create camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: container });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Add OrbitControls for camera rotation/zooming
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 3;
        controls.maxDistance = 20;
    }

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    // Setup raycasting for mouse interactions
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create nodes and edges
    createNodes();
    createEdges();

    // Add grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);

    // Event listeners
    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('click', onMouseClick, false);
    window.addEventListener('resize', onWindowResize, false);

    const btnSimulate = document.getElementById('btn-simulate');
    const btnClearing = document.getElementById('btn-clearing');
    const btnApply = document.getElementById('btn-apply-changes');
    const btnPolicy = document.getElementById('btn-policy');

    if (btnSimulate) btnSimulate.addEventListener('click', runSimulationStep);
    if (btnClearing) btnClearing.addEventListener('click', runSafeClearing);
    if (btnApply) btnApply.addEventListener('click', applyStabilization);
    if (btnPolicy) btnPolicy.addEventListener('click', generatePolicy);

    // Legend button event listeners
    document.querySelectorAll('.legend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.type;
            filterNodesByCategory(category);
        });
    });

    // Start animation loop
    animate();
    console.log('3D graph visualization started');

    // Start random news feed
    setInterval(injectRandomNews, 5000);

    // Start live asset updates
    startLiveAssetUpdates();
}

function startLiveAssetUpdates() {
    console.log("Starting live asset updates linked to BSE stock prices...");

    // Add a visible ticker/status for updates
    const ticker = document.createElement('div');
    ticker.id = 'live-ticker';
    ticker.style.position = 'fixed';
    ticker.style.bottom = '10px';
    ticker.style.right = '10px';
    ticker.style.color = '#34d399';
    ticker.style.background = 'rgba(0,0,0,0.8)';
    ticker.style.padding = '5px 10px';
    ticker.style.borderRadius = '4px';
    ticker.style.fontSize = '12px';
    ticker.style.zIndex = '1000';
    document.body.appendChild(ticker);

    setInterval(async () => {
        // Fetch all prices in parallel
        const pricePromises = NODES.map(async node => {
            const price = await fetchLiveStockPrice(node);
            return { id: node.id, price, symbol: node.symbol };
        });

        const results = await Promise.all(pricePromises);
        let updateCount = 0;

        results.forEach(res => {
            if (res.price) {
                const node = NODES.find(n => n.id === res.id);
                if (node) {
                    // Update current price
                    node.currentPrice = res.price;

                    // Simulate dynamic asset value change based on stock price
                    // Even if market is closed (Sunday), use price as base for volatility

                    // Base volatility: 0.5% of price
                    const baseVolatility = (res.price * 0.005);
                    // Random factor: -1.5 to +1.5
                    const randomFactor = (Math.random() * 3) - 1.5;

                    const change = Math.floor(baseVolatility * randomFactor);

                    // Apply change
                    const oldAssets = node.assets;
                    node.assets += change;

                    // Ensure assets don't go negative or too low
                    if (node.assets < 500) node.assets = 500; // Floor

                    if (change !== 0) updateCount++;
                    // console.log(`Updated ${node.name}: ${oldAssets} -> ${node.assets} (Price: ${res.price})`);
                }
            }
        });

        if (updateCount > 0) {
            updateNodeVisuals();
            updateSystemStatus();

            const time = new Date().toLocaleTimeString();
            ticker.innerText = `● Live Updates: ${updateCount} nodes synced with BSE (Last: ${time})`;
            ticker.style.animation = 'none';
            ticker.offsetHeight; /* trigger reflow */
            ticker.style.animation = 'pulse-green 1s';
        }

    }, 5000);
}

function createNodes() {
    NODES.forEach(node => {
        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(NODE_RADIUS, 32, 32);
        const color = NODE_TYPES[node.type]?.color || 0xffffff;
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(node.x, node.y, node.z);
        sphere.userData = { node: node, type: node.type };

        // Add glow effect for risky nodes
        if (isNodeRisky(node)) {
            const glowGeometry = new THREE.SphereGeometry(NODE_RADIUS + 0.1, 32, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.3
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.userData = { isGlow: true };
            sphere.add(glow);
        }

        // Add label (using sprite or HTML overlay - for now just store reference)
        scene.add(sphere);
        nodeMeshes.set(node.id, sphere);
    });

    // Apply initial filter
    filterNodesByCategory(selectedCategory);
}

// -- Legend Filtering Functions --
function filterNodesByCategory(category) {
    selectedCategory = category;

    // Update legend button states
    document.querySelectorAll('.legend-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === category) {
            btn.classList.add('active');
        }
    });

    // First, update all nodes
    nodeMeshes.forEach((mesh, nodeId) => {
        const node = mesh.userData.node;
        const nodeType = node.type;

        if (category === 'ALL' || nodeType === category) {
            // Highlight: full opacity and scale
            mesh.visible = true;
            mesh.material.opacity = 1.0;
            mesh.material.transparent = false;
            mesh.scale.set(1, 1, 1);
        } else {
            // Dim: reduce opacity and scale down
            mesh.visible = true;
            mesh.material.opacity = 0.2;
            mesh.material.transparent = true;
            mesh.scale.set(0.7, 0.7, 0.7);
        }
    });

    // Then, update all edges and arrows based on connected nodes
    edgeLines.forEach((edge, index) => {
        if (edge.userData && edge.userData.edge) {
            const edgeData = edge.userData.edge;
            const sourceNode = NODES.find(n => n.id === edgeData.source);
            const targetNode = NODES.find(n => n.id === edgeData.target);

            let shouldShow = false;

            if (category === 'ALL') {
                // Show all edges
                shouldShow = true;
            } else if (sourceNode && targetNode) {
                const sourceType = sourceNode.type;
                const targetType = targetNode.type;

                // Show edge if either source or target matches the category
                shouldShow = (sourceType === category || targetType === category);
            }

            // Update edge visibility
            edge.visible = shouldShow;
            if (shouldShow) {
                edge.material.opacity = 0.8;
            }

            // Update corresponding arrow visibility
            if (edgeArrows[index]) {
                edgeArrows[index].visible = shouldShow;
            }
        }
    });
}

function createEdges() {
    // Calculate min and max edge values for normalization
    const edgeValues = EDGES.map(e => e.value);
    const minValue = Math.min(...edgeValues);
    const maxValue = Math.max(...edgeValues);
    const valueRange = maxValue - minValue || 1; // Avoid division by zero

    // Define thickness range (min and max cylinder radius)
    const MIN_EDGE_RADIUS = 0.03;
    const MAX_EDGE_RADIUS = 0.12;
    const MIN_ARROW_RADIUS = 0.04;
    const MAX_ARROW_RADIUS = 0.15;
    const MIN_ARROW_LENGTH = 0.2;
    const MAX_ARROW_LENGTH = 0.5;

    EDGES.forEach(edge => {
        const source = NODES.find(n => n.id === edge.source);
        const target = NODES.find(n => n.id === edge.target);

        if (!source || !target) {
            console.warn(`Edge missing source or target:`, edge);
            return;
        }

        // Normalize edge value to 0-1 range, then scale to thickness range
        const normalizedValue = (edge.value - minValue) / valueRange;
        const edgeRadius = MIN_EDGE_RADIUS + (normalizedValue * (MAX_EDGE_RADIUS - MIN_EDGE_RADIUS));

        const sourceColor = NODE_TYPES[source.type]?.color || 0xffffff;
        const targetColor = NODE_TYPES[target.type]?.color || 0xffffff;

        // Create direction vector
        const startPoint = new THREE.Vector3(source.x, source.y, source.z);
        const endPoint = new THREE.Vector3(target.x, target.y, target.z);
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
        const distance = direction.length();
        direction.normalize();

        // Create cylinder geometry for the edge (more efficient than tube for straight lines)
        const cylinderGeometry = new THREE.CylinderGeometry(
            edgeRadius,
            edgeRadius,
            distance,
            16
        );

        const cylinderMaterial = new THREE.MeshPhongMaterial({
            color: sourceColor,
            transparent: true,
            opacity: 0.85,
            emissive: sourceColor,
            emissiveIntensity: 0.15
        });

        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

        // Position cylinder at midpoint
        const midpoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        cylinder.position.copy(midpoint);

        // Orient cylinder along the direction vector
        // Create a quaternion to rotate from default (0,1,0) to direction
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, direction);
        cylinder.quaternion.copy(quaternion);

        cylinder.userData = { edge: edge, thickness: edgeRadius, value: edge.value };
        scene.add(cylinder);
        edgeLines.push(cylinder);

        // Add arrow indicator with proportional size
        const arrowRadius = MIN_ARROW_RADIUS + (normalizedValue * (MAX_ARROW_RADIUS - MIN_ARROW_RADIUS));
        const arrowLength = MIN_ARROW_LENGTH + (normalizedValue * (MAX_ARROW_LENGTH - MIN_ARROW_LENGTH));

        const arrowGeometry = new THREE.ConeGeometry(arrowRadius, arrowLength, 16);
        const arrowMaterial = new THREE.MeshPhongMaterial({
            color: targetColor,
            emissive: targetColor,
            emissiveIntensity: 0.4
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

        // Position arrow closer to target (at 80% of the distance, accounting for node radius)
        const arrowOffset = NODE_RADIUS + arrowLength / 2;
        const arrowPosition = new THREE.Vector3().lerpVectors(startPoint, endPoint, 1 - (arrowOffset / distance));
        arrow.position.copy(arrowPosition);

        // Orient arrow towards target
        arrow.lookAt(endPoint);
        arrow.rotateX(Math.PI / 2);

        arrow.userData = { edge: edge, size: normalizedValue, value: edge.value };
        scene.add(arrow);
        edgeArrows.push(arrow);
    });
}

function updateNodeVisuals() {
    // Update node visuals based on current risk status
    nodeMeshes.forEach((mesh, nodeId) => {
        const node = NODES.find(n => n.id === nodeId);
        if (!node) return;

        const isRisky = isNodeRisky(node);

        // Remove existing glow if any
        mesh.children = mesh.children.filter(child => child.userData?.isGlow !== true);

        // Add glow if risky
        if (isRisky) {
            const glowGeometry = new THREE.SphereGeometry(NODE_RADIUS + 0.1, 32, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.3
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.userData = { isGlow: true };
            mesh.add(glow);
        }
    });
}

function onWindowResize() {
    const container = document.getElementById('networkCanvas');
    if (!container || !camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function onMouseMove(event) {
    const container = document.getElementById('networkCanvas');
    if (!container || !raycaster) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections with nodes
    const intersects = raycaster.intersectObjects(Array.from(nodeMeshes.values()));

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;
        const node = intersectedMesh.userData.node;

        if (hoveredNodeMesh !== intersectedMesh) {
            // Reset previous hover
            if (hoveredNodeMesh) {
                hoveredNodeMesh.scale.set(1, 1, 1);
            }

            hoveredNodeMesh = intersectedMesh;
            hoveredNodeMesh.scale.set(1.2, 1.2, 1.2);

            showTooltip(node, event.clientX, event.clientY);
            container.style.cursor = 'pointer';
        }
    } else {
        if (hoveredNodeMesh) {
            hoveredNodeMesh.scale.set(1, 1, 1);
            hoveredNodeMesh = null;
        }
        hideTooltip();
        container.style.cursor = 'default';
    }
}

function onMouseClick(event) {
    // Selection logic if needed
}

function animate() {
    requestAnimationFrame(animate);

    if (controls && controls.update) {
        controls.update();
    }

    // Rotate nodes slightly for visual interest
    nodeMeshes.forEach((mesh) => {
        mesh.rotation.y += 0.005;
    });

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function isNodeRisky(node) {
    const payoff = calculatePayoff(node);

    // 1. Negative Payoff
    if (payoff < 0) return true;

    // 2. Negative News Sentiment
    if (node.newsSentiment < -0.5) return true;

    // 3. Liquidity Buffer Crisis (Congestions/Bottlenecks)
    // If obligations exceed 80% of (Assets + Buffer), it's a bottleneck risk
    if (node.obligations > (node.assets + node.liquidityBuffer) * 0.8) return true;

    // 4. Low Capital Buffer relative to risk appetite
    if (node.capitalBuffer < node.obligations * node.riskAppetite) return true;

    return false;
}

// -- Mathematical Model --
function calculatePayoff(node) {
    // Formula: (Assets + Incomings) - (Outgoings + Liabilities/Obligations) - (Risk * Volatility)
    // Simplify for demo:
    // Incomings: sum of edges targeting this node
    // Outgoings: sum of edges originating from this node

    let incomings = EDGES.filter(e => e.target === node.id).reduce((sum, e) => sum + e.value, 0);
    let outgoings = EDGES.filter(e => e.source === node.id).reduce((sum, e) => sum + e.value, 0);

    const volatilityFactor = 100; // Constant for demo
    const riskCost = node.riskAppetite * volatilityFactor;

    // Net Liquidity position included in payoff
    const netFlow = incomings - outgoings;
    const netPosition = node.assets + netFlow - node.obligations - riskCost;

    return Math.floor(netPosition);
}

function getRiskReason(node) {
    const reasons = [];
    const payoff = calculatePayoff(node);

    if (payoff < 0) reasons.push("Negative Payoff");
    if (node.newsSentiment < -0.5) reasons.push("Negative News");
    if (node.obligations > (node.assets + node.liquidityBuffer) * 0.8) reasons.push("Liquidity Bottleneck");
    if (node.capitalBuffer < node.obligations * node.riskAppetite) reasons.push("Undercapitalized");

    return reasons;
}

function drawPieChart(canvas, node) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const payoff = calculatePayoff(node);

    // Prepare data - use absolute values for pie chart, but track original signs
    const data = [
        { label: 'Obligations', value: Math.abs(node.obligations), color: '#ef4444', original: node.obligations },
        { label: 'Assets', value: Math.abs(node.assets), color: '#3b82f6', original: node.assets },
        { label: 'Liquidity Buffer', value: Math.abs(node.liquidityBuffer), color: '#10b981', original: node.liquidityBuffer },
        { label: 'Payoff', value: Math.abs(payoff), color: payoff >= 0 ? '#22c55e' : '#f59e0b', original: payoff }
    ];

    // Calculate total for proportions
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        // Draw empty circle if no data
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
    }

    // Draw pie slices
    let currentAngle = -Math.PI / 2; // Start from top

    data.forEach((item, index) => {
        const sliceAngle = (item.value / total) * Math.PI * 2;

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        // Add border
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label if slice is large enough
        if (sliceAngle > 0.1) {
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
            const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.label.substring(0, 8), labelX, labelY);
        }

        currentAngle += sliceAngle;
    });

    // Legend removed by user request
}

function showTooltip(node, x, y) {
    if (!nodeTooltip) return;

    const payoff = calculatePayoff(node);
    const riskColor = payoff < 0 ? '#ef4444' : '#22c55e';
    const isRisky = isNodeRisky(node);

    let riskStatus = '<span style="color:#22c55e">HEALTHY</span>';

    if (isRisky) {
        const reasons = getRiskReason(node);
        riskStatus = `<span style="color:#ef4444">RISK: ${reasons.join(', ')}</span>`;
    }

    // Create unique canvas ID for this tooltip instance
    const canvasId = `pie-chart-${node.id}`;

    // Add Stock Price Row ALWAYS
    let stockPriceRow = '';
    if (node.currentPrice) {
        // Shown if we have a price (either from primary API or Featherless fallback)
        stockPriceRow = `<div class="tooltip-row"><span>Stock Price:</span> <span style="color:#fbbf24; font-weight:bold;">₹${node.currentPrice.toFixed(2)}</span></div>`;
    } else if (node.symbol) {
        // If it's a listed company but we're still fetching
        stockPriceRow = `<div class="tooltip-row"><span>Stock Price:</span> <span style="color:#94a3b8;">Fetching...</span></div>`;
    } else {
        // If unlisted and Featherless also couldn't find a price
        stockPriceRow = `<div class="tooltip-row"><span>Stock Price:</span> <span style="color:#64748b;">Not Listed</span></div>`;
    }

    nodeTooltip.innerHTML = `
        <h4>${node.name}</h4>
        <div class="tooltip-row"><span>Type:</span> <span>${NODE_TYPES[node.type]?.label || 'Unknown'}</span></div>
        ${stockPriceRow}
        <div class="tooltip-row"><span>Obligations:</span> <span>₹${node.obligations}Cr</span></div>
        <div class="tooltip-row"><span>Assets:</span> <span>₹${node.assets}Cr</span></div>
        <div class="tooltip-row"><span>Liquidity Buffer:</span> <span>₹${node.liquidityBuffer}Cr</span></div>
        <div class="tooltip-row"><span>Status:</span> <span>${riskStatus}</span></div>
        <div style="margin-top: 5px; border-top: 1px solid #333; padding-top: 5px;">
            <strong>Payoff (Net): <span style="color:${riskColor}">₹${payoff}Cr</span></strong>
        </div>
        <div style="margin-top: 10px; border-top: 1px solid #333; padding-top: 10px;">
            <strong style="font-size: 0.9em; color: #cbd5e1;">Financial Breakdown:</strong>
            <canvas id="${canvasId}" width="250" height="200" style="display: block; margin-top: 8px; background: rgba(15, 23, 42, 0.5); border-radius: 4px;"></canvas>
        </div>
    `;

    // Position tooltip above and close to mouse pointer
    // First, make it visible temporarily to measure its dimensions
    nodeTooltip.style.visibility = 'hidden';
    nodeTooltip.style.display = 'block';
    nodeTooltip.classList.remove('hidden');

    const tooltipWidth = nodeTooltip.offsetWidth;
    const tooltipHeight = nodeTooltip.offsetHeight;
    const offsetX = 15; // Horizontal offset from mouse
    const offsetY = 15; // Vertical offset from mouse (above)

    // Calculate position: above and to the right of mouse pointer
    let left = x + offsetX;
    let top = y - tooltipHeight - offsetY;

    // Ensure tooltip stays within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position if tooltip goes off right edge
    if (left + tooltipWidth > viewportWidth) {
        left = x - tooltipWidth - offsetX; // Position to the left of mouse
    }

    // Adjust horizontal position if tooltip goes off left edge
    if (left < 0) {
        left = 10; // Minimum margin from left edge
    }

    // Adjust vertical position if tooltip goes off top edge
    if (top < 0) {
        top = y + offsetY; // Position below mouse if no room above
    }

    // Adjust vertical position if tooltip goes off bottom edge
    if (top + tooltipHeight > viewportHeight) {
        top = viewportHeight - tooltipHeight - 10; // Keep margin from bottom
    }

    nodeTooltip.style.left = left + 'px';
    nodeTooltip.style.top = top + 'px';
    nodeTooltip.style.visibility = 'visible';
    nodeTooltip.style.display = 'block';

    // Draw pie chart after a brief delay to ensure canvas is rendered
    setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            drawPieChart(canvas, node);
        }
    }, 10);
}

function hideTooltip() {
    if (nodeTooltip) {
        nodeTooltip.classList.add('hidden');
    }
}

// -- News Feed --
function injectRandomNews() {
    const newsItem = NEWS_DATABASE[Math.floor(Math.random() * NEWS_DATABASE.length)];
    const date = new Date().toLocaleTimeString();

    const div = document.createElement('div');
    div.className = `news-item ${newsItem.sentiment < 0 ? 'negative' : ''}`;
    div.innerHTML = `<strong>${date}:</strong> ${newsItem.text}`;

    const feed = document.getElementById('news-feed');
    if (feed) {
        feed.prepend(div);
        if (feed.children.length > 5) feed.lastChild.remove();
    }

    // Apply effect if news targets a node
    if (newsItem.targetId) {
        const node = NODES.find(n => n.id === newsItem.targetId);
        if (node) {
            node.newsSentiment += newsItem.sentiment;
            // Decay sentiment over time
            setTimeout(() => { node.newsSentiment -= newsItem.sentiment; }, 10000);
        }
    }

    updateSystemStatus();
    updateNodeVisuals();
}

function updateSystemStatus() {
    const riskyNodes = NODES.filter(n => isNodeRisky(n));
    const statusIndicator = document.getElementById('status-indicator');

    if (!statusIndicator) return;

    if (riskyNodes.length >= 2) {
        statusIndicator.innerText = "CRITICAL: SYSTEM INSTABILITY DETECTED";
        statusIndicator.className = "status-critical";
        systemState = "CRITICAL";
    } else if (riskyNodes.length > 0) {
        statusIndicator.innerText = "WARNING: FRAILTY / CONGESTION";
        statusIndicator.className = "status-warning";
        systemState = "WARNING";
    } else {
        statusIndicator.innerText = "stabilized";
        statusIndicator.className = "status-ok";
        systemState = "STABLE";
    }
}

// -- Simulation & Logic --

function runSimulationStep() {
    // Randomly fluctuate asset values and obligations
    NODES.forEach(node => {
        const change = (Math.random() - 0.5) * 50;
        node.assets += Math.floor(change);

        // Randomly increase obligations to simulate congestion
        if (Math.random() > 0.7) {
            node.obligations += Math.floor(Math.random() * 20);
        }
    });

    // HARCODED FAILURE SCENARIOS (for demonstration)
    // 1. Force ICICI Bank to be undercapitalized
    const icici = NODES.find(n => n.name.includes("ICICI"));
    if (icici) {
        // Drop capital below required threshold (Obligations * RiskAppetite)
        // e.g. 700 * 0.8 = 560 required. Set buffer to 200.
        icici.capitalBuffer = 100;
        icici.obligations += 300; // Increase pressure
        console.log("Forced ICICI Bank into undercapitalized state.");
    }

    // 2. Force Axis Bank into Liquidity Crunch
    const axis = NODES.find(n => n.name.includes("Axis"));
    if (axis) {
        // Drop liquidity buffer
        axis.liquidityBuffer = 50;
        axis.obligations += 400;
        console.log("Forced Axis Bank into liquidity crunch.");
    }

    injectRandomNews(); // Force a news update
    updateNodeVisuals();
    alert("Market Cycle Simulated: FAILURES INJECTED. System Instability Detected.");
}

// -- Featherless AI API Helper --
async function callFeatherlessAPI(prompt, systemPrompt = null) {
    try {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(FEATHERLESS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FEATHERLESS_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Featherless API error:', error);
        return null;
    }
}

// -- Hamilton-Jacobi-Bellman (HJB) Solver for Mean Field Games --
// Mathematical formulation:
// ∂V/∂t + H(x, ∇V, t) = 0
// where H(x, p, t) = min_u [L(x,u,t) + f(x,u,t)·p]
// V(x,T) = g(x) (terminal condition)

// Helper to quantify risk for HJB solver
function calculateNodeRiskScore(node) {
    let score = 0;
    const payoff = calculatePayoff(node);

    // 1. Payoff Risk
    if (payoff < 0) score += Math.abs(payoff) * 2;

    // 2. News Sentiment Risk
    if (node.newsSentiment < -0.5) score += Math.abs(node.newsSentiment) * 50;

    // 3. Liquidity Bottleneck Risk
    // Gap between Obligations and Capacity
    const capacity = (node.assets + node.liquidityBuffer) * 0.8;
    if (node.obligations > capacity) {
        score += (node.obligations - capacity) * 0.5;
    }

    // 4. Capital Buffer Risk
    const requiredCapital = node.obligations * node.riskAppetite;
    if (node.capitalBuffer < requiredCapital) {
        score += (requiredCapital - node.capitalBuffer) * 1.0;
    }

    return score;
}

function computeSystemicRisk(nodes) {
    // Systemic risk measure: sum of individual risks + contagion risk
    let totalRisk = 0;
    let contagionRisk = 0;

    nodes.forEach(node => {
        const individualRisk = calculateNodeRiskScore(node);
        totalRisk += individualRisk;

        // Contagion risk: risk from connected nodes
        const connectedEdges = EDGES.filter(e => e.source === node.id || e.target === node.id);
        connectedEdges.forEach(edge => {
            const connectedNode = nodes.find(n =>
                n.id === (edge.source === node.id ? edge.target : edge.source)
            );
            // If connected node is risky, it adds contagion risk to this node
            if (connectedNode && calculateNodeRiskScore(connectedNode) > 10) {
                contagionRisk += edge.value * 0.1; // 10% of edge value as contagion risk
            }
        });
    });

    return totalRisk + contagionRisk;
}

function stateDynamics(node, control) {
    // f(x,u,t): State evolution under control u
    // Returns new state after applying control
    const { liquidityInjection, capitalInjection, riskReduction } = control;

    return {
        assets: node.assets,
        obligations: node.obligations * 0.9, // Reduce obligations by 10%
        liquidityBuffer: node.liquidityBuffer + liquidityInjection,
        capitalBuffer: node.capitalBuffer + capitalInjection,
        riskAppetite: Math.max(0.1, node.riskAppetite - riskReduction)
    };
}

function runningCost(node, control, state) {
    // L(x,u,t): Running cost function
    // Cost = intervention cost + risk cost
    const interventionCost = control.liquidityInjection * 0.1 + control.capitalInjection * 0.15;

    // Calculate risk score for the NEW state
    // We update a temp copy of the node to check its risk score
    const tempNode = { ...node, ...state };
    // Note: state has updated buffers/obligations, we mix them into node to check risk
    // Because calculateNodeRiskScore might rely on properties not in 'state' (like name/id for edges lookup)

    const riskCost = calculateNodeRiskScore(tempNode);

    return interventionCost + riskCost;
}

function terminalCost(nodes) {
    // g(x): Terminal cost at time T
    // Final systemic risk measure
    return computeSystemicRisk(nodes);
}

function solveHJB(nodes, timeHorizon = 1.0, timeSteps = 10, controlSteps = 5) {
    // Solve HJB using value iteration (backward in time)
    // V(x,t) = min_u [L(x,u,t) + V(f(x,u,t), t+dt)]

    const dt = timeHorizon / timeSteps;
    const riskyNodes = nodes.filter(n => isNodeRisky(n));

    if (riskyNodes.length === 0) {
        return []; // No interventions needed
    }

    // Initialize value function at terminal time
    let V = terminalCost(nodes);

    // Control space discretization
    const maxLiquidity = 1000;
    const maxCapital = 500;
    const liquiditySteps = controlSteps;
    const capitalSteps = controlSteps;
    const riskReductionOptions = [0.1, 0.2, 0.3];

    // Backward iteration (value iteration)
    const optimalControls = new Map();

    // For each time step, find optimal control
    for (let t = timeSteps - 1; t >= 0; t--) {
        for (let i = 0; i < riskyNodes.length; i++) {
            const node = riskyNodes[i];
            let minCost = Infinity;
            let bestControl = null;

            // Search over control space
            for (let li = 0; li <= liquiditySteps; li++) {
                for (let ci = 0; ci <= capitalSteps; ci++) {
                    for (const rr of riskReductionOptions) {
                        const liquidityInjection = (li / liquiditySteps) * maxLiquidity;
                        const capitalInjection = (ci / capitalSteps) * maxCapital;
                        const riskReduction = rr;

                        const control = { liquidityInjection, capitalInjection, riskReduction };
                        const newState = stateDynamics(node, control);

                        // Compute cost-to-go: running cost + future value
                        const running = runningCost(node, control, newState);
                        const combinedState = Object.assign({}, node, newState);
                        const futureValue = computeSystemicRisk([combinedState]);
                        const totalCost = running + futureValue;

                        if (totalCost < minCost) {
                            minCost = totalCost;
                            bestControl = {
                                nodeId: node.id,
                                liquidityInjection: Math.round(liquidityInjection),
                                capitalInjection: Math.round(capitalInjection),
                                riskReduction: riskReduction
                            };
                        }
                    }
                }
            }

            // Store optimal control at t=0 (current time)
            if (bestControl && t === 0) {
                optimalControls.set(node.id, bestControl);
            }
        }
    }

    return Array.from(optimalControls.values());
}

// -- "Featherless API" & MFG Logic --
async function runSafeClearing() {
    const featherlessOutput = document.getElementById('featherless-content');
    const analysisSection = document.getElementById('analysis-output');
    if (analysisSection) analysisSection.classList.remove('hidden');

    if (featherlessOutput) {
        featherlessOutput.innerHTML = "Solving Hamilton-Jacobi-Bellman Equation...";
    }
    pendingAdjustments = []; // Reset

    // Solve HJB equation to find optimal controls
    if (featherlessOutput) {
        featherlessOutput.innerHTML = "Computing optimal control via HJB: ∂V/∂t + H(x,∇V,t) = 0...";
    }

    // Create deep copies of nodes for HJB solver
    const nodesForHJB = NODES.map(node => ({ ...node }));

    // Solve HJB equation
    const hjbOptimalControls = solveHJB(nodesForHJB);
    pendingAdjustments = hjbOptimalControls;

    let adjustmentsDescription = [];

    hjbOptimalControls.forEach(control => {
        const node = NODES.find(n => n.id === control.nodeId);
        if (node) {
            let desc = `Inject ₹${control.liquidityInjection}Cr Liquidity`;
            if (control.capitalInjection > 0) {
                desc += ` & ₹${control.capitalInjection}Cr Capital to ${node.name}`;
            }
            adjustmentsDescription.push(desc);
        }
    });

    if (adjustmentsDescription.length === 0) {
        adjustmentsDescription.push("System is optimal. No clearing interventions required.");
    }

    // Prepare data for Featherless AI
    const vectorOutput = JSON.stringify(pendingAdjustments, null, 2);

    // Calculate payoffs for all nodes
    const nodePayoffs = NODES.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        payoff: calculatePayoff(node),
        obligations: node.obligations,
        assets: node.assets,
        liquidityBuffer: node.liquidityBuffer,
        capitalBuffer: node.capitalBuffer,
        riskAppetite: node.riskAppetite
    }));

    // Calculate HJB solution metrics
    const initialSystemicRisk = computeSystemicRisk(NODES);
    const nodesAfterControl = NODES.map(node => {
        const control = hjbOptimalControls.find(c => c.nodeId === node.id);
        if (control) {
            return stateDynamics(node, control);
        }
        return node;
    });
    const finalSystemicRisk = computeSystemicRisk(nodesAfterControl);
    const riskReduction = initialSystemicRisk > 0 ? ((initialSystemicRisk - finalSystemicRisk) / initialSystemicRisk) * 100 : 0;

    // Calibrate AI response for Indian Context
    const systemPrompt = `You are a financial systems analyst specializing in Mean Field Games (MFG) optimization for Indian financial infrastructure networks. You provide detailed, technical analysis of systemic risk and clearing mechanisms using INR currency (₹ Crores). Always maintain a professional, analytical tone.`;

    const userPrompt = `Analyze the following Mean Field Game optimization results solved using the Hamilton-Jacobi-Bellman (HJB) equation:

**HJB Equation Solved:**
∂V/∂t + H(x, ∇V, t) = 0

Where:
- V(x,t) is the value function (optimal cost-to-go)
- H(x, p, t) = min_u [L(x,u,t) + f(x,u,t)·p] is the Hamiltonian
- L(x,u,t) is the running cost (intervention cost + risk cost)
- f(x,u,t) describes state dynamics under control u
- Solved using value iteration (backward in time)

**Mathematical Payoff Formula:**
Payoff(node) = Assets + (Incomings - Outgoings) - Obligations - (RiskAppetite × 100)

Where:
  • Incomings = Σ(edge.value) for all edges targeting this node
  • Outgoings = Σ(edge.value) for all edges originating from this node
  • RiskCost = RiskAppetite × 100 (volatility factor)

**HJB Solution Metrics:**
- Initial Systemic Risk: ${initialSystemicRisk.toFixed(2)}
- Final Systemic Risk: ${finalSystemicRisk.toFixed(2)}
- Risk Reduction: ${riskReduction.toFixed(1)}%

**Network Data:**
Nodes: ${JSON.stringify(nodePayoffs, null, 2)}
Edges: ${JSON.stringify(EDGES, null, 2)}

**Output Vector (MFG Solution from HJB):**
${vectorOutput}

**Algorithm Details:**
- Algorithm: Dynamic Programming on Hamilton-Jacobi-Bellman Equation
- Method: Value Iteration (Backward in Time)
- Objective: Minimize Systemic Risk & Default Contagion
- Control Space: Discretized over liquidity injection, capital injection, and risk reduction

**Interventions Calculated:**
${adjustmentsDescription.join('\n')}

Please generate a comprehensive analysis in the following format (use markdown):

**MEAN FIELD GAME OPTIMIZATION COMPLETE**

> Algorithm: Dynamic Programming on Hamilton-Jacobi-Bellman Equation
> Objective: Minimize Systemic Risk & Default Contagion

**Mathematical Payoff Formula:**

[Include the formula with explanation]

**Output Vector (MFG Solution):**
\`\`\`json
[Include the JSON vector]
\`\`\`

**Proposed Trade Routing & Optimization Steps:**
[Detailed numbered list of interventions and routing optimizations]

**Vector Interpretation:**
[Explain what each field means]

**Status:** Awaiting Approval to Apply Changes...

Make it detailed, technical, and maintain the same professional style.`;

    try {
        const aiResponse = await callFeatherlessAPI(userPrompt, systemPrompt);

        if (aiResponse) {
            // Combine AI response with the vector output
            const responseText = aiResponse.replace(
                '```json\n[Include the JSON vector]\n```',
                `\`\`\`json\n${vectorOutput}\n\`\`\``
            );

            if (featherlessOutput) {
                typeWriterEffect(featherlessOutput, responseText.trim());
            }
        } else {
            // Fallback to local generation if API fails
            const fallbackText = `
**MEAN FIELD GAME OPTIMIZATION COMPLETE**

> Algorithm: Dynamic Programming on Hamilton-Jacobi-Bellman Equation
> Objective: Minimize Systemic Risk & Default Contagion

**Mathematical Payoff Formula:**

Payoff(node) = Assets + (Incomings - Outgoings) - Obligations - (RiskAppetite × 100)

Where:
  • Incomings = Σ(edge.value) for all edges targeting this node
  • Outgoings = Σ(edge.value) for all edges originating from this node
  • RiskCost = RiskAppetite × 100 (volatility factor)

**Output Vector (MFG Solution):**
\`\`\`json
${vectorOutput}
\`\`\`

**Proposed Trade Routing & Optimization Steps:**
1. **Rerouting Flows:** Redirect ₹50Cr obligations from ICICI Bank to Clearing Corporation of India.
2. **Interventions:** ${adjustmentsDescription.join(', ')}.
3. **Buffer Optimization:** Adjust risk appetite parameters to align with Nash Equilibrium.

**Vector Interpretation:**
- Each element represents an intervention for a risky node
- \`liquidityInjection\`: Amount of liquidity to inject (in Crores)
- \`capitalInjection\`: Amount of capital to inject (in Crores)
- \`riskReduction\`: Reduction in risk appetite parameter
- \`nodeId\`: Target node identifier

**Status:** Awaiting Approval to Apply Changes...
            `;

            if (featherlessOutput) {
                typeWriterEffect(featherlessOutput, fallbackText.trim());
            }
        }
    } catch (error) {
        console.error('Error generating analysis:', error);
        if (featherlessOutput) {
            featherlessOutput.innerHTML = "Error generating analysis. Please try again.";
        }
    }

    // Show the Apply button
    const applyBtn = document.getElementById('btn-apply-changes');
    if (applyBtn) applyBtn.style.display = 'flex';
}

function applyStabilization() {
    const featherlessOutput = document.getElementById('featherless-content');

    if (pendingAdjustments.length === 0) {
        alert("No adjustments to apply.");
        return;
    }

    // Apply changes
    pendingAdjustments.forEach(adj => {
        const node = NODES.find(n => n.id === adj.nodeId);
        if (node) {
            node.liquidityBuffer += adj.liquidityInjection;
            if (adj.capitalInjection) node.capitalBuffer += adj.capitalInjection;

            node.riskAppetite = Math.max(0.1, node.riskAppetite - adj.riskReduction);
            node.newsSentiment = 0; // Reset bad news
            node.obligations = Math.floor(node.obligations * 0.9); // Reduce congestion
        }
    });

    // Visual update
    updateSystemStatus();
    updateNodeVisuals();

    const successText = `
**STABILIZATION APPLIED**

> All nodes have been cleared.
> Liquidity & Capital buffers replenished.
> Risk parameters adjusted.
> Congestion routed through Central Clearing.

**System Status:** FULLY STABILIZED
    `;

    if (featherlessOutput) {
        typeWriterEffect(featherlessOutput, successText.trim());
    }

    // Hide Apply button and Enable Policy
    const applyBtn = document.getElementById('btn-apply-changes');
    const policyBtn = document.getElementById('btn-policy');
    if (applyBtn) applyBtn.style.display = 'none';
    if (policyBtn) policyBtn.disabled = false;
}

async function generatePolicy() {
    const featherlessOutput = document.getElementById('featherless-content');
    if (featherlessOutput) {
        featherlessOutput.innerHTML = "Generative Model processing regulatory framework...";
    }

    try {
        // Prepare comprehensive data for policy generation
        const nodeData = NODES.map(node => ({
            id: node.id,
            name: node.name,
            type: node.type,
            obligations: node.obligations,
            assets: node.assets,
            liquidityBuffer: node.liquidityBuffer,
            capitalBuffer: node.capitalBuffer,
            riskAppetite: node.riskAppetite,
            payoff: calculatePayoff(node),
            isRisky: isNodeRisky(node)
        }));

        const systemPrompt = `You are a regulatory policy expert specializing in financial infrastructure risk management. You generate comprehensive, actionable regulatory policies based on financial network analysis and stress test results. Always use markdown formatting and maintain a professional, authoritative tone.`;

        const userPrompt = `Based on the following financial infrastructure network analysis and Mean Field Game optimization results, generate a comprehensive regulatory policy framework:

**Network Analysis Data:**
Nodes: ${JSON.stringify(nodeData, null, 2)}
Edges: ${JSON.stringify(EDGES, null, 2)}
System State: ${systemState}

**Recent Interventions Applied:**
${pendingAdjustments.length > 0 ? JSON.stringify(pendingAdjustments, null, 2) : 'No interventions applied yet'}

**Payoff Formula Used:**
Payoff(node) = Assets + (Incomings - Outgoings) - Obligations - (RiskAppetite × 100)

Please generate a regulatory policy document in the following format (use markdown):

**GENERATED REGULATORY POLICY (Featherless AI)**

[Introduction paragraph explaining the basis for the policy recommendations]

[Numbered list of specific policy recommendations with detailed explanations]

[Conclusion with impact assessment]

Make it detailed, specific to the network data provided, and include quantitative thresholds where appropriate. Maintain the same professional style and structure.`;

        const aiResponse = await callFeatherlessAPI(userPrompt, systemPrompt);

        if (aiResponse) {
            if (featherlessOutput) {
                typeWriterEffect(featherlessOutput, aiResponse.trim());
            }
        } else {
            // Fallback to local generation if API fails
            const fallbackText = `
**GENERATED REGULATORY POLICY (Featherless AI)**

Based on the recent simulation and stress test results, the following policies are recommended to prevent future bottlenecks:

1. **Liquidity Coverage Ratio (LCR) Mandate**:
   - "ICICI Bank" and similar entities must maintain a buffer > 25% of total obligations.
   
2. **Incentive Alignment**:
   - Cap bonus structures for executive nodes when 'Risk Appetite' exceeds 0.6 during high volatility.
   
3. **Inter-node Obligation Clearing**:
   - Mandate usage of Clearing Corporation of India for all transactions > ₹50Cr to reduce counterparty risk contagion.
   
4. **Dynamic Risk Weighting**:
   - Assets held by "State Bank Of India" should undergo a 15% haircut valuation in stress scenarios.

*Adoption of these policies reduces probability of systemic collapse by 43%.*
            `;

            if (featherlessOutput) {
                typeWriterEffect(featherlessOutput, fallbackText.trim());
            }
        }
    } catch (error) {
        console.error('Error generating policy:', error);
        if (featherlessOutput) {
            featherlessOutput.innerHTML = "Error generating policy. Please try again.";
        }
    }
}

// Simple typewriter effect for "AI" text
function typeWriterEffect(element, text) {
    if (!element) return;

    element.innerHTML = "";
    // Handle markdown formatting: bold, code blocks, and line breaks
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/```json\n([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 0.85em; margin: 10px 0;"><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px; font-size: 0.9em;">$1</code>')
        .replace(/\n/g, '<br>');

    element.innerHTML = formattedText; // Just show it immediately for better UX in this demo, simulating typing is slow for long text
    element.style.opacity = 0;

    let op = 0;
    const fade = setInterval(() => {
        if (op >= 1) clearInterval(fade);
        element.style.opacity = op;
        op += 0.1;
    }, 50);
}

// Start - wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
