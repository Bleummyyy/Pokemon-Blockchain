/* =====  LOCAL POKéMON JSON CACHE  ===== */
const typeIconCache = {};
let pokedexCache = null;          // will hold the entire JSON array
const JSON_URL   = '/pokemondata/pokedex.json';  
// my-nfts.js — ENHANCED VERSION WITH MARKETPLACE INTEGRATION
console.log("my-nfts.js loaded");

// Use var instead of let to avoid redeclaration errors
if (typeof nftContract === 'undefined') {
    var nftContract, pknContract, marketContract;
}

// Contract addresses
const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const PKN_ADDRESS = "0xD7CD2d7Dcb96B9D70A10605F06Ee84C24515D684";
const MARKET_ADDRESS = "0x307e03dF77f93b6B486f07287740EeA01BAE25d0";

// ABIs - ENHANCED WITH MORE FUNCTIONS
const NFT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function getPokemonId(uint256 tokenId) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function pokemonMinted(uint256) view returns (bool)"
];

const PKN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const MARKET_ABI = [
    "function getListing(uint256 tokenId) view returns (tuple(uint256 tokenId, uint256 price, address seller))",
    "function list(uint256 tokenId, uint256 price)",
    "function cancel(uint256 tokenId)",
    "function buy(uint256 tokenId)"
];

// ==== INIT INVENTORY ====
async function initInventory() {
  console.log("initInventory called, userAddress:", window.userAddress);

  /* 1.  load local JSON ONCE (no wallet needed) */
  if (!pokedexCache) {
    try {
      const res = await fetch(JSON_URL);
      pokedexCache = await res.json();           // full array
      console.log('✅ Local pokedex loaded:', pokedexCache.length, 'entries');
    } catch (e) {
      console.warn('⚠️  local JSON missing, will fall back to PokéAPI');
      pokedexCache = [];
    }
  }

  /* 2.  wallet required from here */
  if (!window.ethereum || !window.userAddress) {
    console.log("Wallet not connected");
    alert("Please connect your wallet first!");
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
    pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
    marketContract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);

    /* UI updates */
    updateInventoryUI();
    await updatePKNBalance();
    await loadMyNFTs();

  } catch (err) {
    console.error("Inventory init failed:", err);
    alert("Failed to initialize: " + err.message);
  }
}
// ==== UPDATE INVENTORY UI ====
function updateInventoryUI() {
    if (!window.userAddress) return;
    
    const addressElement = document.getElementById("address");
    const walletInfo = document.getElementById("wallet-info");
    const loginBtn = document.getElementById("login-btn");
    const pknBalance = document.getElementById("pkn-balance");
    
    if (addressElement) addressElement.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
    if (walletInfo) walletInfo.style.display = "block";
    if (loginBtn) loginBtn.style.display = "none";
    if (pknBalance) pknBalance.style.display = "block";
}

// ==== PKN BALANCE ====
async function updatePKNBalance() {
    if (!pknContract || !window.userAddress) return;
    try {
        const bal = await pknContract.balanceOf(window.userAddress);
        const fmt = parseFloat(ethers.utils.formatUnits(bal, 18)).toFixed(2);
        const el = document.getElementById("pkn-amount");
        if (el) el.textContent = fmt;
    } catch (e) { console.warn("PKN balance error:", e); }
}

// ==== LOAD INVENTORY (ENHANCED) ====
// ==== LOAD INVENTORY (FIXED VERSION) ====
// ==== ULTRA-FAST INVENTORY LOADER ====
async function loadMyNFTs() {
    const grid = document.getElementById("nfts-grid");
    if (!grid) return;

    grid.innerHTML = `<p class="loading">🚀 Loading your Pokémon at warp speed...</p>`;

    try {
        console.log("🚀 Starting ultra-fast inventory scan...");
        
        // Step 1: Get total supply to know the range (FAST)
        let maxTokenId = 50; // Default fallback
        try {
            const totalSupply = await nftContract.totalSupply();
            maxTokenId = Math.min(totalSupply.toNumber() + 5, 200); // Scan slightly beyond total supply
            console.log(`📊 Total supply: ${totalSupply.toString()}, scanning to: ${maxTokenId}`);
        } catch (err) {
            console.log("ℹ️ Using default scan range 1-50");
        }

        // Step 2: Check ownership in PARALLEL batches (SUPER FAST)
        const ownedTokens = await findOwnedTokensParallel(maxTokenId);
        
        console.log(`🎯 Found ${ownedTokens.length} owned tokens:`, ownedTokens);

        if (ownedTokens.length === 0) {
            showNoNFTsMessage(grid);
            return;
        }

        // Step 3: Load Pokémon data in PARALLEL (FAST)
        await renderNFTsUltraFast(ownedTokens, grid);

    } catch (err) {
        console.error("Inventory error:", err);
        grid.innerHTML = `<p class="error">Failed to load inventory: ${err.message}</p>`;
    }
}

