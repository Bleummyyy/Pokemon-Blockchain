/* =======================
   BLOCKCHAIN CONFIG
======================= */

const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const NFT_ABI = [
    "function getPokemonId(uint256 tokenId) view returns (uint256)"
];

/* =======================
   LOAD PLAYER + ENEMY
======================= */

document.addEventListener("DOMContentLoaded", async () => {
    await loadBattlePokemon();    // player
    await loadOpponentPokemon();  // enemy
});

async function getPokemonNumberFromToken(tokenId) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
    const num = await nft.getPokemonId(tokenId);
    return num.toNumber();
}

async function loadBattlePokemon() {
    const tokenId = localStorage.getItem("selectedPokemonToken");
    if (!tokenId) return;

    const pokemonNumber = await getPokemonNumberFromToken(tokenId);
    const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonNumber}`).then(r => r.json());
    const name = data.name.toLowerCase();

    const gif = `https://img.pokemondb.net/sprites/black-white/anim/normal/${name}.gif`;

    const img = document.querySelector("#playerPokemon img");
    img.src = gif;
    img.style.transform = "scaleX(-1)"; // mirror player ONLY
}

async function loadOpponentPokemon() {
    const randomId = Math.floor(Math.random() * 493) + 1;
    const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${randomId}`).then(r => r.json());
    const name = data.name.toLowerCase();

    const gif = `https://img.pokemondb.net/sprites/black-white/anim/normal/${name}.gif`;

    const img = document.querySelector("#opponentPokemon img");
    img.src = gif;
    img.style.transform = "scaleX(1)";
}

/* =======================
   CARD SYSTEM
======================= */

const cardTypeMap = {
    attack: "attack",
    element: "element",
    heal: "heal",
    stolemovement: "speed-steal"
};

let stackCount = 0;
let cardQueue = [];

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".axie-card").forEach(card => {
        const src = card.querySelector("img").src;
        let type = "element";

        for (let key in cardTypeMap) {
            if (src.includes(key)) type = cardTypeMap[key];
        }

        card.onclick = () => playCard(card, src, type);
    });

    document.getElementById("endTurnBtn").onclick = endTurn;
});

function playCard(card, src, type) {
    card.classList.add("card-playing");

    setTimeout(() => {
        const stacked = document.createElement("div");
        stacked.className = "stacked-card";
        stacked.innerHTML = `<img src="${src}">`;

        stacked.style.top = `${stackCount * 18}px`;
        stacked.style.left = `${stackCount * 18}px`;
        stacked.style.zIndex = stackCount;

        document.getElementById("stackedCards").appendChild(stacked);
        cardQueue.push({ type });

        stackCount++;
        document.getElementById("stackCount").textContent = stackCount;
        card.remove();
    }, 400);
}

function endTurn() {
    if (!cardQueue.length) return alert("No cards to play!");
    playCardSequence(0, resetTurn);
}

function resetTurn() {
    cardQueue = [];
    stackCount = 0;
    document.getElementById("stackCount").textContent = "0";
    document.getElementById("stackedCards").innerHTML = "";
}

function playCardSequence(i, done) {
    if (i >= cardQueue.length) return setTimeout(done, 400);

    playBattleAnimation(cardQueue[i].type);

    setTimeout(() => playCardSequence(i + 1, done), 1200);
}

/* =======================
   🔥 SINGLE ANIMATION FUNCTION
======================= */

/* =======================
   SINGLE ANIMATION DISPATCHER
   (USES YOUR EXISTING CSS)
======================= */

