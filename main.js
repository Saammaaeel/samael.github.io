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
            uniforms.iteration_count.value = isMobile ? 50.0 : 75.0;
            uniforms.detail_level.value = 1.5;
            
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
    
    // Minimal resolution-based scaling (only for very high res)
    const screenArea = window.innerWidth * window.innerHeight;
    const isHighRes = screenArea > 2073600; // 1920x1080
    
    if (isHighRes && !isMobile) {
        uniforms.quality_factor.value *= 0.9;
    }
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
                // Horizontal swipe disabled
                } else {
                // Vertical swipe: swipe up triggers transformation
                if (deltaY < 0) {
                    triggerTransformation();
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

// --- FPS Monitoring (No Auto-Adjust) ---
function updateFPS(timestamp) {
    frameCount++;
    if (timestamp - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = timestamp;
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
    // Highly optimized atmospheric scattering
    vec3 rayleigh_scattering(float cosTheta) {
        float phase = 1.0 + cosTheta * cosTheta;
        return vec3(0.58, 1.35, 3.31) * phase * 0.03; // Reduced intensity
    }

    vec3 mie_scattering(float cosTheta, float g) {
        float g2 = g * g;
        float phase = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
        return vec3(0.4) * phase;
    }

    // Faster noise function using precomputed values
    float noise3D(vec3 p) {
        vec3 p0 = fract(p * 0.1031);
        p0 += dot(p0, p0.yzx + 33.33);
        return fract((p0.x + p0.y) * p0.z);
    }

    // Unrolled FBM for better performance (max 4 octaves)
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amp = 0.5;
        float freq = 1.0;

        // Unroll loops for better GPU performance
        if (octaves >= 1) {
            value += noise3D(p * freq) * amp;
            freq *= 2.0; amp *= 0.5;
        }
        if (octaves >= 2) {
            value += noise3D(p * freq) * amp;
            freq *= 2.0; amp *= 0.5;
        }
        if (octaves >= 3) {
            value += noise3D(p * freq) * amp;
            freq *= 2.0; amp *= 0.5;
        }
        if (octaves >= 4) {
            value += noise3D(p * freq) * amp;
        }

        return value;
    }
    
    vec4 get_volumetric_atmosphere(vec2 uv, vec3 rayDir, float time) {
        vec3 sunDir = normalize(vec3(sin(time * 0.1), 0.8, cos(time * 0.1)));
        float cosTheta = dot(rayDir, sunDir);

        // Optimized atmospheric density calculation
        float altitude = rayDir.y * 0.5 + 0.5;
        float density = exp(-altitude * 2.0); // Reduced multiplier for performance

        // Simplified cloud calculation
        vec3 cloudPos = rayDir * 50.0 + vec3(time * 1.2, time * 0.2, time * 0.8);
        float cloud = 0.0;

        // Quality-based cloud calculation
        if (detail_level >= 0.6) {
            cloud = fbm(cloudPos * 0.02, detail_level >= 1.0 ? 3 : 2);
            cloud = smoothstep(0.3, 0.7, cloud);
        }

        // Ultra quality gets additional cloud layer
        if (detail_level >= 1.2) {
            vec3 cloudPos2 = rayDir * 80.0 + vec3(time * -0.8, time * 0.1, time * 1.2);
            float cloud2 = fbm(cloudPos2 * 0.015, 2);
            cloud += smoothstep(0.4, 0.8, cloud2) * 0.4;
        }

        // Simplified sky color calculation
        vec3 skyColor = mix(
            vec3(1.0, 0.6, 0.3) * (1.0 - altitude), // Horizon
            vec3(0.3, 0.5, 1.0) * altitude,          // Zenith
            altitude
        );

        // Simplified sun disk (only for higher quality)
        vec3 sunColor = vec3(0.0);
        if (detail_level >= 0.8) {
            float sunIntensity = max(0.0, 1.0 - distance(rayDir.xy, sunDir.xy) * 20.0);
            sunColor = vec3(1.0, 0.9, 0.8) * sunIntensity * 8.0;
        }

        // Simplified scattering (only for ultra quality)
        vec3 scatteredLight = vec3(0.0);
        if (detail_level >= 1.2) {
            scatteredLight = rayleigh_scattering(cosTheta) * skyColor * 0.5;
        }

        // Combine colors efficiently
        vec3 cloudColor = mix(vec3(0.9, 0.95, 1.0), vec3(1.0, 0.8, 0.5), max(0.0, cosTheta));
        vec3 finalColor = skyColor + sunColor + scatteredLight;
        finalColor = mix(finalColor, cloudColor, cloud * density);

        // Simplified alpha calculation
        float alpha = density * (0.15 + cloud * 0.4);
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
    vec2 p = (fragCoord + fragCoord - resolution) / resolution.y / 0.7;
    vec2 d = vec2(-1,1);
    float i = 0.2, a;

    vec2 b = p - i*d;
    vec2 c = p * mat2(1, 1, d/(0.1 + i/dot(b,b)));
    vec2 v = c * mat2(cos(0.5*log(a=dot(c,c)) + time*i + vec4(0,33,11,0)))/i;
    vec2 w = vec2(0.0);

    // Quality-based iteration count
    float maxIter = detail_level >= 1.0 ? 7.0 : detail_level >= 0.6 ? 5.0 : 3.0;

    for(float iter = 0.0; iter < 7.0; iter++) {
        if (iter >= maxIter) break;
        w += 1.0 + sin(v);
        v += 0.7 * sin(v.yx * i + time) / i + 0.5;
        i += 0.1;
    }

    float dist = length(sin(v/0.3)*0.4 + c*(3.0+d));

    vec4 O = 1.0 - exp(-exp(c.x * vec4(0.6,-0.4,-1.0,0))
                   / w.xyyx
                   / (2.0 + dist*dist/4.0 - dist)
                   / (0.5 + 1.0 / a)
                   / (0.03 + abs(length(p)-0.7))
             );

    vec4 result = O;

    // Ultra quality: Add volumetric atmospheric effects around singularity
    if (detail_level >= 1.2) {
        vec3 rayDir = normalize(vec3(p, 0.8));
        vec4 atmosphere = get_volumetric_atmosphere(p, rayDir, time);

        // Simplified accretion disk effects
        float diskDist = length(p);
        float diskEffect = exp(-diskDist * 2.0) * 0.2;
        atmosphere.rgb *= (1.0 + diskEffect);

        result = mix(result, atmosphere, atmosphere.a * 0.2);
    }

    return result;
}
`;

const transition_shader_code = `
    vec4 get_transition_color(vec2 fragCoord, vec2 resolution, float time) {
        vec2 uv = (fragCoord / resolution) * 2.0 - 1.0;
        float t = (time - 2.0) * 45.0; // Reduced speed for performance
        vec3 col = vec3(0.0);
        vec3 init = vec3(sin(t * 0.0032) * 0.3, 0.35 - cos(t * 0.005) * 0.3, t * 0.002);

        // Quality-based outer loop count
        int maxR = detail_level >= 1.0 ? 60 : detail_level >= 0.6 ? 40 : 25;
        float stepSize = detail_level >= 1.0 ? 0.025 : 0.035; // Larger steps for lower quality

        for (int r = 0; r < 60; r++) {
            if (r >= maxR) break;

            vec3 p = init + float(r) * stepSize * vec3(uv, 0.05);
            p.z = fract(p.z);

            // Quality-based inner loop count
            int maxI = detail_level >= 1.0 ? 8 : detail_level >= 0.6 ? 6 : 4;

            for (int i = 0; i < 8; i++) {
                if (i >= maxI) break;
                p = abs(p * 2.04) / dot(p, p) - 0.9;
            }

            float v = pow(dot(p, p), 0.7) * 0.06;
            col += vec3(v) * 0.00003;
        }

        vec4 result = tanh(vec4(col, 1.0) / 25.0 / length(uv));

        // Ultra quality: Add volumetric warp effects
        if (detail_level >= 1.2) {
            vec3 rayDir = normalize(vec3(uv, 0.4));
            vec4 atmosphere = get_volumetric_atmosphere(uv, rayDir, time);

            // Simplified warp effects
            float warpStrength = length(col) * 0.03;
            atmosphere.rgb *= (1.0 + warpStrength);

            result = mix(result, atmosphere, atmosphere.a * 0.3);
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
    
    // --- Start Animation Loop ---
    animate(0);
}

 

function init(fragmentShader) {
    renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobile,
        powerPreference: batteryMode ? "low-power" : "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
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
    
    

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;
}

function animate(timestamp) {
    requestAnimationFrame(animate);
    uniforms.time.value = timestamp / 1000.0;
    renderer.render(scene, camera);
}

// --- Initialization ---
main(); 