// ==== FIND OWNED TOKENS IN PARALLEL ====
async function findOwnedTokensParallel(maxTokenId) {
    const ownedTokens = [];
    const BATCH_SIZE = 20; // Process 20 tokens at once
    const userAddress = window.userAddress.toLowerCase();
    
    console.log(`🔍 Scanning tokens 1-${maxTokenId} in parallel batches...`);

    // Create batches
    const batches = [];
    for (let start = 1; start <= maxTokenId; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, maxTokenId);
        batches.push({ start, end });
    }

    // Process batches in parallel
    const batchPromises = batches.map(async (batch) => {
        const batchTokens = [];
        const { start, end } = batch;
        
        // Create promises for this batch
        const tokenPromises = [];
        for (let tokenId = start; tokenId <= end; tokenId++) {
            tokenPromises.push(checkTokenOwnership(tokenId, userAddress));
        }
        
        // Wait for all checks in this batch
        const results = await Promise.allSettled(tokenPromises);
        
        // Collect owned tokens
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                batchTokens.push(result.value);
            }
        });
        
        console.log(`📦 Batch ${start}-${end}: ${batchTokens.length} owned`);
        return batchTokens;
    });

    // Wait for all batches
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten results
    batchResults.forEach(tokens => {
        ownedTokens.push(...tokens);
    });

    return ownedTokens;
}

// ==== CHECK SINGLE TOKEN OWNERSHIP ====
async function checkTokenOwnership(tokenId, userAddress) {
    try {
        // 1️⃣ Always get Pokémon ID first (needed in both cases)
        const pokemonId = await nftContract.getPokemonId(tokenId);

        // 2️⃣ Check current owner
        const owner = await nftContract.ownerOf(tokenId);

        /* ===============================
           CASE A: YOU OWN THE NFT
        =============================== */
        if (owner.toLowerCase() === userAddress) {

            let listingInfo = null;

            try {
                const listing = await marketContract.getListing(tokenId);
                if (listing.price && listing.price.gt(0)) {
                    listingInfo = {
                        price: ethers.utils.formatUnits(listing.price, 18),
                        isListed: true
                    };
                }
            } catch (_) {
                // not listed → normal
            }

            return {
                tokenId,
                pokemonId: pokemonId.toNumber(),
                listingInfo
            };
        }

        /* ===============================
           CASE B: NFT IS LISTED (ESCROW)
           Owner = marketplace, seller = YOU
        =============================== */
        try {
            const listing = await marketContract.getListing(tokenId);

            if (
                listing.price &&
                listing.price.gt(0) &&
                listing.seller &&
                listing.seller.toLowerCase() === userAddress
            ) {
                return {
                    tokenId,
                    pokemonId: pokemonId.toNumber(),
                    listingInfo: {
                        price: ethers.utils.formatUnits(listing.price, 18),
                        isListed: true
                    }
                };
            }
        } catch (_) {
            // Not listed
        }

    } catch (err) {
        // Token does not exist or reverted → ignore
        return null;
    }

    return null;
}


