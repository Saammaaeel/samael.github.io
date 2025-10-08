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

    let msgSendingHandler = null;
    let audioContext = null;

    // Initialize audio context
    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Play a simple beep sound
    function playBeep(frequency = 800, duration = 100, type = 'sine') {
        if (!audioContext) initAudio();
        if (!audioContext) return; // Fallback if audio not supported

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    }

    // Play typing sound (subtle)
    function playTypingSound() {
        playBeep(600, 50, 'sine');
    }

    // Play message send sound
    function playMessageSound() {
        playBeep(800, 150, 'sine');
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

        computed: {
            messageGroups() {
                const groups = [];
                let currentGroup = null;

                this.messages.forEach(msg => {
                    if (!currentGroup || currentGroup.author !== msg.author || msg.isTyping) {
                        // Start a new group
                        currentGroup = {
                            author: msg.author,
                            messages: [msg],
                            timestamp: msg.timestamp
                        };
                        groups.push(currentGroup);
                    } else {
                        // Add to current group
                        currentGroup.messages.push(msg);
                        // Update timestamp to latest message
                        currentGroup.timestamp = msg.timestamp;
                    }
                });

                return groups;
            }
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
                const content = getRandomMsg(message);
                const length = content.replace(/<[^>]+>/g,"").length;
                const isImg = /<img[^>]+>/.test(content);
                const isTyping = length > 2 || isImg;

                const msg = {
                    author: author,
                    content: isTyping ? TYPING_MSG_CONTENT : content,
                    isImg: isImg,
                    isTyping: isTyping,
                    timestamp: new Date()
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
