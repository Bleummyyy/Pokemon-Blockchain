/* =======================
   BLOCKCHAIN CONFIG
======================= */

const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const NFT_ABI = [
    "function getPokemonId(uint256 tokenId) view returns (uint256)"
];

/* =======================
   GLOBAL STATE
======================= */

const cardTypeMap = {
    attack: "attack",
    element: "element",
    heal: "heal",
    stolemovement: "speed-steal"
};

const CARD_POOL = ["attack", "element", "heal", "stolemovement"];

let stackCount = 0;
let cardQueue = [];
let turnLocked = false;
let round = 1;

/* =======================
   CARD LIMITS
======================= */

const MAX_CARDS_PER_TURN = 3;
const MAX_HAND_SIZE = 7;
let cardsPlayedThisTurn = 0;

/* =======================
   HEALTH SYSTEM
======================= */

let playerHP = 0;
let playerMaxHP = 0;
let enemyHP = 0;
let enemyMaxHP = 0;

/* =======================
   SPEED SYSTEM
======================= */

let playerSpeed = 0;
let enemySpeed = 0;
let firstAttacker = null;

/* =======================
   ENERGY SYSTEM
======================= */

let energy = 2;
const MAX_ENERGY = 10;
const ENERGY_PER_ROUND = 2;
const CARD_COST = 1;

/* =======================
   AI OPPONENT STATE
======================= */

let enemyCardQueue = [];
let enemyEnergy = 2;
let enemyCardsPlayedThisTurn = 0;

/* =======================
   INIT
======================= */

document.addEventListener("DOMContentLoaded", async () => {
    await loadBattlePokemon();
    await loadOpponentPokemon();

    initCards();
    updateRoundUI();
    updateEnergyUI();
    drawCards(2);

    document.getElementById("endTurnBtn").onclick = endTurn;
});

/* =======================
   UI UPDATERS
======================= */

function updateRoundUI() {
    const el = document.querySelector(".round-counter");
    if (el) el.textContent = `Round ${round}`;
}

function updateEnergyUI() {
    const span = document.querySelector(".energy-display span");
    if (span) span.textContent = `${energy} / ${MAX_ENERGY}`;
}

function updateHealthBar(side, hp, maxHp) {
    const bar = document.querySelector(
        side === "player"
            ? ".player .health-bar-fill"
            : ".enemy .health-bar-fill"
    );
    if (!bar) return;

    const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    bar.style.width = percent + "%";
    bar.textContent = `${Math.max(0, Math.floor(hp))} / ${maxHp}`;
}

/* =======================
   ENERGY LOGIC
======================= */

function gainEnergy() {
    energy = Math.min(MAX_ENERGY, energy + ENERGY_PER_ROUND);
    updateEnergyUI();
}

/* =======================
   POKEMON LOADERS
======================= */

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

    const img = document.querySelector("#playerPokemon img");
    img.src = `https://img.pokemondb.net/sprites/black-white/anim/normal/${data.name}.gif`;
    img.style.transform = "scaleX(-1)";

    const baseHP = data.stats.find(s => s.stat.name === "hp").base_stat;
    playerMaxHP = baseHP * 5;
    playerHP = playerMaxHP;

    playerSpeed = data.stats.find(s => s.stat.name === "speed").base_stat;

    updateHealthBar("player", playerHP, playerMaxHP);
}

async function loadOpponentPokemon() {
    const randomId = Math.floor(Math.random() * 493) + 1;
    const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${randomId}`).then(r => r.json());

    const img = document.querySelector("#opponentPokemon img");
    img.src = `https://img.pokemondb.net/sprites/black-white/anim/normal/${data.name}.gif`;

    const baseHP = data.stats.find(s => s.stat.name === "hp").base_stat;
    enemyMaxHP = baseHP * 5;
    enemyHP = enemyMaxHP;

    enemySpeed = data.stats.find(s => s.stat.name === "speed").base_stat;

    updateHealthBar("enemy", enemyHP, enemyMaxHP);
}

/* =======================
   CARD SYSTEM
======================= */

function initCards() {
    document.querySelectorAll(".axie-card").forEach(card => {
        const src = card.querySelector("img").src;
        let type = "element";

        for (let key in cardTypeMap) {
            if (src.includes(key)) type = cardTypeMap[key];
        }

        card.dataset.type = type;
        card.onclick = () => playCard(card, src, type);
    });
}

