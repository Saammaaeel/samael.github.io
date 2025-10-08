(function () {

    const AUTHOR = {
        AUTHOR: 'author',
        ME: 'me'
    };

    const TYPING_MSG_CONTENT = `
        <div class="typing-indicator">
            <span class="typing-text">Ndut is typing</span>
            <div class="typing-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;

    // Special messages for romance
    const LOVE_NOTES = {
        poem1: `i have searched for you in the sea, the skies, in the rain and even at the end of every rainbow.
if necessary, i will cross galaxies, worlds, stars and the whole universes until i find you.
you are my dream, you are my illusion, and the day i find you,
 i'll take you by the hand to know all the incredible worlds that i discovered when i looked for you.`,

        poem2: `i want to lay my face in your hands and close my eyes.
your hands - those tiny hands.
so much smaller than mine.
how i long to touch you - because i never have, and never will.
not in this lifetime.

so... i want to believe that parallel universes do exist.
and just may be in one of them, i do get to touch you.`
    };

    // Memory game questions and answers
    const MEMORY_GAME = {
        "which song that you played for my birthday": "ps i love you by paul partohap"
    };

    // Particle system for effects
    let particleCanvas = null;
    let particleCtx = null;
    let particles = [];
    let animationId = null;

    let msgSendingHandler = null;
    let audioContext = null;
    let backgroundMusic = null;
    let musicStarted = false;

    // Initialize audio context and background music
    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Start background music
    function startBackgroundMusic() {
        if (musicStarted) return;

        if (!backgroundMusic) {
            backgroundMusic = new Audio('/anniv/moon.mp3');
            backgroundMusic.loop = true;
            backgroundMusic.volume = 0.85; // Set to 30% volume for subtle background music
            
            // Add error handling for file not found
            backgroundMusic.addEventListener('error', (e) => {
                console.error('Failed to load background music:', e);
                console.error('Please ensure moon.mp3 exists in /anniv/ directory');
            });
            
            backgroundMusic.addEventListener('loadeddata', () => {
                console.log('Background music loaded successfully');
            });
        }

        // Play music after user interaction
        backgroundMusic.play().then(() => {
            musicStarted = true;
            console.log('Background music started playing');
        }).catch(err => {
            console.error('Background music failed to play:', err);
            console.error('File path: /anniv/moon.mp3');
        });
    }

    // Play a simple beep sound
    function playBeep(frequency = 800, duration = 100, type = 'sine', volume = 0.02) {
        if (!audioContext) initAudio();
        if (!audioContext) return; // Fallback if audio not supported

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    }

    // Play typing sound (very subtle now)
    function playTypingSound() {
        playBeep(600, 30, 'sine', 0.015); // Reduced volume from 0.1 to 0.015
    }

    // Play message send sound
    function playMessageSound() {
        playBeep(800, 100, 'sine', 0.03); // Reduced volume from 0.1 to 0.03
    }

    // Create particle effects
    function initParticles() {
        if (particleCanvas) return; // Already initialized

        particleCanvas = document.createElement('canvas');
        particleCanvas.id = 'particle-canvas';
        particleCanvas.style.position = 'fixed';
        particleCanvas.style.top = '0';
        particleCanvas.style.left = '0';
        particleCanvas.style.width = '100%';
        particleCanvas.style.height = '100%';
        particleCanvas.style.pointerEvents = 'none';
        particleCanvas.style.zIndex = '1000';

        document.body.appendChild(particleCanvas);

        particleCtx = particleCanvas.getContext('2d');
        resizeCanvas();

        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        if (!particleCanvas) return;
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }

    function createParticles(type, count = 20) {
        if (!particleCanvas) initParticles();

        const emojis = {
            hearts: ['❤️', '💖', '💕', '💗', '💓'],
            stars: ['⭐', '✨', '🌟', '💫', '🌠'],
            petals: ['🌸', '🌺', '🌹', '🌷', '🌼']
        };

        const selectedEmojis = emojis[type] || emojis.hearts;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * particleCanvas.width,
                y: particleCanvas.height + 50,
                vx: (Math.random() - 0.5) * 4,
                vy: -(Math.random() * 3 + 2),
                life: 1,
                emoji: selectedEmojis[Math.floor(Math.random() * selectedEmojis.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1
            });
        }

        if (!animationId) {
            animateParticles();
        }
    }

    function animateParticles() {
        if (!particleCtx || !particleCanvas) return;

        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

        particles = particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // gravity
            particle.life -= 0.005;
            particle.rotation += particle.rotationSpeed;

            if (particle.life > 0) {
                particleCtx.save();
                particleCtx.globalAlpha = particle.life;
                particleCtx.translate(particle.x, particle.y);
                particleCtx.rotate(particle.rotation);
                particleCtx.font = '20px Arial';
                particleCtx.textAlign = 'center';
                particleCtx.fillText(particle.emoji, 0, 0);
                particleCtx.restore();
                return true;
            }
            return false;
        });

        if (particles.length > 0) {
            animationId = requestAnimationFrame(animateParticles);
        } else {
            animationId = null;
        }
    }

    // Encrypt/decrypt message effect
    function encryptMessage(text) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        return text.split('').map(char => {
            if (char === ' ') return ' ';
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
    }

    function decryptMessage(encryptedText, originalText) {
        let currentText = encryptedText;
        let step = 0;
        const maxSteps = 20;

        const decryptStep = () => {
            if (step >= maxSteps) return originalText;

            currentText = currentText.split('').map((char, index) => {
                if (char === ' ') return ' ';
                if (char === originalText[index]) return char;
                if (Math.random() < 0.3) return originalText[index];
                return encryptMessage(char)[0];
            }).join('');

            step++;
            setTimeout(decryptStep, 50);
            return currentText;
        };

        return decryptStep();
    }

    const vm = new Vue({
        el: '#mobile',

        data: {
            messages: [],
            dialogs: null,
            lastDialog: null,
            msgChain: Promise.resolve(),

            isTyping: false,

            // topics that user can ask
            nextTopics: [],

            hasPrompt: false,

            latestMsgContent: null
        },


        mounted() {
            $.getJSON('/anniv/assets/dialog.json', data => {
                this.dialogs = data;

                this.nextTopics = this.dialogs.fromUser;

                this.appendDialog('0000');
            });
        },

        methods: {
            formatTimestamp(timestamp) {
                if (!timestamp) return '';
                const now = new Date();
                const time = new Date(timestamp);
                const diff = now - time;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);

                if (minutes < 1) return 'now';
                if (minutes < 60) return `${minutes}m ago`;
                if (hours < 24) return `${hours}h ago`;
                return `${days}d ago`;
            },
            appendDialog(id) {
                if (typeof id === 'object' && id.length > 0) {
                    // array of dialog ids
                    id.forEach(id => this.appendDialog(id));
                    return;
                }
                else if (id == null) {
                    // clear possible responses
                    this.lastDialog.responses = null;
                    return;
                }

                this.isTyping = true;

                const dialog = this.getDialog(id);

                getRandomMsg(dialog.details)
                    .forEach(content => {
                        this.msgChain = this.msgChain
                            .then(() => delay(700))
                            .then(() => this.sendMsg(content, AUTHOR.AUTHOR));
                    });

                return dialog.nextAuthor
                    ? this.appendDialog(dialog.nextAuthor)
                    : this.msgChain.then(() => {
                        this.lastDialog = dialog;
                        this.isTyping = false;
                    });
            },

            sendMsg(message, author) {
                switch (author) {
                    case 'me':
                        return this.sendUserMsg(message);
                    default:
                        return this.sendFriendMsg(message, author);
                }
            },

            sendFriendMsg(message, author) {
                let content = getRandomMsg(message);
                let isPoemMessage = false;

                // Handle special commands and dialog content
                if (typeof message === 'string') {
                    const lowerMessage = message.toLowerCase().trim();

                    // Check for poem commands (from dialog or direct commands)
                    if (lowerMessage === 'poem1' || lowerMessage.includes('first poem')) {
                        content = LOVE_NOTES.poem1;
                        isPoemMessage = true;
                    } else if (lowerMessage === 'poem2' || lowerMessage.includes('second poem')) {
                        content = LOVE_NOTES.poem2;
                        isPoemMessage = true;
                    }

                    // Check for particle effects
                    if (lowerMessage.includes('hearts') || lowerMessage.includes('love')) {
                        setTimeout(() => createParticles('hearts', 15), 1000);
                    } else if (lowerMessage.includes('stars')) {
                        setTimeout(() => createParticles('stars', 12), 1000);
                    } else if (lowerMessage.includes('petals') || lowerMessage.includes('flowers')) {
                        setTimeout(() => createParticles('petals', 18), 1000);
                    }

                    // Check for encryption (just for fun visual effect)
                    if (lowerMessage.includes('encrypt') || lowerMessage.includes('secret')) {
                        const originalContent = content;
                        content = encryptMessage(content);
                        setTimeout(() => {
                            // Trigger decryption animation
                            const msgElement = document.querySelector('.msg-row:last-child .msg');
                            if (msgElement) {
                                decryptMessage(content, originalContent);
                                msgElement.textContent = originalContent;
                            }
                        }, 2000);
                    }
                }

                const length = content.replace(/<[^>]+>/g,"").length;
                const isImg = /<img[^>]+>/.test(content);
                let isTyping = length > 2 || isImg;

                // Poems and memory game questions appear instantly
                if (isPoemMessage || content.includes('Memory Game Time') || content.includes('Which song did You play')) {
                    isTyping = false;
                }

                const msg = {
                    author: author,
                    content: isTyping ? TYPING_MSG_CONTENT : content,
                    isImg: isImg,
                    isTyping: isTyping,
                    timestamp: new Date(),
                    isPoem: isPoemMessage
                };
                this.messages.push(msg);

                if (isTyping) {
                    this.markMsgSize(msg);
                    setTimeout(updateScroll);

                    // Calculate more realistic typing speed based on message length
                    // Shorter messages: faster base speed, longer messages: slower but more consistent
                    const baseTypingSpeed = length < 20 ? 80 : length < 50 ? 60 : 45;
                    const typingTime = Math.min(baseTypingSpeed * length + Math.random() * 500, 3000);

                    return delay(typingTime)
                        .then(() => {
                            // For text-only messages, use typewriter effect
                            if (!isImg) {
                                return this.typewriterEffect(msg, content);
                            } else {
                                return this.markMsgSize(msg, content);
                            }
                        })
                        .then(() => delay(150))
                        .then(() => {
                            if (!msg.typewriterComplete) {
                                msg.content = content;
                            }
                            msg.isTyping = false;
                            onMessageSending();
                        });
                }

                onMessageSending();

                return Promise.resolve();
            },

            sendUserMsg(message) {
                this.messages.push({
                    author: AUTHOR.ME,
                    content: message,
                    timestamp: new Date()
                });

                onMessageSending();

                return Promise.resolve();
            },

            typewriterEffect(msg, fullContent) {
                return new Promise(resolve => {
                    let currentIndex = 0;
                    const text = fullContent.replace(/<[^>]+>/g, ''); // Remove HTML tags for typing
                    const typingSpeed = 50; // milliseconds per character

                    const typeNextChar = () => {
                        if (currentIndex < text.length) {
                            currentIndex++;
                            msg.content = fullContent.substring(0, currentIndex);
                            msg.typewriterComplete = false;
                            this.messages = [...this.messages];

                            // Play typing sound for each character (but not too frequently)
                            if (currentIndex % 3 === 0) {
                                playTypingSound();
                            }

                            setTimeout(typeNextChar, typingSpeed + Math.random() * 30); // Add some randomness
                        } else {
                            msg.content = fullContent;
                            msg.typewriterComplete = true;
                            resolve();
                        }
                    };

                    typeNextChar();
                });
            },

            markMsgSize(msg, content = null) {
                this.latestMsgContent = content || msg.content;

                return delay(0)
                    .then(() => msg.isImg && onImageLoad($('#mock-msg img')))
                    .then(() => {
                        // No need to set width/height with flexbox layout
                        this.messages = [...this.messages];
                    });
            },

            getDialog(id) {
                // only one dialog should be matched by id
                const dialogs = this.dialogs.fromMe
                    .filter(dialog => dialog.id === id);
                return dialogs ? dialogs[0] : null;
            },

            getDialogFromUser(id) {
                // only one dialog should be matched by id
                const dialogs = this.dialogs.fromUser
                    .filter(dialog => dialog.id === id);
                return dialogs ? dialogs[0] : null;
            },

            togglePrompt(toShow) {
                if (this.isTyping) {
                    // don't prompt if author is typing
                    return;
                }

                this.hasPrompt = toShow;
            },

            respond(response) {
                return this.say(response.content, response.nextAuthor);
            },

            ask(fromUser) {
                const content = getRandomMsg(fromUser.details);
                return this.say(content, fromUser.nextAuthor);
            },

            addReaction(msg, emoji) {
                if (!msg.reactions) {
                    msg.reactions = [];
                }

                const index = msg.reactions.indexOf(emoji);
                if (index > -1) {
                    // Remove reaction if it already exists
                    msg.reactions.splice(index, 1);
                } else {
                    // Add reaction
                    msg.reactions.push(emoji);
                }

                // Force Vue to update
                this.messages = [...this.messages];
            },

            say(content, dialogId) {
                // close prompt
                this.hasPrompt = false;

                // Start background music on first user interaction
                startBackgroundMusic();

                return delay(200)
                    // send user msg
                    .then(() => this.sendMsg(content, AUTHOR.ME))
                    .then(() => delay(300))
                    // add author's next dialogs
                    .then(() => this.appendDialog(dialogId));
            }
        }
    });


    /**
     * get a random message from message array
     */
    function getRandomMsg(messages) {
        // single item
        if (typeof messages === 'string' || !messages.length) {
            return messages;
        }

        const id = Math.floor(Math.random() * messages.length);
        return messages[id];
    }


    /**
     * UI updating when new message is sending
     */
    function onMessageSending() {
        // Play message send sound
        playMessageSound();

        setTimeout(() => {
            // update scroll position when vue has updated ui
            updateScroll();

            const $latestMsg = $('#mobile-body-content .msg-row:last-child .msg');

            // add target="_blank" for links
            $latestMsg.find('a').attr('target', '_blank');

            // update scroll position when images are loaded
            onImageLoad($latestMsg).then(updateScroll);
        });
    }

    function updateScroll() {
        const $chatbox = $('#mobile-body-content');

        const distance = $chatbox[0].scrollHeight - $chatbox.height() - $chatbox.scrollTop();

        // Only scroll if there's a significant distance to scroll
        if (Math.abs(distance) > 10) {
            const duration = 400; // Slightly longer for smoother feel
            const startTime = Date.now();
            const startScrollTop = $chatbox.scrollTop();

            // Use easing function for smoother animation
            function easeOutCubic(t) {
                return 1 - Math.pow(1 - t, 3);
            }

            requestAnimationFrame(function step() {
                const elapsed = Date.now() - startTime;
                const p = Math.min(1, elapsed / duration);
                const easedP = easeOutCubic(p);

                $chatbox.scrollTop(startScrollTop + distance * easedP);

                if (p < 1) {
                    requestAnimationFrame(step);
                }
            });
        }
    }

    function delay(amount = 0) {
        return new Promise(resolve => {
            setTimeout(resolve, amount);
        });
    }

    function getMockMsgSize() {
        const $mockMsg = $('#mock-msg');
        return {
            width: $mockMsg.width(),
            height: $mockMsg.height()
        };
    }

    function onImageLoad($img) {
        return new Promise(resolve => {
            $img.one('load', resolve)
                .each((index, target) => {
                    // trigger load when the image is cached
                    target.complete && $(target).trigger('load');
                });
        });
    }

})();