// ==== ULTRA-FAST RENDERER ====
async function renderNFTsUltraFast(ownedTokens, grid) {
    console.log(`🎨 Rendering ${ownedTokens.length} Pokémon in parallel...`);
    grid.innerHTML = "";
    
    // Sort by token ID
    ownedTokens.sort((a, b) => a.tokenId - b.tokenId);
    
    // Show loading progress
    if (ownedTokens.length > 5) {
        grid.innerHTML = `<p class="loading">Loading ${ownedTokens.length} Pokémon...</p>`;
    }

    // Load ALL Pokémon data in parallel
    const nftPromises = ownedTokens.map(async (nft) => {
        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${nft.pokemonId}`);
            if (!response.ok) return null;
            
            const data = await response.json();
            return {
                ...nft,
                name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
                image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
                types: data.types.map(t => t.type.name.toUpperCase()).join(' / ')
            };
        } catch (err) {
            console.warn(`Failed to load Pokémon ${nft.pokemonId}:`, err.message);
            return null;
        }
    });

    // Wait for all Pokémon data
    const nftData = await Promise.all(nftPromises);
    const validNFTs = nftData.filter(nft => nft !== null);
    
    console.log(`✅ Loaded data for ${validNFTs.length} Pokémon`);
    
    // Render all at once (FAST)
    grid.innerHTML = "";
    validNFTs.forEach(nft => {
        const card = createNFTCard(nft);
        grid.appendChild(card);
    });
    
    console.log(`🎉 Rendered ${validNFTs.length} Pokémon cards`);
}

// ==== CREATE NFT CARD (Optimized) ====
function createNFTCard(nft) {
  const card = document.createElement("div");
  card.className = "nft-card";

  /* ----------  card face (NO input / button)  ---------- */
  card.innerHTML = `
      <div class="nft-image-container">
          <img class="sprite" src="${nft.image}" alt="${nft.name}" loading="lazy">
          <div class="nft-rarity">#${nft.pokemonId}</div>
          ${nft.listingInfo?'<div class="listed-badge">LISTED</div>':''}
      </div>

      <div class="nft-info">
          <h3>${nft.name}</h3>
          <p class="types">${Array.isArray(nft.types)?nft.types.join(' / '):nft.types}</p>
          <p class="nft-id">Token ID: ${nft.tokenId}</p>
          ${nft.listingInfo?`<p class="nft-price">Listed for: ${nft.listingInfo.price} PKN</p>`:''}
          <!--  NO list-form here any more -->
      </div>
  `;

  /* ----------  click sprite → pop-up panel  ---------- */
  const img = card.querySelector('.sprite');
  img.addEventListener('click', () => openPanel(nft));

  return card;
}
// ==== NO NFTS MESSAGE ====
function showNoNFTsMessage(grid) {
    grid.innerHTML = `
        <div class="no-nfts">
            <h3>No Pokémon Found</h3>
            <p>You don't own any Pokémon NFTs yet.</p>
            <p>If you just minted, try refreshing the page.</p>
            <div class="action-buttons">
                <a href="marketplace.html" class="cta-button">🎯 Mint Pokémon</a>
            </div>
        </div>`;
}

// ==== RENDER NFTS GRID ====
async function renderNFTsGrid(ownedNFTs, grid) {
    grid.innerHTML = "";
    
    const renderPromises = ownedNFTs.map(async (nft) => {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nft.pokemonId}`);
            if (!res.ok) {
                console.warn(`Failed to fetch Pokémon ${nft.pokemonId}`);
                return null;
            }
            
            const data = await res.json();
            const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);
            const image = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
            const types = data.types.map(t => t.type.name.toUpperCase()).join(' / ');

            const card = document.createElement("div");
            card.className = "nft-card";
            
            if (nft.listingInfo) {
                // Already listed - show cancel option
                card.innerHTML = `
                    <div class="nft-image-container">
                        <img src="${image}" alt="${name}" loading="lazy">
                        <div class="nft-rarity">#${nft.pokemonId}</div>
                        <div class="listed-badge">LISTED</div>
                    </div>  
                    <div class="nft-info">
                        <h3>${name}</h3>
                        <p class="types">${types}</p>
                        <p class="nft-id">Token ID: ${nft.tokenId}</p>
                        <p class="nft-price">Listed for: ${nft.listingInfo.price} PKN</p>
                    </div>
                    <button class="cancel-btn" onclick="cancelListing(${nft.tokenId})">Cancel Listing</button>
                `;
            } else {
                // Not listed - show list option
                card.innerHTML = `
                    <div class="nft-image-container">
                        <img src="${image}" alt="${name}" loading="lazy">
                        <div class="nft-rarity">#${nft.pokemonId}</div>
                    </div>
                    <div class="nft-info">
                        <h3>${name}</h3>
                        <p class="types">${types}</p>
                        <p class="nft-id">Token ID: ${nft.tokenId}</p>
                    </div>
                    <div class="list-form">
                        <input type="number" id="price-${nft.tokenId}" placeholder="Price in PKN" min="1" value="100">
                        <button class="sell-btn" onclick="listForSale(${nft.tokenId})">List for Sale</button>
                    </div>
                `;
            }
            
            return card;
            
        } catch (err) {
            console.warn(`Failed to load Pokémon ${nft.pokemonId}:`, err);
            return null;
        }
    });
    
    const cards = await Promise.all(renderPromises);
    cards.filter(card => card !== null).forEach(card => grid.appendChild(card));
    
    console.log(`🎨 Rendered ${cards.filter(card => card !== null).length} Pokémon cards`);
}