function drawCards(amount = 1) {
    const hand = document.querySelector(".card-hand");

    for (let i = 0; i < amount; i++) {
        if (hand.children.length >= MAX_HAND_SIZE) return;

        const key = CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)];
        const type = cardTypeMap[key];
        const src = `assets/images/cards/${key}.png`;

        const card = document.createElement("div");
        card.className = "axie-card";
        card.dataset.type = type;
        card.innerHTML = `<img src="${src}">`;

        card.onclick = () => playCard(card, src, type);
        hand.appendChild(card);
    }
}

/* =======================
   CARD PLAY
======================= */

function playCard(card, src, type) {
    if (turnLocked) return;

    if (cardsPlayedThisTurn >= MAX_CARDS_PER_TURN) {
        alert("You can only play 3 cards per turn!");
        return;
    }

    if (energy < CARD_COST) {
        alert("Not enough energy!");
        return;
    }

    energy -= CARD_COST;
    updateEnergyUI();

    cardsPlayedThisTurn++;
    card.classList.add("used", "card-playing");
    turnLocked = true;

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
        card.remove();
        turnLocked = false;
    }, 400);
}

/* =======================
   AI CARD LOGIC
======================= */

function enemyDrawCards() {
    enemyCardQueue = [];
    enemyCardsPlayedThisTurn = 0;

    const amount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < amount; i++) {
        enemyCardQueue.push(enemyChooseCard());
    }
}

function enemyChooseCard() {
    if (enemyHP < enemyMaxHP * 0.35) return "heal";

    const roll = Math.random();
    if (roll < 0.45) return "attack";
    if (roll < 0.75) return "element";
    return "speed-steal";
}

/* =======================
   TURN CONTROL
======================= */

function decideFirstAttacker() {
    if (playerSpeed > enemySpeed) firstAttacker = "player";
    else if (enemySpeed > playerSpeed) firstAttacker = "enemy";
    else firstAttacker = Math.random() < 0.5 ? "player" : "enemy";
}

function endTurn() {
    if (!cardQueue.length) {
        alert("No cards to play!");
        return;
    }

    turnLocked = true;
    decideFirstAttacker();
    enemyDrawCards();

    setTimeout(() => {
        executeBattleTurns(resetTurn);
    }, 1200);
}

function executeBattleTurns(done) {
    if (firstAttacker === "player") {
        playPlayerSequence(() => playEnemySequence(done));
    } else {
        playEnemySequence(() => playPlayerSequence(done));
    }
}

function playPlayerSequence(cb) {
    playCardSequence(0, cb);
}

function playEnemySequence(done) {
    let i = 0;
    function next() {
        if (i >= enemyCardQueue.length) return setTimeout(done, 400);
        playEnemyAnimation(enemyCardQueue[i]);
        i++;
        setTimeout(next, 1200);
    }
    next();
}

function resetTurn() {
    cardQueue = [];
    stackCount = 0;
    cardsPlayedThisTurn = 0;
    turnLocked = false;

    document.getElementById("stackedCards").innerHTML = "";

    round++;
    updateRoundUI();
    gainEnergy();
    drawCards(2);
}

/* =======================
   CARD SEQUENCE
======================= */

function playCardSequence(i, done) {
    if (i >= cardQueue.length) return setTimeout(done, 400);
    playBattleAnimation(cardQueue[i].type);
    setTimeout(() => playCardSequence(i + 1, done), 1200);
}

/* =======================
   BATTLE ANIMATIONS
======================= */

/* =======================
   BATTLE ANIMATIONS (FULL)
======================= */

