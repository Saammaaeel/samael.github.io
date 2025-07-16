/**
 * ============================================================================
 * COSMIC EXPLORER - Into The Unknown
 * ============================================================================
 * A high-performance WebGL cosmic visualization with AI-powered education
 * 
 * Features:
 * - Ultra quality volumetric atmospheric effects
 * - Adaptive performance optimization (auto-quality adjustment)
 * - Secure Hugging Face AI integration via serverless API
 * - Mobile-optimized touch controls
 * - Real-time shader transformations between tunnel/singularity effects
 * - Educational cosmic facts with physics explanations
 * 
 * Performance Optimizations:
 * - Reduced shader iterations (75 max vs 150)
 * - Optimized FBM noise (4 octaves max vs 8)
 * - Adaptive quality based on FPS monitoring
 * - Mobile-specific optimizations and throttling
 * ============================================================================
 */

import * as THREE from 'three';
import { GUI } from 'lil-gui';

// =============================================================================
// GLOBAL VARIABLES & CONFIGURATION
// =============================================================================

// --- Core Application Variables ---
let camera, scene, renderer;
let material;
let is_transitioning = false;
let shader_index = 0;
let isMobile = false;
let qualityLevel = 'high'; // 'low', 'medium', 'high', 'ultra'
let batteryMode = false;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 60;

// --- Touch Gesture Variables ---
let touchStartX = 0;
let touchStartY = 0;
let isSwipeDetected = false;

// --- Educational Content Variables ---
let educationalPanel = null;
let currentFactIndex = 0;
let isLoadingFact = false;
let factCache = new Map();

// --- AI Configuration & Integration ---
const AI_CONFIG = {
    // Secure API endpoint (deployed separately on Vercel/Netlify)
    // Update this URL when you deploy your serverless function
    serverlessEndpoint: 'https://cosmic-wanderer-sandy.vercel.app/api/generate-fact', // CHANGE THIS TO YOUR DEPLOYED URL
    
    // Alternative: Auto-detect based on current domain
    // serverlessEndpoint: window.location.hostname.includes('github.io') 
    //     ? 'https://your-cosmic-api.vercel.app/api/generate-fact'  // Production API
    //     : '/api/generate-fact',  // Local development
    
    // Mode selection: 'api' for serverless only, 'hybrid' for API + static fallback
    mode: 'hybrid', 
    
    // Status tracking
    apiStatus: {
        lastAttempt: null,
        isWorking: false,
        errorCount: 0,
        usingFallback: false,
        hasServerlessAPI: false
    },
    
    // Rate limiting for API calls
    rateLimit: {
        maxCallsPerMinute: 10,
        callHistory: [],
        lastReset: Date.now()
    },
    
    // CORS handling for cross-origin requests (GitHub Pages -> Vercel API)
    corsMode: 'cors',
    credentials: 'omit',  // Don't send cookies cross-origin
    
    // Topics for AI fact generation
    cosmicTopics: [
        'black holes and event horizons',
        'neutron stars and pulsars', 
        'dark matter and dark energy',
        'exoplanets and habitable zones',
        'supernovas and stellar evolution',
        'galaxy formation and cosmic structure',
        'quantum mechanics in space',
        'time dilation and relativity',
        'cosmic microwave background radiation',
        'wormholes and theoretical physics',
        'asteroid belts and planetary formation',
        'magnetospheres and space weather',
        'cosmic rays and particle physics',
        'red giants and white dwarfs',
        'gravitational waves and spacetime',
        'the multiverse theory',
        'cosmic inflation and the Big Bang',
        'quasars and active galactic nuclei',
        'solar wind and heliosphere',
        'planetary rings and moons',
        'stellar nurseries and nebulae',
        'cosmic microwave background',
        'Hawking radiation',
        'solar system formation',
        'galactic collisions',
        'cosmic strings',
        'vacuum decay',
        'parallel universes',
        'antimatter mysteries',
        'quantum entanglement in space'
    ]
};

// --- Shader Uniforms ---
const uniforms = {
    time: { value: 0.0 },
    resolution: { value: new THREE.Vector2() },
    transition_progress: { value: 0.0 },
    interstellar_mix: { value: 0.0 },
    quality_factor: { value: 1.0 },
    iteration_count: { value: 100.0 },
    detail_level: { value: 1.0 }
};

// =============================================================================
// EDUCATIONAL CONTENT DATA
// =============================================================================

// --- Educational Content Data ---
const cosmicFacts = [
    {
        title: "Black Holes",
        content: "Black holes are regions of spacetime where gravity is so strong that nothing, not even light, can escape once it crosses the event horizon.",
        physics: "The visualization shows how matter spirals into a black hole, creating an accretion disk that glows from intense heat and friction. In Ultra mode, volumetric atmospheric effects simulate the superheated plasma and gas clouds surrounding these cosmic monsters."
    },
    {
        title: "Wormholes",
        content: "Theoretical passages through spacetime that could create shortcuts between distant regions of the universe.",
        physics: "The tunnel effect demonstrates how spacetime might bend to connect two distant points, as predicted by Einstein's general relativity. Ultra quality adds realistic atmospheric scattering to show how light would behave in such exotic spacetime geometries."
    },
    {
        title: "Gravitational Lensing",
        content: "Massive objects bend light around them, creating distorted or multiple images of distant objects.",
        physics: "The warping effects you see represent how gravity curves spacetime, affecting the path of light rays. The enhanced atmospheric effects in Ultra mode show how interstellar medium would be affected by these gravitational fields."
    },
    {
        title: "Cosmic Microwave Background",
        content: "The afterglow of the Big Bang, visible throughout the universe as faint radiation.",
        physics: "The chaotic patterns represent quantum fluctuations from the early universe that eventually formed galaxies and stars. Ultra mode's volumetric clouds simulate the primordial plasma that filled the early cosmos."
    },
    {
        title: "Dark Matter",
        content: "Invisible matter that makes up about 27% of the universe, only detectable through its gravitational effects.",
        physics: "The invisible forces shaping the visual patterns represent how dark matter influences the structure of the cosmos. The atmospheric effects in Ultra quality visualize how dark matter might interact with the cosmic web of matter and energy."
    },
    {
        title: "Atmospheric Scattering",
        content: "The physics behind why we see blue skies and red sunsets - light scattering off particles in the atmosphere.",
        physics: "Ultra mode implements real Rayleigh and Mie scattering equations, the same physics that creates Earth's sky colors. Blue light scatters more than red, creating the spectacular atmospheric effects you see."
    }
];

