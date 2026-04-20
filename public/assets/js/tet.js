/**
 * Premium System Tết Effects - HTBMMO
 */
class TetEffects {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'tet-effects-container';
        this.container.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999; overflow:hidden;';
        document.body.appendChild(this.container);

        // Fallback to relative path if TET_ASSETS_PATH is not defined
        const basePath = typeof TET_ASSETS_PATH !== 'undefined' ? TET_ASSETS_PATH : 'assets/images/tet/';

        this.symbols = [
            { src: basePath + 'hoa-dao.svg', size: 20 },
            { src: basePath + 'hoa-mai.svg', size: 20 },
            { src: basePath + 'li-xi.svg', size: 30 },
            { src: basePath + 'dong-tien.svg', size: 18 },
            { src: basePath + 'la-mai.svg', size: 15 }
        ];
        this.maxItems = 25; // Performance optimized limit
        this.activeItems = 0;

        this.init();
        this.initMusic();
    }

    init() {
        this.addStyles();
        this.addBanners();

        setInterval(() => {
            if (this.activeItems < this.maxItems) {
                this.createFallingItem();
            }
        }, 600);
    }

    initMusic() {
        // YouTube Player API
        const videoId = 'R8FSGz_h_lI';
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            const playerDiv = document.createElement('div');
            playerDiv.id = 'tet-music-player';
            playerDiv.style.cssText = 'position:fixed; top:-999px; left:-999px; opacity:0; pointer-events:none;';
            document.body.appendChild(playerDiv);

            this.player = new YT.Player('tet-music-player', {
                height: '0',
                width: '0',
                videoId: videoId,
                playerVars: {
                    'autoplay': 1,
                    'loop': 1,
                    'playlist': videoId,
                    'controls': 0,
                    'mute': 0
                },
                events: {
                    'onReady': (event) => {
                        const savedState = this.loadState();
                        const startVolume = savedState ? savedState.volume : 30;
                        const startTime = savedState ? savedState.time : 0;

                        event.target.setVolume(startVolume);

                        // Try autoplay
                        if (startTime > 0) {
                            event.target.seekTo(startTime, true);
                        }

                        event.target.playVideo();

                        // Add interaction listener for browsers blocking autoplay
                        const startOnInteraction = () => {
                            event.target.playVideo();
                            document.removeEventListener('click', startOnInteraction);
                            document.removeEventListener('keydown', startOnInteraction);
                        };
                        document.addEventListener('click', startOnInteraction);
                        document.addEventListener('keydown', startOnInteraction);

                        this.createMusicToggle(startVolume);

                        // Sync loop every 1s
                        setInterval(() => this.saveState(), 1000);
                    }
                }
            });
        };
    }

    saveState() {
        if (!this.player || typeof this.player.getCurrentTime !== 'function') return;
        try {
            const state = {
                time: this.player.getCurrentTime(),
                volume: this.player.getVolume(),
                isPlaying: this.player.getPlayerState() === 1, // 1 is PLAYING
                timestamp: Date.now()
            };
            localStorage.setItem('tet_music_state', JSON.stringify(state));
        } catch (e) { }
    }

    loadState() {
        try {
            const data = localStorage.getItem('tet_music_state');
            if (!data) return null;
            const state = JSON.parse(data);
            // Ignore if state is older than 30s (indicates fresh start)
            if (Date.now() - state.timestamp > 30000) return null;
            return state;
        } catch (e) { return null; }
    }

    createMusicToggle(startVolume = 30) {
        // Target the support button container to place music toggle before it
        const supportContainer = document.querySelector('.fixed.bottom-8.right-8');
        if (!supportContainer) {
            // Fallback if container not found
            setTimeout(() => this.createMusicToggle(), 500);
            return;
        }

        const musicWrapper = document.createElement('div');
        musicWrapper.id = 'tet-music-wrapper';
        musicWrapper.className = 'flex flex-row items-center gap-2 mb-3';
        musicWrapper.style.cssText = 'pointer-events: auto; transform: translateX(-10px);';

        musicWrapper.innerHTML = `
            <div id="tet-volume-panel" style="display:none; opacity:0; transform:translateX(20px); transition:all 0.3s ease;" 
                 class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-gold-tet shadow-xl flex items-center gap-3 mr-1">
                <button id="tet-play-toggle" class="text-red-700 hover:scale-110 transition-transform">
                    <span id="tet-play-icon" style="font-size: 16px;">⏸</span>
                </button>
                <input type="range" id="tet-volume-slider" min="0" max="100" value="${startVolume}" 
                       style="width:80px; height:4px; accent-color:#b11313; cursor:pointer;">
                <span id="tet-volume-percent" class="text-[10px] font-bold text-red-700 w-6">${startVolume}%</span>
            </div>
            <button id="tet-music-main-btn" 
                    class="w-12 h-12 bg-[#b11313] border-2 border-[#ffd700] rounded-full flex items-center justify-center text-[#ffd700] shadow-lg shadow-red-900/20 active:scale-95 transition-all">
                <span style="font-size: 18px; line-height: 1;">♪</span>
            </button>
        `;

        // Style the custom slider
        const style = document.createElement('style');
        style.textContent = `
            .border-gold-tet { border-color: #ffd700; }
            #tet-volume-slider::-webkit-slider-runnable-track { background: #eee; border-radius: 2px; }
            #tet-volume-slider::-webkit-slider-thumb { margin-top: -6px; }
            #tet-music-main-btn:hover { transform: scale(1.05); }
            #tet-music-main-btn.muted { opacity: 0.6; filter: grayscale(0.5); }
        `;
        document.head.appendChild(style);

        supportContainer.prepend(musicWrapper);

        const mainBtn = musicWrapper.querySelector('#tet-music-main-btn');
        const panel = musicWrapper.querySelector('#tet-volume-panel');
        const playToggle = musicWrapper.querySelector('#tet-play-toggle');
        const playIcon = musicWrapper.querySelector('#tet-play-icon');
        const slider = musicWrapper.querySelector('#tet-volume-slider');
        const percent = musicWrapper.querySelector('#tet-volume-percent');

        let panelVisible = false;
        mainBtn.onclick = (e) => {
            e.stopPropagation();
            panelVisible = !panelVisible;
            if (panelVisible) {
                panel.style.display = 'flex';
                setTimeout(() => {
                    panel.style.opacity = '1';
                    panel.style.transform = 'translateX(0)';
                }, 10);
            } else {
                panel.style.opacity = '0';
                panel.style.transform = 'translateX(20px)';
                setTimeout(() => panel.style.display = 'none', 300);
            }
        };

        let isPlaying = true;
        playToggle.onclick = () => {
            if (isPlaying) {
                this.player.pauseVideo();
                playIcon.innerHTML = '▶';
                mainBtn.classList.add('muted');
            } else {
                this.player.playVideo();
                playIcon.innerHTML = '⏸';
                mainBtn.classList.remove('muted');
            }
            isPlaying = !isPlaying;
        };

        slider.oninput = (e) => {
            const val = e.target.value;
            this.player.setVolume(val);
            percent.textContent = val + '%';
        };

        // Close panel when clicking outside
        document.addEventListener('click', () => {
            if (panelVisible) {
                panelVisible = false;
                panel.style.opacity = '0';
                panel.style.transform = 'translateX(20px)';
                setTimeout(() => panel.style.display = 'none', 300);
            }
        });
        panel.onclick = (e) => e.stopPropagation();
    }

    addStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes music-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            #tet-music-main-btn {
                animation: music-pulse 2s infinite ease-in-out;
            }
            @keyframes fall {
                0% { transform: translateY(-50px) rotate(0deg) translateX(0); opacity: 0; }
                10% { opacity: 1; }
                100% { transform: translateY(110vh) rotate(720deg) translateX(40px); opacity: 0.2; }
            }
            @keyframes swaying {
                0% { transform: rotate(-2.5deg); }
                100% { transform: rotate(2.5deg); }
            }
            .tet-banner-container {
                position: fixed;
                top: 0;
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                height: 100vh;
                animation: swaying 4s ease-in-out infinite alternate;
                transform-origin: top center;
                will-change: transform;
            }
            .tet-left { left: 40px; }
            .tet-right { right: 40px; }
            
            .tet-banner {
                margin-top: 40px;
                width: 80px; /* Reduced size */
                background: #b11313;
                background-image: 
                    radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.12) 1.5px, transparent 2px),
                    radial-gradient(circle at 50% 50%, rgba(255, 0, 0, 0.15) 0%, #8b0000 100%);
                background-size: 15px 15px, 100% 100%;
                border: 2px solid #ffd700;
                border-radius: 2px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 35px 3px 15px 3px;
                position: relative;
                will-change: transform;
            }

            .tet-banner::after {
                content: '';
                position: absolute;
                bottom: -6px;
                width: 108%;
                height: 12px;
                background: linear-gradient(to bottom, #b8860b, #ffd700, #b8860b);
                border-radius: 6px;
                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            }

            .tet-banner::before {
                content: '◈';
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                width: 40px;
                height: 40px;
                background: radial-gradient(circle at 30% 30%, #ffd700, #b11313 75%);
                border: 1.5px solid #ffd700;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffd700;
                font-size: 20px;
                font-weight: bold;
                z-index: 2;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            }

            .tet-banner-string {
                width: 4px;
                height: 100px;
                background: repeating-linear-gradient(-45deg, #ffd700, #ffd700 2px, #b8860b 2px, #b8860b 4px);
                box-shadow: 1px 0 3px rgba(0,0,0,0.3);
                margin-bottom: -20px;
            }

            .tet-banner .text-group {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            .tet-banner span {
                color: #ffd700;
                font-family: 'Playfair Display', serif;
                font-weight: 800;
                font-size: 18px; /* Slightly smaller font */
                text-align: center;
                line-height: 1;
                text-transform: uppercase;
                text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
                white-space: nowrap;
            }
            @media (max-width: 1500px) {
                .tet-banner-container { transform: scale(0.75); transform-origin: top center; }
                .tet-left { left: 20px; }
                .tet-right { right: 20px; }
            }
            @media (max-width: 1100px) {
                .tet-banner-container { display: none; }
            }
        `;
        document.head.appendChild(style);
    }

    addBanners() {
        const formatText = (text) => {
            const words = text.split(' ');
            return `<div class="text-group">${words.map(w => `<span>${w}</span>`).join('')}</div>`;
        };

        const createBanner = (side, text) => {
            const container = document.createElement('div');
            container.className = `tet-banner-container tet-${side}`;

            const string = document.createElement('div');
            string.className = 'tet-banner-string';

            const banner = document.createElement('div');
            banner.className = 'tet-banner';
            banner.innerHTML = formatText(text);

            container.appendChild(string);
            container.appendChild(banner);
            document.body.appendChild(container);
        };

        createBanner('left', 'TIỀN VÀO NHƯ NƯỚC');
        createBanner('right', 'LỘC ĐẾN ĐẦY KHO');
    }

    createFallingItem() {
        this.activeItems++;
        const symbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        const item = document.createElement('img');

        const startX = Math.random() * window.innerWidth;
        const duration = 6500 + Math.random() * 5500;
        const size = (symbol.size + Math.random() * 12);
        const rotation = Math.random() * 360;

        item.src = symbol.src;
        item.style.cssText = `
            position: absolute;
            top: -50px;
            left: ${startX}px;
            width: ${size}px;
            height: auto;
            opacity: ${0.8 + Math.random() * 0.2};
            user-select: none;
            will-change: transform;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
            animation: fall ${duration}ms linear forwards;
            zIndex: 9999;
            transform: rotate(${rotation}deg);
        `;

        this.container.appendChild(item);

        setTimeout(() => {
            item.remove();
            this.activeItems--;
        }, duration);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TetEffects();
});