// ==== LIST FOR SALE (ENHANCED) ====
// ==== LIST FOR SALE (FIXED VERSION) ====
async function listForSale(tokenId, pricePKN = null) {
    /* NEW: accept price from panel, fallback to old card input */
    const price = pricePKN ?? document.getElementById(`price-${tokenId}`)?.value;
    if (!price || price <= 0) { 
        alert('Enter a valid price!'); 
        return; 
    }

    try {
        console.log(`Listing token ${tokenId} for ${price} PKN...`);
        const priceWei = ethers.utils.parseUnits(price.toString(), 18);

        // FIX 1: Check NFT approval first (not PKN approval)
        const currentApproval = await nftContract.getApproved(tokenId);
        console.log(`Current NFT approval: ${currentApproval}`);
        
        if (currentApproval.toLowerCase() !== MARKET_ADDRESS.toLowerCase()) {
            console.log("Approving marketplace for NFT transfer...");
            const approveTx = await nftContract.approve(MARKET_ADDRESS, tokenId);
            await approveTx.wait();
            console.log("NFT approval confirmed");
        }

        // FIX 2: Remove PKN approval logic - it's not needed for listing
        // The marketplace only needs NFT approval to transfer the NFT
        // PKN approval is only needed when BUYING, not when listing

        /* list token */
        console.log("Calling marketContract.list...");
        const listTx = await marketContract.list(tokenId, priceWei);
        console.log("Listing transaction sent:", listTx.hash);
        
        await listTx.wait();
        console.log("Listing confirmed!");

        alert(`✅ Listed for ${price} PKN!`);
        await loadMyNFTs();   // refresh cards

    } catch (err) {
        console.error('List error:', err);
        
        if (err.code === 'ACTION_REJECTED') {
            alert("Transaction was rejected by user");
        } else if (err.message.includes('execution reverted')) {
            alert("Listing failed: Contract rejected the transaction. Possible reasons:\n• Already listed\n• Don't own this Pokémon\n• Contract error");
        } else {
            alert("Listing failed: " + (err.reason || err.message));
        }
    }
}

// ==== CANCEL LISTING ====
async function cancelListing(tokenId) {
    if (!confirm("Are you sure you want to cancel this listing?")) return;
    
    try {
        console.log(`Cancelling listing for token ${tokenId}...`);
        const cancelTx = await marketContract.cancel(tokenId);
        await cancelTx.wait();
        
        alert("✅ Listing cancelled successfully!");
        await loadMyNFTs(); // Refresh the display
        
    } catch (err) {
        console.error("Cancel error:", err);
        alert("Cancel failed: " + (err.reason || err.message));
    }
}

// ==== REFRESH INVENTORY ====
async function refreshInventory() {
    console.log("Refreshing inventory...");
    await loadMyNFTs();
    await updatePKNBalance();
}

// Make functions global
window.initInventory = initInventory;
window.listForSale = listForSale;
window.cancelListing = cancelListing;
window.refreshInventory = refreshInventory;

// Auto-init when page loads
window.addEventListener('load', function() {
    console.log("Page loaded, checking user connection...");
    
    if (window.userAddress) {
        console.log("User already connected, initializing inventory...");
        setTimeout(() => {
            if (typeof initInventory === 'function') {
                initInventory();
            }
        }, 1000);
    } else {
        console.log("User not connected");
        const grid = document.getElementById("nfts-grid");
        if (grid) {
            grid.innerHTML = `
                <div class="no-nfts">
                    <p>Please connect your wallet first.</p>
                    <a href="login.html" class="cta-button">Connect Wallet</a>
                </div>`;
        }
    }
});

console.log("my-nfts.js initialization complete");


async function getPokemonData(id) {
  const local = pokedexCache.find(p => p.id === id);
  if (local) return local;                       // use your JSON

  /* fallback to PokéAPI */
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) return null;
  const api = await res.json();
  return {
    id,
    name: { english: api.name },
    type: api.types.map(t => t.type.name),
    base: {
      HP:  api.stats[0].base_stat,
      Attack: api.stats[1].base_stat,
      Defense: api.stats[2].base_stat,
      Speed: api.stats[5].base_stat
    },
    image: {
      sprite: api.sprites.front_default,
      hires: api.sprites.other['official-artwork'].front_default
    }
  };
}