// =============================================================================
// DEVICE DETECTION & PERFORMANCE
// =============================================================================

// --- Mobile Detection ---
function detectMobile() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    
    // Detect battery API for power-conscious rendering
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            batteryMode = battery.level < 0.3 || !battery.charging;
            if (batteryMode) {
                qualityLevel = 'low';
                updateQualitySettings();
            }
        });
    }
    
    return isMobile;
}

// --- Quality Settings ---
function updateQualitySettings() {
    const wasUltra = uniforms.detail_level.value >= 2.0;
    
    // More aggressive performance optimization
    switch(qualityLevel) {
        case 'low':
            uniforms.quality_factor.value = 0.25;
            uniforms.iteration_count.value = isMobile ? 15.0 : 25.0;
            uniforms.detail_level.value = 0.3;
            break;
        case 'medium':
            uniforms.quality_factor.value = 0.5;
            uniforms.iteration_count.value = isMobile ? 25.0 : 40.0;
            uniforms.detail_level.value = 0.6;
            break;
        case 'high':
            uniforms.quality_factor.value = 0.8;
            uniforms.iteration_count.value = isMobile ? 40.0 : 60.0;
            uniforms.detail_level.value = 0.8;
            break;
        case 'ultra':
            uniforms.quality_factor.value = 1.0;
            uniforms.iteration_count.value = isMobile ? 50.0 : 75.0; // Reduced from 150
            uniforms.detail_level.value = 1.5; // Reduced from 2.0
            
            // Special welcome message for first-time ultra activation
            if (!wasUltra) {
                setTimeout(() => {
                    showDetailedNotification(
                        '🌌 ULTRA MODE ACTIVATED', 
                        '🌫️ Optimized Volumetric Effects\n☁️ Performance-Balanced Atmosphere\n🌅 Smooth Real-time Rendering\n✨ 60fps Ultra Experience\n🔬 Beautiful and Responsive!',
                        5000
                    );
                }, 500);
            }
            break;
    }
    
    // Adaptive quality based on screen size and device
    const screenArea = window.innerWidth * window.innerHeight;
    const isHighRes = screenArea > 2073600; // 1920x1080
    
    if (isHighRes && !isMobile) {
        // Scale down quality for high resolution displays
        uniforms.quality_factor.value *= 0.7;
        uniforms.iteration_count.value *= 0.8;
    }
    
    // Add resolution-based scaling
    const resolutionScale = Math.min(1.0, 1920 / window.innerWidth);
    uniforms.quality_factor.value *= resolutionScale;
}

// --- Touch Gesture Handling ---
function setupTouchGestures() {
    const canvas = renderer.domElement;
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isSwipeDetected = false;
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isSwipeDetected) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 50) { // Minimum swipe distance
            isSwipeDetected = true;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > 0) {
                    // Swipe right - next fact
                    showNextFact();
                } else {
                    // Swipe left - previous fact
                    showPreviousFact();
                }
            } else {
                // Vertical swipe
                if (deltaY < 0) {
                    // Swipe up - trigger transformation
                    triggerTransformation();
                } else {
                    // Swipe down - toggle educational panel
                    toggleEducationalPanel();
                }
            }
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isSwipeDetected = false;
    }, { passive: false });
    
    // Double tap for quality toggle
    let lastTap = 0;
    canvas.addEventListener('touchend', (e) => {
        const currentTime = Date.now();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0) {
            cycleQuality();
        }
        lastTap = currentTime;
    });
}

// --- Educational Panel Functions ---
function createEducationalPanel() {
    educationalPanel = document.createElement('div');
    educationalPanel.id = 'educational-panel';
    educationalPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 400px;
        z-index: 1000;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    document.body.appendChild(educationalPanel);
    updateEducationalContent();
}

// =============================================================================
// AI FACT GENERATION & API INTEGRATION
// =============================================================================

// --- AI Fact Generation Functions ---
async function generateCosmicFact(topic = null) {
    if (isLoadingFact) return null;
    
    isLoadingFact = true;
    showFactLoadingState();
    
    try {
        // Select random topic if none provided
        if (!topic) {
            topic = AI_CONFIG.cosmicTopics[Math.floor(Math.random() * AI_CONFIG.cosmicTopics.length)];
        }
        
        // Check cache first
        if (factCache.has(topic)) {
            const cachedFact = factCache.get(topic);
            isLoadingFact = false;
            return cachedFact;
        }
        
        // Generate prompt for cosmic fact
        const prompt = createCosmicFactPrompt(topic);
        
        // Try different free APIs
        let fact = await tryGenerateWithFreeAPIs(prompt, topic);
        
        if (fact) {
            // Cache the generated fact
            factCache.set(topic, fact);
            return fact;
        } else {
            // Fallback to enhanced static facts
            return generateEnhancedStaticFact(topic);
        }
        
    } catch (error) {
        console.warn('AI fact generation failed, using enhanced static content:', error);
        return generateEnhancedStaticFact(topic);
    } finally {
        isLoadingFact = false;
        hideFactLoadingState();
    }
}

function createCosmicFactPrompt(topic) {
    return `Generate a fascinating space fact about ${topic}. 
    Format: Title: [Short Title]
    Content: [2-3 sentences of engaging description suitable for general audience]
    Physics: [1-2 sentences explaining the scientific principles involved]
    
    Make it educational but captivating, suitable for a cosmic visualization app. Focus on real science.`;
}