function playBattleAnimation(type) {
    const playerWrap = document.getElementById("playerPokemon");
    const enemyWrap  = document.getElementById("opponentPokemon");
    const arena      = document.querySelector(".battle-arena");

    const player = playerWrap?.querySelector("img");
    const enemy  = enemyWrap?.querySelector("img");

    if (!player || !enemy || !arena) return;

    /* ================= ATTACK ================= */
    if (type === "attack") {
        player.classList.add("attacking");

        setTimeout(() => {
            const impact = document.createElement("div");
            impact.className = "impact-effect battle-effect";

            const e = enemyWrap.getBoundingClientRect();
            impact.style.left = `${e.left + e.width / 2 - 40}px`;
            impact.style.top  = `${e.top + e.height / 2 - 40}px`;

            document.body.appendChild(impact);
            enemy.classList.add("hit-shake");

            setTimeout(() => {
                impact.remove();
                enemy.classList.remove("hit-shake");
            }, 400);
        }, 300);

        setTimeout(() => player.classList.remove("attacking"), 800);
    }

    /* ================= ELEMENT (FIXED) ================= */
    if (type === "element") {
        const p = playerWrap.getBoundingClientRect();
        const a = arena.getBoundingClientRect();

        /* MAGIC CHARGE */
        const charge = document.createElement("div");
        charge.className = "magic-charge magic-circle battle-effect";
        charge.style.left = `${p.left - a.left + p.width / 2 - 40}px`;
        charge.style.top  = `${p.top - a.top + p.height / 2 - 40}px`;
        arena.appendChild(charge);

        setTimeout(() => charge.remove(), 600);

        /* ELEMENT AURA (WITH SVG — THIS WAS MISSING) */
        setTimeout(() => {
            const aura = document.createElement("div");
            aura.className = "element-magic-aura battle-effect";

            aura.innerHTML = `
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <defs>
                        <radialGradient id="auraGrad">
                            <stop offset="0%" stop-color="#FFD93D"/>
                            <stop offset="30%" stop-color="#FF6B6B"/>
                            <stop offset="60%" stop-color="#4ECDC4"/>
                            <stop offset="100%" stop-color="#A78BFA"/>
                        </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#auraGrad)" opacity="0.9"/>
                </svg>
            `;

            aura.style.left = `${p.left - a.left - 200}px`;
            aura.style.top  = `${p.top - a.top + p.height / 2 - 50}px`;

            arena.appendChild(aura);

            setTimeout(() => aura.remove(), 1400);
        }, 300);
    }

    /* ================= HEAL ================= */
    if (type === "heal") {
        const p = playerWrap.getBoundingClientRect();

        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const heal = document.createElement("div");
                heal.className = "heal-particle battle-effect";
                heal.style.left = `${p.left + p.width / 2 + (Math.random() * 80 - 40)}px`;
                heal.style.top  = `${p.top + p.height / 2}px`;
                document.body.appendChild(heal);
                setTimeout(() => heal.remove(), 1500);
            }, i * 120);
        }
    }

    /* ================= SPEED STEAL ================= */
    if (type === "speed-steal") {
        playerWrap.classList.add("pokemon-float-up");
        enemyWrap.classList.add("pokemon-float-down");

        const p = playerWrap.getBoundingClientRect();
        const e = enemyWrap.getBoundingClientRect();

        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const part = document.createElement("div");
                part.className = "gravity-particle particle-up battle-effect";
                part.style.left = `${p.left + p.width / 2 + (Math.random() * 80 - 40)}px`;
                part.style.top  = `${p.top + p.height / 2}px`;
                document.body.appendChild(part);
                setTimeout(() => part.remove(), 1200);
            }, i * 80);
        }

        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const part = document.createElement("div");
                part.className = "gravity-particle particle-down battle-effect";
                part.style.left = `${e.left + e.width / 2 + (Math.random() * 80 - 40)}px`;
                part.style.top  = `${e.top + e.height / 2}px`;
                document.body.appendChild(part);
                setTimeout(() => part.remove(), 1200);
            }, i * 80);
        }

        setTimeout(() => {
            playerWrap.classList.remove("pokemon-float-up");
            enemyWrap.classList.remove("pokemon-float-down");
        }, 1500);
    }
}