function playBattleAnimation(type) {
    const playerWrap = document.getElementById("playerPokemon");
    const enemyWrap  = document.getElementById("opponentPokemon");
    const arena      = document.querySelector(".battle-arena");

    const player = playerWrap?.querySelector("img");
    const enemy  = enemyWrap?.querySelector("img");
    if (!player || !enemy || !arena) return;

    /* =======================
       ATTACK
    ======================= */
    if (type === "attack") {
        player.classList.add("attacking");
        setTimeout(() => player.classList.remove("attacking"), 800);

        enemy.classList.add("hit-shake");
        setTimeout(() => enemy.classList.remove("hit-shake"), 350);

        enemyHP -= 20;
        updateHealthBar("enemy", enemyHP, enemyMaxHP);
    }

    /* =======================
       ELEMENT
    ======================= */
    if (type === "element") {
        const p = playerWrap.getBoundingClientRect();
        const e = enemyWrap.getBoundingClientRect();
        const a = arena.getBoundingClientRect();

        const px = p.left - a.left + p.width / 2;
        const py = p.top  - a.top + p.height / 2;
        const ex = e.left - a.left + e.width / 2;
        const ey = e.top  - a.top + e.height / 2;

        /* === CORE AURA === */
        const aura = document.createElement("div");
        aura.className = "element-magic-aura battle-effect";
        aura.style.left = `${px - 50}px`;
        aura.style.top  = `${py - 50}px`;
        arena.appendChild(aura);

        /* === CHARGE RUNES === */
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const rune = document.createElement("div");
                rune.className = "battle-effect";
                rune.style.left = `${px - 20 + Math.random() * 40}px`;
                rune.style.top  = `${py - 20 + Math.random() * 40}px`;
                arena.appendChild(rune);
                setTimeout(() => rune.remove(), 800);
            }, i * 80);
        }

        /* === IMPACT === */
        setTimeout(() => {
            enemy.classList.add("hit-shake");

            for (let i = 0; i < 14; i++) {
                const spark = document.createElement("div");
                spark.className = "strike-particle battle-effect";
                spark.style.left = `${ex}px`;
                spark.style.top  = `${ey}px`;
                spark.style.setProperty("--tx", `${Math.random() * 200 - 100}px`);
                spark.style.setProperty("--ty", `${Math.random() * 200 - 100}px`);
                arena.appendChild(spark);
                setTimeout(() => spark.remove(), 700);
            }

            setTimeout(() => enemy.classList.remove("hit-shake"), 350);
        }, 900);

        setTimeout(() => aura.remove(), 1300);

        enemyHP -= 30;
        updateHealthBar("enemy", enemyHP, enemyMaxHP);
    }

    /* =======================
       HEAL
    ======================= */
    if (type === "heal") {
        const p = playerWrap.getBoundingClientRect();
        const a = arena.getBoundingClientRect();
        const px = p.left - a.left + p.width / 2;
        const py = p.top  - a.top + p.height / 2;

        playerWrap.classList.add("pokemon-float-up");

        for (let i = 0; i < 14; i++) {
            setTimeout(() => {
                const orb = document.createElement("div");
                orb.className = "heal-particle battle-effect";
                orb.style.left = `${px + (Math.random() * 100 - 50)}px`;
                orb.style.top  = `${py + (Math.random() * 60 - 30)}px`;
                arena.appendChild(orb);
                setTimeout(() => orb.remove(), 1500);
            }, i * 90);
        }

        setTimeout(() => {
            playerWrap.classList.remove("pokemon-float-up");
        }, 1600);

        playerHP = Math.min(playerMaxHP, playerHP + 25);
        updateHealthBar("player", playerHP, playerMaxHP);
    }

    /* =======================
       SPEED STEAL
    ======================= */
    if (type === "speed-steal") {
        const p = playerWrap.getBoundingClientRect();
        const e = enemyWrap.getBoundingClientRect();
        const a = arena.getBoundingClientRect();

        playerWrap.classList.add("pokemon-float-up");
        enemyWrap.classList.add("pokemon-float-down", "hit-shake");

        for (let i = 0; i < 28; i++) {
            setTimeout(() => {
                const t = i / 28;
                const x = e.left - a.left + e.width / 2 +
                          (p.left - e.left) * t;
                const y = e.top - a.top + e.height / 2 +
                          (p.top - e.top) * t;

                const particle = document.createElement("div");
                particle.className = "gravity-particle battle-effect";
                particle.style.left = `${x}px`;
                particle.style.top  = `${y}px`;
                arena.appendChild(particle);
                setTimeout(() => particle.remove(), 1200);
            }, i * 60);
        }

        setTimeout(() => {
            playerWrap.classList.remove("pokemon-float-up");
            enemyWrap.classList.remove("pokemon-float-down", "hit-shake");
        }, 1700);

        enemySpeed = Math.max(0, enemySpeed - 10);
        playerSpeed += 10;

        enemyHP -= 15;
        playerHP = Math.min(playerMaxHP, playerHP + 15);

        updateHealthBar("enemy", enemyHP, enemyMaxHP);
        updateHealthBar("player", playerHP, playerMaxHP);
    }

    /* =======================
       END CHECK
    ======================= */
    if (enemyHP <= 0) {
        setTimeout(() => alert("Enemy defeated!"), 600);
    }
}


function playEnemyAnimation(type) {
    if (type === "attack") playerHP -= 20;
    if (type === "element") playerHP -= 30;
    if (type === "heal") enemyHP = Math.min(enemyMaxHP, enemyHP + 25);
    if (type === "speed-steal") {
        playerSpeed -= 10;
        enemySpeed += 10;
        playerHP -= 15;
        enemyHP += 15;
    }

    updateHealthBar("player", playerHP, playerMaxHP);
    updateHealthBar("enemy", enemyHP, enemyMaxHP);

    if (playerHP <= 0) alert("You were defeated!");
}