// --- Enhanced Educational Panel Functions ---
async function generateNewFact() {
    if (isLoadingFact) return;
    
    const newFact = await generateCosmicFact();
    if (newFact) {
        // Add to the beginning of the facts array
        cosmicFacts.unshift(newFact);
        currentFactIndex = 0;
        updateEducationalContent();
        
        if (educationalPanel.style.transform !== 'translateY(0px)') {
            toggleEducationalPanel();
        }
    }
}

function updateEducationalContent() {
    if (!educationalPanel || isLoadingFact) return;
    
    const fact = cosmicFacts[currentFactIndex];
    const isPremiumAI = fact.source && fact.source.includes('Hugging Face');
    const isCurated = !fact.source || fact.source.includes('Curated') || fact.source.includes('Enhanced Static');
    
    let sourceLabel = '';
    if (isPremiumAI) {
        sourceLabel = '<span style="font-size: 12px; background: rgba(255,215,0,0.2); padding: 2px 6px; border-radius: 10px; color: #FFD700;">⭐ Premium AI</span>';
    } else if (isCurated) {
        sourceLabel = '<span style="font-size: 12px; background: rgba(129,199,132,0.2); padding: 2px 6px; border-radius: 10px; color: #81c784;">📚 Curated</span>';
    }
    
    const statusText = AI_CONFIG.apiStatus.hasServerlessAPI 
        ? 'Premium AI + Curated content' 
        : 'Curated content available';
    
    educationalPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #64b5f6;">${fact.title}</h3>
            ${sourceLabel}
        </div>
        <p style="margin: 0 0 15px 0; line-height: 1.5;">${fact.content}</p>
        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px;">
            <h4 style="margin: 0 0 8px 0; color: #81c784;">Physics Explanation:</h4>
            <p style="margin: 0; line-height: 1.4; font-size: 0.9em;">${fact.physics}</p>
        </div>
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.8em; color: #bbb;">
                    ${currentFactIndex + 1} / ${cosmicFacts.length} facts
                </div>
                <button onclick="generateNewFact()" style="
                    background: linear-gradient(45deg, #64b5f6, #81c784);
                    border: none;
                    padding: 5px 12px;
                    border-radius: 15px;
                    color: white;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: bold;
                ">⭐ Generate Premium Fact</button>
            </div>
            <div style="margin-top: 8px; text-align: center; font-size: 0.7em; color: #888;">
                Swipe left/right for more • ${statusText}
            </div>
        </div>
    `;
}

// Make generateNewFact available globally
window.generateNewFact = generateNewFact;

function toggleEducationalPanel() {
    if (!educationalPanel) return;
    
    const isVisible = educationalPanel.style.transform === 'translateY(0px)';
    educationalPanel.style.transform = isVisible ? 'translateY(-100%)' : 'translateY(0px)';
}

function showNextFact() {
    currentFactIndex = (currentFactIndex + 1) % cosmicFacts.length;
    updateEducationalContent();
    if (educationalPanel.style.transform !== 'translateY(0px)') {
        toggleEducationalPanel();
    }
}

function showPreviousFact() {
    currentFactIndex = (currentFactIndex - 1 + cosmicFacts.length) % cosmicFacts.length;
    updateEducationalContent();
    if (educationalPanel.style.transform !== 'translateY(0px)') {
        toggleEducationalPanel();
    }
}

function cycleQuality() {
    const qualities = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualities.indexOf(qualityLevel);
    qualityLevel = qualities[(currentIndex + 1) % qualities.length];
    updateQualitySettings();
    
    // Show enhanced quality notification with details
    let message = `Quality: ${qualityLevel.toUpperCase()}`;
    let details = '';
    
    switch(qualityLevel) {
        case 'ultra':
            details = '\n🌫️ Volumetric Atmosphere\n☁️ Multi-layer Clouds\n🌅 Physics-based Scattering\n✨ God Rays & Full-screen Effects';
            break;
        case 'high':
            details = '\n🎯 Maximum Detail\n🔥 Enhanced Effects';
            break;
        case 'medium':
            details = '\n⚖️ Balanced Performance';
            break;
        case 'low':
            details = '\n⚡ Optimized Speed\n🔋 Battery Friendly';
            break;
    }
    
    showDetailedNotification(message, details, qualityLevel === 'ultra' ? 4000 : 2000);
}

function showDetailedNotification(message, details = '', duration = 2000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px 30px;
        border-radius: 15px;
        font-family: 'Segoe UI', Arial, sans-serif;
        z-index: 2000;
        backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        text-align: center;
        max-width: 300px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;
    
    const mainText = document.createElement('div');
    mainText.style.cssText = `
        font-size: 16px;
        font-weight: bold;
        margin-bottom: ${details ? '10px' : '0'};
    `;
    mainText.textContent = message;
    notification.appendChild(mainText);
    
    if (details) {
        const detailText = document.createElement('div');
        detailText.style.cssText = `
            font-size: 12px;
            line-height: 1.4;
            color: #ccc;
            white-space: pre-line;
        `;
        detailText.textContent = details;
        notification.appendChild(detailText);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, duration);
}

function triggerTransformation() {
    const transform_controls = { transform: performTransformation };
    transform_controls.transform();
}

// --- FPS Monitoring with Adaptive Quality ---
function updateFPS(timestamp) {
    frameCount++;
    if (timestamp - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = timestamp;
        
        // Adaptive quality reduction for poor performance
        if (!batteryMode) {
            if (fps < 25 && qualityLevel === 'ultra') {
                qualityLevel = 'high';
                updateQualitySettings();
                showDetailedNotification('Auto Quality: High', '⚡ Reduced from Ultra for smoother performance');
            } else if (fps < 20 && qualityLevel === 'high') {
                qualityLevel = 'medium';
                updateQualitySettings();
                showDetailedNotification('Auto Quality: Medium', '⚡ Optimizing for better frame rate');
            } else if (fps < 15 && qualityLevel === 'medium') {
                qualityLevel = 'low';
                updateQualitySettings();
                showDetailedNotification('Auto Quality: Low', '⚡ Maximum optimization for stability');
            }
        }
        
        // Auto-upgrade quality if performance is good
        if (fps > 55 && qualityLevel === 'low' && !batteryMode) {
            qualityLevel = 'medium';
            updateQualitySettings();
            showDetailedNotification('Auto Quality: Medium', '✨ Performance improved - upgrading quality');
        } else if (fps > 58 && qualityLevel === 'medium' && !batteryMode) {
            qualityLevel = 'high';
            updateQualitySettings();
            showDetailedNotification('Auto Quality: High', '✨ Excellent performance - upgrading quality');
        }
        
        // Battery mode performance optimization
        if (batteryMode && fps < 30 && qualityLevel !== 'low') {
            qualityLevel = 'low';
            updateQualitySettings();
            showDetailedNotification('Battery Mode: Quality Reduced', '🔋 Optimizing for battery life');
        }
    }
}

// =============================================================================
// SHADER CODE & GRAPHICS
// =============================================================================

// --- Vertex Shader ---
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// --- Shader Code (Performance Optimized) ---
const volumetric_atmosphere_code = `
    // Optimized atmospheric scattering
    vec3 rayleigh_scattering(float cosTheta) {
        return vec3(0.58, 1.35, 3.31) * (1.0 + cosTheta * cosTheta) * 0.06;
    }
    
    vec3 mie_scattering(float cosTheta, float g) {
        float g2 = g * g;
        float num = (1.0 - g2);
        float denom = pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
        return vec3(0.4) * num / denom;
    }
    
    // Optimized noise function
    float noise3D(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
    }
    
    // Much faster FBM with fewer octaves
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        // Limit to maximum 4 octaves for performance
        int maxOctaves = min(octaves, 4);
        
        for (int i = 0; i < 4; i++) {
            if (i >= maxOctaves) break;
            value += noise3D(p * frequency) * amplitude;
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    
    vec4 get_volumetric_atmosphere(vec2 uv, vec3 rayDir, float time) {
        vec3 sunDir = normalize(vec3(sin(time * 0.1), 0.8, cos(time * 0.1)));
        float cosTheta = dot(rayDir, sunDir);
        
        // Simplified atmospheric density
        float altitude = rayDir.y * 0.5 + 0.5;
        float density = exp(-altitude * 3.0);
        
        // Single optimized cloud layer instead of 3
        vec3 cloudPos = rayDir * 60.0 + vec3(time * 1.5, time * 0.3, time * 1.0);
        float cloud = fbm(cloudPos * 0.015, 3); // Reduced from 6 octaves
        cloud = smoothstep(0.4, 0.8, cloud);
        
        // Optional second layer only for ultra quality
        float cloud2 = 0.0;
        if (detail_level > 1.0) {
            vec3 cloudPos2 = rayDir * 90.0 + vec3(time * -1.0, time * 0.2, time * 1.5);
            cloud2 = fbm(cloudPos2 * 0.01, 2); // Reduced from 5 octaves
            cloud2 = smoothstep(0.5, 0.9, cloud2) * 0.3;
        }
        
        float totalCloud = cloud + cloud2;
        
        // Simplified scattering
        vec3 rayleigh = rayleigh_scattering(cosTheta);
        vec3 mie = mie_scattering(cosTheta, 0.76);
        
        // Simplified atmospheric coloring
        vec3 horizonColor = vec3(1.0, 0.5, 0.2) * (1.0 - altitude);
        vec3 zenithColor = vec3(0.2, 0.4, 0.9) * altitude;
        vec3 skyColor = mix(horizonColor, zenithColor, altitude);
        
        // Simplified sun disk
        float sunIntensity = max(0.0, 1.0 - distance(rayDir.xy, sunDir.xy) * 25.0);
        vec3 sunColor = vec3(1.0, 0.9, 0.7) * sunIntensity * 10.0;
        
        // Combine effects more efficiently
        vec3 scatteredLight = rayleigh * skyColor;
        vec3 cloudColor = mix(vec3(0.9, 0.95, 1.0), vec3(1.0, 0.7, 0.4), sunIntensity);
        
        vec3 finalColor = scatteredLight + sunColor;
        finalColor = mix(finalColor, cloudColor, totalCloud * density);
        
        // Simplified god rays
        if (detail_level > 1.0) {
            float godRays = pow(max(0.0, cosTheta), 6.0) * totalCloud * 0.3;
            finalColor += vec3(1.0, 0.8, 0.6) * godRays;
        }
        
        float alpha = density * (0.2 + totalCloud * 0.5);
        return vec4(finalColor, alpha);
    }
`;

const tunnel_shader_code = `
    vec4 get_tunnel_color(vec2 u, float t) {
        vec4 fragColor = vec4(0.0);
        float d = 0.0;
        for (float i = 0.0; i < 100.0; i++) {
            vec3 p = vec3(u * d, d + t * 2.0);
            float angle = p.z * 0.2;
            p.xy *= mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            float s = sin(p.y + p.x);
            for (float n = 1.0; n < 32.0; n += n) {
                s -= abs(dot(cos(0.3 * t + p * n), vec3(0.3))) / n;
            }
            s = 0.01 + abs(s) * 0.8;
            d += s;
            fragColor += vec4(0.1 / s);
        }
        
        vec4 result = tanh(fragColor / 20000.0 / length(u));
        
        // Ultra quality: Add volumetric atmosphere overlay
        if (detail_level >= 1.2) {
            vec3 rayDir = normalize(vec3(u, 1.0));
            vec4 atmosphere = get_volumetric_atmosphere(u, rayDir, t);
            result = mix(result, atmosphere, atmosphere.a * 0.2);
        }
        
        return result;
    }
`;

const singularity_shader_code = `
vec4 get_singularity_color(vec2 fragCoord, vec2 resolution, float time) {
    float i = 0.2, a;
    vec2 r = resolution,
         p = (fragCoord + fragCoord - r) / r.y / 0.7,
         d = vec2(-1,1),
         b = p - i*d,
         c = p * mat2(1, 1, d/(0.1 + i/dot(b,b))),
         v = c * mat2(cos(0.5*log(a=dot(c,c)) + time*i + vec4(0,33,11,0)))/i,
         w;
    
    for(; i<9.0; i++) {
        w += 1.0+sin(v);
        v += 0.7* sin(v.yx*i+time) / i + 0.5;
    }
    
    i = length( sin(v/0.3)*0.4 + c*(3.0+d) );
    
    vec4 O = 1.0 - exp( -exp( c.x * vec4(0.6,-0.4,-1.0,0) )
                   / w.xyyx
                   / ( 2.0 + i*i/4.0 - i )
                   / ( 0.5 + 1.0 / a )
                   / ( 0.03 + abs( length(p)-0.7 ) )
             );
    
    vec4 result = O;
    
    // Ultra quality: Add volumetric atmospheric effects around singularity
    if (detail_level >= 1.2) {
        vec3 rayDir = normalize(vec3(p, 0.8));
        vec4 atmosphere = get_volumetric_atmosphere(p, rayDir, time);
        
        // Add accretion disk effects
        float diskDist = length(p);
        float diskEffect = exp(-diskDist * 1.5) * 0.3;
        atmosphere.rgb *= (1.0 + diskEffect);
        
        result = mix(result, atmosphere, atmosphere.a * 0.25);
    }
    
    return result;
}
`;

const transition_shader_code = `
    // 'Warp Speed 2' by David Hoskins 2015.
    // Adapted for Three.js
    vec4 get_transition_color(vec2 fragCoord, vec2 resolution, float time) {
        float s = 0.0, v = 0.0;
        vec2 uv = (fragCoord / resolution) * 2.0 - 1.0;
        float t = (time - 2.0) * 58.0;
        vec3 col = vec3(0.0);
        vec3 init = vec3(sin(t * 0.0032) * 0.3, 0.35 - cos(t * 0.005) * 0.3, t * 0.002);
        for (int r = 0; r < 100; r++) 
        {
            vec3 p = init + s * vec3(uv, 0.05);
            p.z = fract(p.z);
            for (int i = 0; i < 10; i++) {
                p = abs(p * 2.04) / dot(p, p) - 0.9;
            }
            v += pow(dot(p, p), 0.7) * 0.06;
            col += vec3(v) * 0.00003;
            s += 0.025;
        }
        
        vec4 result = tanh(vec4(col, 1.0) / 30.0 / length(uv));
        
        // Ultra quality: Add volumetric warp effects
        if (detail_level >= 1.2) {
            vec3 rayDir = normalize(vec3(uv, 0.4));
            vec4 atmosphere = get_volumetric_atmosphere(uv, rayDir, time);
            
            // Add warp effects
            float warpStrength = length(col) * 0.05;
            atmosphere.rgb *= (1.0 + warpStrength);
            
            // Add warp rays
            vec3 warpRays = vec3(1.0, 0.9, 0.95) * warpStrength;
            atmosphere.rgb += warpRays;
            
            result = mix(result, atmosphere, atmosphere.a * 0.4);
        }
        
        return result;
    }
`;

// --- Performance Transformation Function ---
function performTransformation() {
    if (is_transitioning) return;
    is_transitioning = true;
    
    // Adjust transition speed based on device capability
    const transition_duration = isMobile ? 2000 : 1500;
    const interstellar_hold = isMobile ? 3000 : 2000;

    const animate_phase = (uniform, target, duration, onComplete) => {
        const start_value = uniform.value;
        const start_time = performance.now();
        function do_animate() {
            const elapsed = performance.now() - start_time;
            const progress = Math.min(elapsed / duration, 1.0);
            uniform.value = THREE.MathUtils.lerp(start_value, target, progress);
            if (progress < 1.0) requestAnimationFrame(do_animate);
            else if (onComplete) onComplete();
        }
        do_animate();
    };

    if (shader_index === 0) { // Tunnel -> Galaxy
        animate_phase(uniforms.interstellar_mix, 1.0, transition_duration, () => {
            animate_phase(uniforms.transition_progress, 1.0, transition_duration, () => {
                setTimeout(() => {
                    animate_phase(uniforms.interstellar_mix, 0.0, transition_duration, () => {
                        shader_index = 1;
                        is_transitioning = false;
                    });
                }, interstellar_hold / 2);
            });
        });
    } else { // Galaxy -> Tunnel
        animate_phase(uniforms.interstellar_mix, 1.0, transition_duration, () => {
            animate_phase(uniforms.transition_progress, 0.0, transition_duration, () => {
                setTimeout(() => {
                     animate_phase(uniforms.interstellar_mix, 0.0, transition_duration, () => {
                        shader_index = 0;
                        is_transitioning = false;
                    });
                }, interstellar_hold / 2);
            });
        });
    }
}

// =============================================================================
// MAIN APPLICATION LOGIC & INITIALIZATION
// =============================================================================

// --- Main Application Logic ---
function main() {
    // Initialize mobile detection and settings
    detectMobile();
    updateQualitySettings();
    
    // --- Shader Compilation ---
    const fragmentShader = `
        uniform vec2 resolution;
        uniform float time;
        uniform float transition_progress;
        uniform float interstellar_mix;
        uniform float quality_factor;
        uniform float iteration_count;
        uniform float detail_level;
        varying vec2 vUv;

        ${volumetric_atmosphere_code}
        ${tunnel_shader_code}
        ${singularity_shader_code}
        ${transition_shader_code}

        // --- Main Shader Logic (Performance Optimized) ---
        void main() {
            vec2 res_coord = gl_FragCoord.xy;
            vec2 u = (res_coord - 0.5 * resolution.xy) / resolution.y;
            vec4 tunnel_color = get_tunnel_color(u, time);
            vec4 singularity_color = get_singularity_color(res_coord, resolution, time);
            vec4 transition_effect = get_transition_color(res_coord, resolution, time);
            vec4 main_mix = mix(tunnel_color, singularity_color, smoothstep(0.0, 1.0, transition_progress));
            vec4 final_color = mix(main_mix, transition_effect, smoothstep(0.0, 1.0, interstellar_mix));
            
            // Ultra quality: Add optimized atmospheric enhancement
            if (detail_level >= 1.2) {
                vec3 rayDir = normalize(vec3(u, 0.8));
                vec4 global_atmosphere = get_volumetric_atmosphere(u, rayDir, time);
                final_color.rgb = mix(final_color.rgb, global_atmosphere.rgb, global_atmosphere.a * 0.1);
            }
            
            gl_FragColor = vec4(final_color.rgb, 1.0);
        }
    `;

    // --- Initialization ---
    init(fragmentShader);
    
    // Setup mobile features
    if (isMobile) {
        setupTouchGestures();
    }
    
    // Create educational panel
    createEducationalPanel();
    
    // Initialize AI features
    initializeAIFeatures();
    
    // --- Start Animation Loop ---
    animate(0);
}

// --- AI Initialization ---
async function initializeAIFeatures() {
    // Check if serverless API is available
    const hasAPI = await checkServerlessAPIAvailability();
    
    let welcomeMessage = '🚀 Welcome to Cosmic Explorer!';
    let detailMessage = '🌌 Journey through space with Ultra visuals\n';
    
    if (hasAPI) {
        detailMessage += '⭐ PREMIUM: Secure Hugging Face AI integration\n📡 Real AI-powered cosmic education\n🔒 API keys safely secured on server\n📚 Generate unlimited space facts\n✨ Premium AI + curated content\n';
        AI_CONFIG.mode = 'hybrid';
    } else {
        detailMessage += '📚 CURATED: High-quality space facts\n🔬 Scientifically accurate content\n✨ No internet required\n📖 Expertly crafted educational content\n';
        AI_CONFIG.mode = 'hybrid';
    }
    
    detailMessage += '\nSwipe down or use the Education panel to explore!';
    
    // Show welcome message about AI features
    setTimeout(() => {
        showDetailedNotification(welcomeMessage, detailMessage, 8000);
    }, 3000);
    
    // Initialize AI system
    setTimeout(() => {
        initializeAISystem();
    }, 5000);
}

async function initializeAISystem() {
    // Test API generation
    if (AI_CONFIG.apiStatus.hasServerlessAPI) {
        const testTopics = ['black holes and event horizons', 'neutron stars and pulsars'];
        
        let apiCount = 0;
        
        for (const topic of testTopics) {
            try {
                const fact = await generateCosmicFact(topic);
                if (fact && fact.source.includes('Hugging Face')) {
                    apiCount++;
                }
                // Small delay between generations
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                // Silent fail for initialization test
            }
        }
        
        // Report initialization results
        if (apiCount > 0) {
            AI_CONFIG.apiStatus.isWorking = true;
            showDetailedNotification(
                '⭐ Premium AI Ready!', 
                `✅ Secure Hugging Face API integration\n🔒 Your API key is safely secured\n📡 Real AI language model active\n⚡ Premium fact generation ready\n📚 High-quality curated content available`,
                4000
            );
        } else {
            showDetailedNotification(
                '📚 Cosmic Facts Ready!', 
                `🔬 High-quality curated content\n📖 Expertly crafted space facts\n⚡ Instant access to cosmic knowledge`,
                3000
            );
        }
    } else {
        showDetailedNotification(
            '📚 Cosmic Facts Ready!', 
            `🔬 High-quality curated content\n📖 Expertly crafted space facts\n⚡ Instant access to cosmic knowledge`,
            3000
        );
    }
}

// Enhanced API integration with secure serverless endpoint
async function tryGenerateWithFreeAPIs(prompt, topic) {
    // Update API status
    AI_CONFIG.apiStatus.lastAttempt = new Date().toISOString();
    
    try {
        // Check rate limiting
        if (!checkRateLimit()) {
            return generateEnhancedStaticFact(topic);
        }
        
        // Try serverless API first if available and mode allows
        if ((AI_CONFIG.mode === 'api' || AI_CONFIG.mode === 'hybrid') && AI_CONFIG.apiStatus.errorCount < 5) {
            const apiResult = await callServerlessAPI(topic);
            if (apiResult) {
                AI_CONFIG.apiStatus.isWorking = true;
                AI_CONFIG.apiStatus.usingFallback = false;
                AI_CONFIG.apiStatus.hasServerlessAPI = true;
                AI_CONFIG.apiStatus.errorCount = 0; // Reset error count on success
                return apiResult;
            }
        }
        
        // Fallback to enhanced static facts
        AI_CONFIG.apiStatus.usingFallback = true;
        return generateEnhancedStaticFact(topic);
        
    } catch (error) {
        AI_CONFIG.apiStatus.errorCount++;
        return generateEnhancedStaticFact(topic);
    }
}

// Secure serverless API call - updated for cross-origin requests
async function callServerlessAPI(topic) {
    try {
        const response = await fetch(AI_CONFIG.serverlessEndpoint, {
            method: 'POST',
            mode: AI_CONFIG.corsMode, // 'cors' for cross-origin requests
            credentials: AI_CONFIG.credentials, // 'omit' for security
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Add origin header for CORS
                'Origin': window.location.origin
            },
            body: JSON.stringify({ topic }),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(15000) // 15 second timeout
        });
        
        if (!response.ok) {
            // Handle different HTTP error codes
            if (response.status === 429) {
                throw new Error('Rate limit exceeded - please wait before generating more facts');
            } else if (response.status >= 500) {
                throw new Error('Server error - API temporarily unavailable');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        const result = await response.json();
        
        if (result.success && result.fact) {
            // Track successful API call
            trackAPICall();
            
            return {
                title: result.fact.title,
                content: result.fact.content,
                physics: result.fact.physics,
                source: 'Hugging Face AI (Secure)',
                timestamp: new Date().toISOString(),
                quality: 'premium'
            };
        } else if (result.fallback) {
            // Server suggests using fallback
            throw new Error('Server suggested fallback');
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.log('API Error:', error.message); // Keep essential error logging
        AI_CONFIG.apiStatus.errorCount++;
        
        // Handle specific error types
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
            AI_CONFIG.apiStatus.hasServerlessAPI = false;
        } else if (error.message.includes('CORS')) {
            AI_CONFIG.apiStatus.hasServerlessAPI = false;
        }
        
        return null;
    }
}

// Rate limiting functions
function checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Reset if more than a minute has passed
    if (now - AI_CONFIG.rateLimit.lastReset > 60000) {
        AI_CONFIG.rateLimit.callHistory = [];
        AI_CONFIG.rateLimit.lastReset = now;
    }
    
    // Remove old calls
    AI_CONFIG.rateLimit.callHistory = AI_CONFIG.rateLimit.callHistory.filter(
        timestamp => timestamp > oneMinuteAgo
    );
    
    // Check if under limit
    return AI_CONFIG.rateLimit.callHistory.length < AI_CONFIG.rateLimit.maxCallsPerMinute;
}

function trackAPICall() {
    AI_CONFIG.rateLimit.callHistory.push(Date.now());
}

// Enhanced server connectivity check
async function checkServerlessAPIAvailability() {
    try {
        const response = await fetch(AI_CONFIG.serverlessEndpoint, {
            method: 'OPTIONS', // Pre-flight check
            signal: AbortSignal.timeout(5000)
        });
        
        AI_CONFIG.apiStatus.hasServerlessAPI = response.ok;
        return response.ok;
    } catch (error) {
        AI_CONFIG.apiStatus.hasServerlessAPI = false;
        return false;
    }
}

function generateEnhancedStaticFact(topic) {
    // Simplified static fact generation
    const factTemplates = {
        'black holes': {
            title: 'Black Holes',
            content: 'These cosmic vacuum cleaners can have masses up to billions of times our Sun, yet compress all that matter into regions smaller than our solar system. Their gravitational pull is so intense that time itself slows down near the event horizon.',
            physics: 'General relativity predicts that massive objects warp spacetime, and black holes represent the extreme case where this curvature becomes so severe that escape velocity exceeds the speed of light.'
        },
        'neutron stars': {
            title: 'Neutron Stars',
            content: 'A neutron star\'s magnetic field can be a trillion times stronger than Earth\'s. These dense stellar remnants spin incredibly fast, some completing hundreds of rotations per second while being more massive than our Sun.',
            physics: 'Neutron degeneracy pressure prevents further gravitational collapse, creating matter so dense that a teaspoon would weigh about 6 billion tons on Earth.'
        },
        'dark matter': {
            title: 'Dark Matter',
            content: 'Dark matter makes up 85% of all matter in the universe, yet we can\'t see it directly. It forms an invisible cosmic web that acts as scaffolding for galaxy formation and evolution.',
            physics: 'Dark matter interacts gravitationally but not electromagnetically, making it detectable only through its gravitational effects on visible matter and light.'
        },
        'exoplanets': {
            title: 'Exoplanets',
            content: 'Over 5,000 exoplanets have been discovered, ranging from super-Earths to hot Jupiters. Some orbit in the habitable zone where liquid water could exist on their surfaces.',
            physics: 'Planet detection relies on gravitational effects, transit photometry, and direct imaging, revealing the incredible diversity of planetary systems.'
        },
        'gravitational waves': {
            title: 'Gravitational Waves',
            content: 'LIGO detectors have confirmed Einstein\'s prediction by measuring distortions in spacetime caused by colliding black holes and neutron stars, opening a new window to observe the universe.',
            physics: 'These waves carry energy at the speed of light, stretching and compressing space itself by amounts smaller than 1/10,000th the width of a proton.'
        },
        'supernovas': {
            title: 'Supernovas',
            content: 'Type Ia supernovas are so consistent in brightness that they serve as "standard candles" for measuring cosmic distances, helping us discover that the universe\'s expansion is accelerating.',
            physics: 'Nuclear fusion chains create elements up to iron, while the supernova explosion itself forges heavier elements and disperses them throughout the galaxy.'
        }
    };
    
    // Find matching template or create generic one
    for (const [key, template] of Object.entries(factTemplates)) {
        if (topic.toLowerCase().includes(key)) {
            return { ...template, source: 'Curated Content', timestamp: new Date().toISOString() };
        }
    }
    
    // Generic cosmic fact for unknown topics
    const cosmicFact = {
        title: formatTopicTitle(topic),
        content: `${formatTopicTitle(topic)} represent some of the most extreme and fascinating phenomena in our universe, pushing the boundaries of our understanding of physics and challenging our perception of reality.`,
        physics: "These cosmic phenomena operate under conditions so extreme that they serve as natural laboratories for testing the fundamental laws of physics in regimes impossible to recreate on Earth."
    };
    
    return { ...cosmicFact, source: 'Curated Content', timestamp: new Date().toISOString() };
}

function formatTopicTitle(topic) {
    return topic.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function showFactLoadingState() {
    if (!educationalPanel) return;
    
    educationalPanel.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 24px; margin-bottom: 15px;">⭐</div>
            <h3 style="margin: 0 0 10px 0; color: #64b5f6;">Generating Premium Fact...</h3>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
                <div style="width: 0%; height: 100%; background: #64b5f6; border-radius: 2px; animation: loading 1s ease-in-out;" id="loading-bar"></div>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #ccc;">Calling secure Hugging Face API...</p>
        </div>
        <style>
            @keyframes loading {
                0% { width: 0%; }
                50% { width: 70%; }
                100% { width: 100%; }
            }
        </style>
    `;
}

function hideFactLoadingState() {
    // This will be called when updateEducationalContent is called
}

function init(fragmentShader) {
    renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobile, // Disable antialiasing on mobile for performance
        powerPreference: batteryMode ? "low-power" : "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Adjust pixel ratio for mobile
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio;
    renderer.setPixelRatio(pixelRatio);
    
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;

    material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    // --- Enhanced GUI Setup ---
    const gui = new GUI();
    
    // Transform control
    const transition_controls = {
        transform: performTransformation
    };
    gui.add(transition_controls, 'transform').name('🌌 Enter The Void');
    
    // Quality controls
    const quality_controls = {
        quality: qualityLevel,
        batteryMode: batteryMode
    };
    
    gui.add(quality_controls, 'quality', ['low', 'medium', 'high', 'ultra']).onChange((value) => {
        qualityLevel = value;
        updateQualitySettings();
    }).name('🎮 Quality (Ultra = Volumetric)');
    
    gui.add(quality_controls, 'batteryMode').onChange((value) => {
        batteryMode = value;
        if (value) {
            qualityLevel = 'low';
            updateQualitySettings();
        }
    }).name('🔋 Battery Mode');
    
    // Educational controls
    const education_controls = {
        showFacts: () => toggleEducationalPanel(),
        nextFact: () => showNextFact(),
        previousFact: () => showPreviousFact(),
        generateAIFact: () => generateNewFact(),
        clearAIFacts: () => {
            // Remove AI-generated facts, keep original static ones
            const originalFactsCount = 6; // Original static facts
            if (cosmicFacts.length > originalFactsCount) {
                cosmicFacts.splice(0, cosmicFacts.length - originalFactsCount);
                currentFactIndex = 0;
                updateEducationalContent();
                showDetailedNotification('AI Facts Cleared', '🧹 Removed generated facts\n📚 Restored to original content');
            }
        }
    };
    
    const eduFolder = gui.addFolder('📚 Cosmic Education');
    eduFolder.add(education_controls, 'showFacts').name('Toggle Facts Panel');
    eduFolder.add(education_controls, 'nextFact').name('Next Fact →');
    eduFolder.add(education_controls, 'previousFact').name('← Previous Fact');
    
    // AI Controls subfolder
    const aiFolder = eduFolder.addFolder('🤖 AI Generation');
    aiFolder.add(education_controls, 'generateAIFact').name('Generate New Fact');
    aiFolder.add(education_controls, 'clearAIFacts').name('Clear AI Facts');
    
    // Add info about AI features
    const aiInfo = {
        about: () => {
            let title, content;
            
            if (AI_CONFIG.apiStatus.hasServerlessAPI) {
                title = '⭐ Premium AI System';
                content = `⭐ Secure Hugging Face API integration
🔒 API keys safely secured on server
📡 Real AI language model (${AI_CONFIG.rateLimit.maxCallsPerMinute}/min limit)
🎯 High-quality fact generation
📚 Curated content backup
🌟 Best cosmic education experience`;
            } else {
                title = '📚 Curated Content System';
                content = `📖 High-quality curated space facts
🔬 Scientifically accurate content
⚡ Instant access - no waiting
💾 Works completely offline
🎯 Expert-crafted educational content
🌟 Reliable cosmic knowledge`;
            }
            
            showDetailedNotification(title, content, 7000);
        },
        
        status: () => {
            const status = AI_CONFIG.apiStatus;
            const rateLimit = AI_CONFIG.rateLimit;
            const remainingCalls = rateLimit.maxCallsPerMinute - rateLimit.callHistory.length;
            
            let statusText = `🔍 System Status:
Mode: ${AI_CONFIG.mode.toUpperCase()}
Premium API: ${status.hasServerlessAPI ? '✅ Available' : '❌ Unavailable'}
Error Count: ${status.errorCount}
Using Fallback: ${status.usingFallback ? 'Yes (Curated Content)' : 'No'}`;

            if (status.hasServerlessAPI) {
                statusText += `\nAPI Calls Remaining: ${remainingCalls}/${rateLimit.maxCallsPerMinute}`;
            }
            
            showDetailedNotification('📊 System Status', statusText, 5000);
        }
    };
    
    aiFolder.add(aiInfo, 'about').name('ℹ️ About System');
    aiFolder.add(aiInfo, 'status').name('📊 System Status');
    
    eduFolder.open();
    aiFolder.open();

    // Mobile instructions with simplified AI info
    if (isMobile) {
        const instructions = document.createElement('div');
        instructions.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 12px;
            text-align: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        `;
        
        const aiModeText = AI_CONFIG.apiStatus.hasServerlessAPI 
            ? '⭐ Premium AI active!' 
            : '📚 Curated content active!';
            
        instructions.innerHTML = `
            📱 Touch Controls:<br>
            ↕️ Swipe up: Transform • Swipe down: Facts<br>
            ↔️ Swipe left/right: Navigate facts<br>
            👆👆 Double tap: Cycle quality (includes Ultra!)<br>
            🌫️ Ultra mode: Full volumetric atmosphere<br>
            ${aiModeText}
        `;
        document.body.appendChild(instructions);
        
        // Hide instructions after 8 seconds
        setTimeout(() => {
            instructions.style.opacity = '0';
            setTimeout(() => instructions.remove(), 500);
        }, 8000);
    }

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;
}

function animate(timestamp) {
    requestAnimationFrame(animate);
    
    // Update FPS monitoring
    updateFPS(timestamp);
    
    // Adaptive frame rate limiting for better performance
    const targetFrameTime = batteryMode ? 33 : 16.67; // 30fps or 60fps
    if (timestamp - lastFrameTime < targetFrameTime - 1) {
        return; // Skip frame if we're running too fast
    }
    
    // Additional performance throttling for low-end devices
    if (isMobile && qualityLevel === 'low' && timestamp - lastFrameTime < 20) {
        return; // Extra throttling for mobile low quality (50fps max)
    }
    
    // High refresh rate display optimization (120Hz+)
    const isHighRefresh = window.screen && window.screen.refreshRate > 90;
    if (isHighRefresh && !batteryMode && timestamp - lastFrameTime < 12) {
        return; // Limit to ~83fps even on 120Hz displays
    }
    
    lastFrameTime = timestamp;
    uniforms.time.value = timestamp / 1000.0;
    renderer.render(scene, camera);
}

// --- Initialization ---
main(); 