async function openPanel(nft){
  const p = document.getElementById('poke-panel');

  /* 1.  get FULL data (local JSON or API) */
  const data = pokedexCache.find(p => p.id === nft.pokemonId) ?? await getPokemonData(nft.pokemonId);
  if (!data){ alert('Pokémon data not found'); return; }

  /* 2.  animated sprite (PokéDB CDN) */
  const engName = (data.name?.english ?? data.name ?? 'Pokémon').toLowerCase();
  const aniSrc  = `https://img.pokemondb.net/sprites/black-white/anim/normal/${engName}.gif`;
  const imgEl   = document.getElementById('panel-sprite');
  imgEl.src = aniSrc;
  imgEl.onerror = () => { imgEl.src = data.image?.hires ?? nft.image; };

  /* 3.  name & types */
  document.getElementById('panel-name').textContent  = data.name.english;
  const typeStr = Array.isArray(data.type) ? data.type.join(' / ') : data.type;
  /* 3.  type badges (under GIF) */
    const typeDiv = document.getElementById('panel-types');
    typeDiv.innerHTML = '';                       // clear old text
    const typeArr = Array.isArray(data.type) ? data.type : [data.type];
    typeArr.forEach(t => {
    const badge = makeTypeBadge(t);
    typeDiv.appendChild(badge);
    });

  /* 4.  base stats (YOUR JSON capital keys) */
  const base = data.base ?? {};
  setBar('hp',  base.HP      ?? 0, 255);
  setBar('atk', base.Attack  ?? 0, 255);
  setBar('def', base.Defense ?? 0, 255);
  setBar('spd', base.Speed   ?? 0, 255);

  /* 5.  description & profile */
  const descDiv = document.getElementById('panel-desc');
  if (!descDiv){ /* create once */
    document.querySelector('.panel-right').insertAdjacentHTML('beforeend',`
      <div id="panel-desc" style="margin-top:15px;font-size:13px;color:#aaa;"></div>
      <div id="panel-profile" style="margin-top:10px;font-size:12px;color:#888;"></div>`);
  }
  document.getElementById('panel-desc').textContent = data.description ?? '';
  const prof = data.profile ?? {};
  document.getElementById('panel-profile').innerHTML =
    `Height: ${prof.height ?? '?'}  |  Weight: ${prof.weight ?? '?'}<br>
     Gender: ${prof.gender ?? '?'}  |  Abilities: ${(prof.ability ?? []).map(a=>a[0]).join(', ')}`;

  /* 6.  action button */
/* 6.  action button (back inside panel) */
const actionDiv = document.getElementById('panel-action');
if (nft.listingInfo){
  actionDiv.innerHTML = `<button class="cancel-btn" onclick="cancelListing(${nft.tokenId}); closePanel();">Cancel Listing</button>`;
} else {
  actionDiv.innerHTML = `
    <input type="number" id="panel-price" placeholder="Price (PKN)" min="1" value="100">
    <button class="sell-btn" onclick="listFromPanel(${nft.tokenId});">List for Sale</button>`;
}

  p.classList.add('show');
}
function closePanel(){
  document.getElementById('poke-panel').classList.remove('show');
}
function setBar(stat, value, max){
  const pct = Math.min(100, (value / max) * 100);
  document.getElementById('stat-'+stat).style.width = pct + '%';
}
async function listFromPanel(tokenId) {
    const priceInput = document.getElementById('panel-price');
    if (!priceInput) { 
        alert('Price input missing'); 
        return; 
    }

    const price = priceInput.value.trim();
    console.log('🔍 price read:', price, 'type:', typeof price);
    
    if (!price || isNaN(price) || Number(price) <= 0) {
        alert('Enter a valid price!');
        return;
    }

    // Convert to number to ensure clean data
    await listForSale(tokenId, Number(price));
    closePanel();
}
/* English name → official number file */
const TYPE_NUMBER = {
  normal:1, fighting:2, flying:3, poison:4, ground:5, rock:6, bug:7, ghost:8,
  steel:9, fire:10, water:11, grass:12, electric:13, psychic:14, ice:15,
  dragon:16, dark:17, fairy:18
};

function makeTypeBadge(typeName){
  if (typeIconCache[typeName]) return typeIconCache[typeName];

  const num = TYPE_NUMBER[typeName.toLowerCase()];
  if (!num){ console.warn('Unknown type', typeName); return document.createElement('span'); }

  const img = new Image();
  img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/brilliant-diamond-and-shining-pearl/${num}.png`;
  img.className = 'type-badge';
  img.alt = typeName;
  img.onerror = () => { img.remove(); };
  typeIconCache[typeName] = img;
  return img;
}




async function fetchMyListings() {
  const listings = await marketContract.getAllListings();

  return listings.filter(item =>
    item.active &&
    item.seller.toLowerCase() === window.userAddress.toLowerCase()
  );
}
