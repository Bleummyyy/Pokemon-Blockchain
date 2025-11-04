// marketplace.js – INSTANT FILTERS + BACKGROUND LOADING

const PKN_ADDRESS = "0xD7CD2d7Dcb96B9D70A10605F06Ee84C24515D684";
const NFT_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";

const PRICE_MAP = {
  COMMON: 100,
  UNCOMMON: 250,
  RARE: 500,
  EPIC: 1000,
  LEGENDARY: 5000
};

const PKN_ABI = [ /* your ABI */ ];
const NFT_ABI = [ /* your ABI */ ];

let provider, signer;
window.userAddress = null;

window.currentPage = 1;
const perPage = 15;
let totalPokemons = 0;
const maxVisiblePages = 5;

let allPokemons = [];     // All loaded (eventually)
let displayPokemons = []; // Fast-loaded subset (200–300)
let isBackgroundLoading = false;

// === INIT ===
async function initMarketplace() {
  if (!window.ethereum) return alert("Install MetaMask!");

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    window.userAddress = await signer.getAddress();

    window.pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
    window.nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);

    updateWalletUI();
    await loadFastPokemons();     // Load 250 fast
    startBackgroundLoading();     // Load rest in background
    applyFilters();               // Instant render

  } catch (err) {
    alert("Connection failed: " + err.message);
  }
}

// === LOAD 250 POKÉMON FAST (INSTANT UX) ===
async function loadFastPokemons() {
  const grid = document.getElementById("nfts-grid");
  grid.innerHTML = `<p class="loading">Loading Pokémon...</p>`;

  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=250');
    const { results } = await res.json();

    for (let p of results) {
      try {
        const data = await fetch(p.url).then(r => r.json());
        const pokemon = createPokemonObject(data);
        allPokemons.push(pokemon);
        displayPokemons.push(pokemon);
      } catch (err) { /* skip */ }
    }

    filteredPokemons = displayPokemons;
    renderPage(1);
    updatePagination();
    grid.innerHTML = grid.innerHTML; // Clear loading

  } catch (err) {
    grid.innerHTML = `<p class="error">Failed to load.</p>`;
  }
}

// === BACKGROUND: LOAD ALL 1200+ (SILENT) ===
function startBackgroundLoading() {
  if (isBackgroundLoading) return;
  isBackgroundLoading = true;

  (async () => {
    try {
      const countRes = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1');
      totalPokemons = (await countRes.json()).count;

      const chunkSize = 100;
      let offset = 250; // Start after fast load

      while (offset < totalPokemons) {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${chunkSize}&offset=${offset}`);
        const { results } = await res.json();

        for (let p of results) {
          try {
            const data = await fetch(p.url).then(r => r.json());
            const pokemon = createPokemonObject(data);
            allPokemons.push(pokemon);
            // Only add to display if not already there
            if (!displayPokemons.find(p => p.id === pokemon.id)) {
              displayPokemons.push(pokemon);
            }
          } catch (err) { /* skip */ }
        }
        offset += chunkSize;

        // Optional: update progress
        const progress = Math.min(100, Math.floor((offset / totalPokemons) * 100));
        console.log(`Background loading: ${progress}%`);
      }

      // Final merge
      displayPokemons = allPokemons;
      applyFilters(); // Refresh filters with full data
      console.log("All Pokémon loaded in background!");

    } catch (err) {
      console.error("Background load failed:", err);
    } finally {
      isBackgroundLoading = false;
    }
  })();
}

// === CREATE POKÉMON OBJECT ===
function createPokemonObject(data) {
  const baseStats = data.stats.reduce((sum, s) => sum + s.base_stat, 0);
  const typeCount = data.types.length;
  const isLegendary = data.is_legendary || data.is_mythical;

  let rarity = 'COMMON';
  let rarityColor = '#666';

  if (isLegendary || Math.random() < 0.01) {
    rarity = 'LEGENDARY'; rarityColor = '#ff8c00';
  } else if (baseStats > 600) {
    rarity = 'EPIC'; rarityColor = '#9d4edd';
  } else if (baseStats > 500 || typeCount === 1) {
    rarity = 'RARE'; rarityColor = '#4361ee';
  } else if (baseStats > 400) {
    rarity = 'UNCOMMON'; rarityColor = '#2ecc71';
  }

  return {
    id: data.id,
    name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
    image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
    types: data.types.map(t => t.type.name.toUpperCase()),
    rarity, rarityColor,
    price: PRICE_MAP[rarity],
    searchName: data.name.toLowerCase()
  };
}

// === FILTER LOGIC (INSTANT ON displayPokemons) ===
let filteredPokemons = [];

function applyFilterLogic(pokemons) {
  const rarity = document.getElementById("rarity-filter")?.value || "";
  const type = document.getElementById("type-filter")?.value || "";
  const search = document.getElementById("search-input")?.value.toLowerCase().trim() || "";
  const priceSort = document.getElementById("price-filter")?.value || "";

  let filtered = pokemons.filter(p => {
    return (!rarity || p.rarity === rarity) &&
           (!type || p.types.includes(type)) &&
           (!search || p.searchName.includes(search));
  });

  if (priceSort === 'low') filtered.sort((a, b) => a.price - b.price);
  else if (priceSort === 'high') filtered.sort((a, b) => b.price - a.price);

  return filtered;
}

function applyFilters() {
  filteredPokemons = applyFilterLogic(displayPokemons);
  renderPage(1);
  updatePagination();
  window.currentPage = 1;
}

// === RENDER PAGE ===
function renderPage(page) {
  const grid = document.getElementById("nfts-grid");
  const start = (page - 1) * perPage;
  const pageItems = filteredPokemons.slice(start, start + perPage);

  grid.innerHTML = pageItems.length ? "" : `<p class="error">No Pokémon found.</p>`;

  pageItems.forEach(p => {
    const card = document.createElement("div");
    card.className = "nft-card";
    card.innerHTML = `
      <div class="nft-image-container">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <div class="nft-rarity" style="background: ${p.rarityColor};">${p.rarity}</div>
      </div>
      <div class="nft-info">
        <h3 class="nft-name"><span>${p.name}</span></h3>
        <p class="types">${p.types.join(' / ')}</p>
        <p class="nft-price">${p.price} PKN</p>
      </div>
      <button class="buy-btn" onclick="buyNFT(${p.id})">Buy Now</button>
    `;
    grid.appendChild(card);
  });

  window.currentPage = page;
}

// === PAGINATION ===
function updatePagination() {
  const container = document.getElementById("page-numbers");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  if (!container) return;

  container.innerHTML = '';
  const totalPages = Math.ceil(filteredPokemons.length / perPage) || 1;

  prevBtn.disabled = window.currentPage === 1;
  nextBtn.disabled = window.currentPage === totalPages;

  const startPage = Math.max(1, window.currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (startPage > 1) {
    addPageButton(container, 1);
    if (startPage > 2) addEllipsis(container);
  }
  for (let i = startPage; i <= endPage; i++) addPageButton(container, i);
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) addEllipsis(container);
    addPageButton(container, totalPages);
  }
}

function addPageButton(container, pageNum) {
  const btn = document.createElement("button");
  btn.className = "page-number";
  btn.textContent = pageNum;
  if (pageNum === window.currentPage) btn.classList.add("active");
  btn.onclick = () => {
    renderPage(pageNum);
    updatePagination();
  };
  container.appendChild(btn);
}

function addEllipsis(container) {
  const span = document.createElement("span");
  span.className = "page-ellipsis";
  span.textContent = "...";
  container.appendChild(span);
}

window.changePage = function(page) {
  if (page < 1 || page > Math.ceil(filteredPokemons.length / perPage)) return;
  renderPage(page);
  updatePagination();
};

// === BUY NFT ===
async function buyNFT(pokemonId) {
  if (!window.userAddress) return alert("Connect wallet!");

  const pokemon = allPokemons.find(p => p.id === pokemonId) || displayPokemons.find(p => p.id === pokemonId);
  if (!pokemon) return alert("Not found!");

  try {
    const pkn = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);

    const balance = await pkn.balanceOf(window.userAddress);
    if (Number(ethers.formatUnits(balance, 18)) < pokemon.price) {
      return alert(`Need ${pokemon.price} PKN!`);
    }

    await (await pkn.approve(NFT_ADDRESS, ethers.parseUnits(pokemon.price.toString(), 18))).wait();
    await (await nft.mint(pokemonId, `https://pokeapi.co/api/v2/pokemon/${pokemonId}`)).wait();

    alert(`Bought ${pokemon.name} for ${pokemon.price} PKN!`);
    applyFilters();

  } catch (err) {
    alert("Failed: " + (err.reason || err.message));
  }
}

// === UI ===
function updateWalletUI() {
  const info = document.getElementById("wallet-info");
  const addr = document.getElementById("address");
  if (info && addr) {
    info.style.display = "flex";
    addr.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
  }
  const btn = document.querySelector(".login-btn span");
  if (btn) {
    btn.textContent = "Connected";
    document.querySelector(".login-btn").classList.add("connected");
    document.querySelector(".login-btn").disabled = true;
  }
}

window.addEventListener("load", () => {
  if (window.userAddress) updateWalletUI();
});

window.initMarketplace = initMarketplace;
window.applyFilters = applyFilters;