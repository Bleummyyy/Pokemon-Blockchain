// marketplace.js - FIXED VERSION (no totalSupply dependency)
// ==== LOAD PROTECTION ====
let isLoadingMarketplace = false;
let hasLoadedMarketplace = false;

let nftContract, pknContract, marketContract;
let listedNFTs = [];
let currentPage = 1;
const itemsPerPage = 20;

// Contract addresses
const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const PKN_ADDRESS = "0xD7CD2d7Dcb96B9D70A10605F06Ee84C24515D684";
const MARKET_ADDRESS = "0x307e03dF77f93b6B486f07287740EeA01BAE25d0";


// Pokémon rarity tiers
const POKEMON_RARITY = {
    COMMON: {
        range: [1, 100],
        chance: 0.70,
        color: "#aaa"
    },
    UNCOMMON: {
        range: [101, 250],
        chance: 0.20,
        color: "#00d1ff"
    },
    RARE: {
        range: [251, 400],
        chance: 0.07,
        color: "#ff6b35"
    },
    EPIC: {
        range: [401, 500],
        chance: 0.025,
        color: "#ffd700"
    },
    LEGENDARY: {
        range: [501, 1025],
        chance: 0.005,
        color: "#ff00ff"
    }
};

// Prices for different mint options (100 PKN each as per contract)
const MINT_PRICES = {
    1: ethers.utils.parseUnits("100", 18),  // 100 PKN
    5: ethers.utils.parseUnits("500", 18),  // 500 PKN  
    10: ethers.utils.parseUnits("1000", 18) // 1000 PKN
};

// ABIs - REMOVED totalSupply
const NFT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getPokemonId(uint256 tokenId) view returns (uint256)", 
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function pokemonMinted(uint256) view returns (bool)",
    "function mint(uint256 pokemonId, string calldata uri) external",
    "function PRICE() view returns (uint256)",
    "function tokenIdCounter() view returns (uint256)"
];

const PKN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const MARKET_ABI = [
    "function getListing(uint256 tokenId) view returns (tuple(uint256 tokenId, uint256 price, address seller))",
    "function buy(uint256 tokenId)",
    "function getActiveListings() view returns (uint256[])"
];

// ==== INIT MARKETPLACE ====
// ==== INIT MARKETPLACE (WITH PROTECTION) ====
let isInitializing = false;

async function initMarketplace() {
    console.log("🚀 initMarketplace called");
    
    // Prevent multiple initializations
    if (isInitializing) {
        console.log("⏸️  Already initializing, skipping...");
        return;
    }
    
    if (!window.ethereum || !window.userAddress) {
        console.log("❌ Wallet not connected yet");
        return;
    }

    isInitializing = true;

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
        pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
        marketContract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);

        window.nftContract = nftContract;
        window.pknContract = pknContract;
        window.marketContract = marketContract;

        updateMarketplaceUI();
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("Marketplace init failed:", err);
    } finally {
        isInitializing = false;
    }
}

// ==== UPDATE MARKETPLACE UI ====
function updateMarketplaceUI() {
    if (!window.userAddress) return;
    
    // Update wallet info in navbar
    const addressElement = document.getElementById("address");
    const walletInfo = document.getElementById("wallet-info");
    const loginBtn = document.getElementById("login-btn");
    const pknBalance = document.getElementById("pkn-balance");
    
    if (addressElement) {
        addressElement.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
    }
    if (walletInfo) {
        walletInfo.style.display = "block";
    }
    if (loginBtn) {
        loginBtn.style.display = "none";
    }
    if (pknBalance) {
        pknBalance.style.display = "block";
    }
}

// ==== LOAD MARKETPLACE (FIXED - NO TOTALSUPPLY) ====
// ==== LOAD MARKETPLACE (WITH LOAD PROTECTION) ====
// ==== OPTIMIZED LOAD MARKETPLACE (FAST VERSION) ====
async function loadMarketplace() {
    console.log("🔄 loadMarketplace called");
    
    if (isLoadingMarketplace) return;
    isLoadingMarketplace = true;
    
    const grid = document.getElementById("nfts-grid");
    if (!grid || !nftContract) {
        isLoadingMarketplace = false;
        return;
    }

    try {
        grid.innerHTML = `<p class="loading">Loading Pokémon Marketplace...</p>`;
        listedNFTs = [];
        
        console.log("⚡ Starting FAST marketplace load...");

        // METHOD 1: Try to get active listings directly from marketplace (FASTEST)
        let listedCount = await tryFastMarketplaceLoad();
        
        // METHOD 2: If fast method fails, use optimized batch checking
        if (listedCount === 0) {
            listedCount = await tryOptimizedBatchLoad();
        }

        // RENDER RESULTS
        renderMarketplaceGrid(listedCount);

    } catch (err) {
        console.error("❌ Marketplace load error:", err);
        grid.innerHTML = `<p class="error">Failed to load marketplace: ${err.message}</p>`;
    } finally {
        isLoadingMarketplace = false;
    }
}

// ==== FAST METHOD: Get active listings directly ====
async function tryFastMarketplaceLoad() {
    try {
        console.log("🚀 Trying fast marketplace load...");
        
        if (!marketContract) return 0;
        
        // Try to get all listed NFTs at once (if your contract supports this)
        const activeListings = await marketContract.getActiveListings();
        console.log(`📊 Fast method found ${activeListings.length} active listings`);
        
        let validListings = 0;
        
        // Process listings in parallel for maximum speed
        const listingPromises = activeListings.map(async (tokenIdBN) => {
            const tokenId = tokenIdBN.toNumber();
            
            try {
                // Skip if we already processed this token
                if (listedNFTs.some(nft => nft.tokenId === tokenId)) return null;
                
                const listing = await marketContract.getListing(tokenId);
                
                // Validate listing
                if (!listing.price.gt(0) || listing.seller === ethers.constants.AddressZero) {
                    return null;
                }
                
                // ⚠️ REMOVE THIS FILTER - Your listings should show in marketplace!
                // if (listing.seller.toLowerCase() === window.userAddress.toLowerCase()) {
                //     return null;
                // }
                
                const pokemonId = await nftContract.getPokemonId(tokenId);
                return { tokenId, pokemonId: pokemonId.toNumber(), listing };
                
            } catch (err) {
                return null; // Skip errors
            }
        });
        
        const validListingsData = (await Promise.all(listingPromises)).filter(Boolean);
        
        // Fetch Pokémon data in parallel
        const pokemonPromises = validListingsData.map(async (data) => {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${data.pokemonId}`);
                if (!res.ok) return null;
                
                const pokemonData = await res.json();
                return {
                    tokenId: data.tokenId,
                    pokemonId: data.pokemonId,
                    name: pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1),
                    image: pokemonData.sprites.other['official-artwork'].front_default || pokemonData.sprites.front_default,
                    types: pokemonData.types.map(t => t.type.name.toUpperCase()).join(' / '),
                    price: ethers.utils.formatUnits(data.listing.price, 18),
                    owner: data.listing.seller,
                    isListed: true
                };
            } catch (err) {
                return null;
            }
        });
        
        const nftDataArray = (await Promise.all(pokemonPromises)).filter(Boolean);
        listedNFTs.push(...nftDataArray);
        
        console.log(`✅ Fast method loaded ${nftDataArray.length} valid listings`);
        return nftDataArray.length;
        
    } catch (err) {
        console.log("⚠️ Fast method failed, falling back to batch method:", err.message);
        return 0;
    }
}

// ==== OPTIMIZED BATCH METHOD: Check only minted Pokémon ====
async function tryOptimizedBatchLoad() {
    console.log("🔄 Using optimized batch load...");
    
    let listedCount = 0;
    const batchSize = 50; // Process in batches for better performance
    const maxPokemonToCheck = 151; // Only check Gen 1 for speed
    
    // Get total supply to know how many tokens exist
    let totalSupply = maxPokemonToCheck;
    try {
        const supply = await nftContract.totalSupply();
        totalSupply = Math.min(supply.toNumber(), maxPokemonToCheck);
    } catch (err) {
        console.log("⚠️ Could not get total supply, using default limit");
    }
    
    console.log(`🔍 Checking first ${totalSupply} Pokémon...`);
    
    // Process in batches for better performance
    for (let batchStart = 1; batchStart <= totalSupply; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, totalSupply);
        
        const batchPromises = [];
        
        // Create promises for this batch
        for (let pokemonId = batchStart; pokemonId <= batchEnd; pokemonId++) {
            batchPromises.push(processSinglePokemon(pokemonId));
        }
        
        // Wait for entire batch to complete
        const batchResults = await Promise.all(batchPromises);
        const validNFTs = batchResults.filter(Boolean);
        
        listedNFTs.push(...validNFTs);
        listedCount += validNFTs.length;
        
        console.log(`📦 Batch ${batchStart}-${batchEnd}: ${validNFTs.length} listed`);
        
        // Update loading progress
        updateLoadingProgress(batchEnd, totalSupply);
    }
    
    return listedCount;
}

// ==== PROCESS SINGLE POKEMON (Optimized) ====
async function processSinglePokemon(pokemonId) {
    try {
        // Check if minted first
        const isMinted = await nftContract.pokemonMinted(pokemonId);
        if (!isMinted) return null;
        
        const tokenId = pokemonId;
        
        // Check if listed
        const listing = await marketContract.getListing(tokenId);
        if (!listing.price.gt(0)) return null;
        
        const owner = await nftContract.ownerOf(tokenId);
        if (owner.toLowerCase() === window.userAddress.toLowerCase()) return null;
        
        // Fetch Pokémon data
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        if (!res.ok) return null;
        
        const data = await res.json();
        
        return {
            tokenId,
            pokemonId,
            name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
            image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
            types: data.types.map(t => t.type.name.toUpperCase()).join(' / '),
            price: ethers.utils.formatUnits(listing.price, 18),
            owner: listing.seller,
            isListed: true
        };
        
    } catch (err) {
        return null; // Skip all errors
    }
}

// ==== RENDER MARKETPLACE GRID ====
function renderMarketplaceGrid(listedCount) {
    const grid = document.getElementById("nfts-grid");
    grid.innerHTML = "";
    
    console.log(`🎨 Rendering ${listedCount} Pokémon...`);
    
    for (const nft of listedNFTs) {
        const card = document.createElement("div");
        card.className = "nft-card";
        card.innerHTML = `
            <div class="nft-image-container">
                <img src="${nft.image}" alt="${nft.name}" loading="lazy">
                <div class="nft-rarity">#${nft.pokemonId}</div>
                <div class="listed-badge">FOR SALE</div>
            </div>
            <div class="nft-info">
                <h3 class="nft-name">${nft.name}</h3>
                <p class="types">${nft.types}</p>
                <p class="nft-price">${nft.price} PKN</p>
                <p class="nft-owner">Seller: ${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}</p>
            </div>
            <button class="buy-btn" onclick="buyListedNFT(${nft.tokenId})">Buy Now</button>
        `;
        grid.appendChild(card);
    }
    
    console.log(`✅ Marketplace loaded: ${listedCount} Pokémon`);
    
    if (listedCount === 0) {
        grid.innerHTML = `
            <div class="no-nfts">
                <h3>🏪 Marketplace Empty</h3>
                <p>No Pokémon are currently listed for sale.</p>
            </div>`;
    } else {
        applyFilters();
    }
}

// ==== LOADING PROGRESS INDICATOR ====
function updateLoadingProgress(current, total) {
    const grid = document.getElementById("nfts-grid");
    const progress = Math.round((current / total) * 100);
    
    if (grid && progress < 100) {
        grid.innerHTML = `
            <div class="loading" style="text-align: center; padding: 40px;">
                <h3>Loading Marketplace...</h3>
                <div style="width: 200px; height: 8px; background: #333; border-radius: 4px; margin: 20px auto;">
                    <div style="width: ${progress}%; height: 100%; background: #00d1ff; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
                <p>${progress}% complete (${current}/${total} Pokémon checked)</p>
            </div>
        `;
    }
}


// ==== DEBUG DUPLICATES ====
function debugDuplicates() {
    console.log("=== DUPLICATE DEBUG ===");
    console.log("listedNFTs length:", listedNFTs.length);
    console.log("listedNFTs:", listedNFTs);
    
    // Find duplicates
    const tokenIdCount = {};
    listedNFTs.forEach(nft => {
        tokenIdCount[nft.tokenId] = (tokenIdCount[nft.tokenId] || 0) + 1;
    });
    
    const duplicates = Object.entries(tokenIdCount).filter(([id, count]) => count > 1);
    
    if (duplicates.length > 0) {
        console.log("🚨 DUPLICATES FOUND:", duplicates);
        duplicates.forEach(([id, count]) => {
            const dupNFTs = listedNFTs.filter(nft => nft.tokenId == id);
            console.log(`Token ${id} appears ${count} times:`, dupNFTs);
        });
    } else {
        console.log("✅ No duplicates found");
    }
    
    return duplicates.length;
}

// Call this after loadMarketplace to check for duplicates
// debugDuplicates();


// ==== BUY LISTED NFT ====
// ==== BUY LISTED NFT ====
async function buyListedNFT(tokenId) {
    if (!marketContract || !window.userAddress) {
        alert("Please connect your wallet first!");
        return;
    }

    try {
        const listing = await marketContract.getListing(tokenId);
        const priceWei = listing.price;
        
        const balance = await pknContract.balanceOf(window.userAddress);
        if (balance.lt(priceWei)) {
            alert("Insufficient PKN balance!");
            return;
        }

        const allowance = await pknContract.allowance(window.userAddress, MARKET_ADDRESS);
        if (allowance.lt(priceWei)) {
            const approveTx = await pknContract.approve(MARKET_ADDRESS, priceWei);
            await approveTx.wait();
        }

        const tx = await marketContract.buy(tokenId);
        await tx.wait();

        alert(`🎉 Successfully purchased Pokémon!`);
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("Buy error:", err);
        alert("Purchase failed: " + (err.reason || err.message));
    }
}

// Make it global
window.buyListedNFT = buyListedNFT;

// Make sure this is global
window.buyListedNFT = buyListedNFT;

// ==== UPDATE PKN BALANCE ====
async function updatePKNBalance() {
    if (!pknContract || !window.userAddress) return;
    
    try {
        const balance = await pknContract.balanceOf(window.userAddress);
        const formatted = parseFloat(ethers.utils.formatUnits(balance, 18)).toFixed(2);
        const balanceElement = document.getElementById("pkn-amount");
        if (balanceElement) {
            balanceElement.textContent = formatted;
        }
    } catch (err) {
        console.error("PKN balance error:", err);
    }
}

// ==== FILTER FUNCTIONS ====
function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('type-filter')?.value || '';
    const priceFilter = document.getElementById('price-filter')?.value || '';
    
    let filteredNFTs = listedNFTs.filter(nft => {
        // Search filter
        if (searchTerm && !nft.name.toLowerCase().includes(searchTerm)) return false;
        
        // Type filter
        if (typeFilter && !nft.types.includes(typeFilter)) return false;
        
        return true;
    });
    
    // Price sort
    if (priceFilter === 'low') {
        filteredNFTs.sort((a, b) => a.price - b.price);
    } else if (priceFilter === 'high') {
        filteredNFTs.sort((a, b) => b.price - a.price);
    }
    
    renderFilteredNFTs(filteredNFTs);
}

function renderFilteredNFTs(nfts) {
    const grid = document.getElementById("nfts-grid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    if (nfts.length === 0) {
        grid.innerHTML = `<p class="no-nfts">No Pokémon match your filters.</p>`;
        return;
    }
    
    nfts.forEach(nft => {
        const card = document.createElement("div");
        card.className = "nft-card";
        card.innerHTML = `
            <div class="nft-image-container">
                <img src="${nft.image}" alt="${nft.name}" loading="lazy">
                <div class="nft-rarity">#${nft.pokemonId}</div>
            </div>
            <div class="nft-info">
                <h3 class="nft-name">${nft.name}</h3>
                <p class="types">${nft.types}</p>
                <p class="nft-price">${nft.price} PKN</p>
                <p class="nft-owner">Owner: ${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}</p>
            </div>
            <button class="buy-btn" onclick="buyNFT(${nft.tokenId}, '${nft.price}')">Buy Now</button>
        `;
        grid.appendChild(card);
    });
}

// Global functions
window.buyNFT = buyNFT;
window.loadMarketplace = loadMarketplace;
window.initMarketplace = initMarketplace;
window.applyFilters = applyFilters;

// Auto-init when page loads
window.addEventListener('load', function() {
    console.log("Page loaded, userAddress:", window.userAddress);
    
    // If user is already connected (from login page), initialize marketplace
    if (window.userAddress) {
        console.log("User already connected, initializing marketplace...");
        setTimeout(() => {
            if (typeof initMarketplace === 'function') {
                initMarketplace();
            }
        }, 1000);
    } else {
        console.log("User not connected");
        const grid = document.getElementById("nfts-grid");
        if (grid) {
            grid.innerHTML = `
                <div class="no-nfts">
                    <p>Please connect your wallet first.</p>
                    <a href="login.html" style="color: #007bff; text-decoration: underline;">Go to Login Page</a>
                </div>`;
        }
    }
});

// Listen for account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', function(accounts) {
        if (accounts.length === 0) {
            console.log("Wallet disconnected");
            window.location.href = "login.html";
        } else {
            window.location.reload();
        }
    });
}


// ==== MINTING ANIMATION WITH VIDEO ====
// ==== GACHA MINTING SYSTEM ====


// ==== GENERATE RANDOM POKEMON ====
function generateRandomPokemon(guaranteedRare = false) {
    let random = Math.random();
    let selectedRarity;
    let cumulativeChance = 0;

    if (guaranteedRare) {
        random = Math.random() * 0.1;
    }

    for (const [rarity, data] of Object.entries(POKEMON_RARITY)) {
        cumulativeChance += data.chance;
        if (random <= cumulativeChance) {
            selectedRarity = rarity;
            break;
        }
    }

    const range = POKEMON_RARITY[selectedRarity].range;
    const pokemonId = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    
    return {
        pokemonId,
        rarity: selectedRarity,
        color: POKEMON_RARITY[selectedRarity].color
    };
}

// ==== MINT RANDOM POKEMON ====
async function mintRandomPokemon(count = 1) {
    console.log(`mintRandomPokemon called with count: ${count}`);
    
    if (!nftContract || !window.userAddress) {
        alert("Please connect your wallet first!");
        return;
    }

    try {
        const totalPrice = MINT_PRICES[count];
        
        // Check PKN balance
        const balance = await pknContract.balanceOf(window.userAddress);
        if (balance.lt(totalPrice)) {
            alert(`Insufficient PKN balance! You need ${ethers.utils.formatUnits(totalPrice, 18)} PKN.`);
            return;
        }

        // Generate random Pokémon IDs
        const pokemonIds = [];
        const guaranteedRare = count === 10;
        
        for (let i = 0; i < count; i++) {
            let randomPokemon;
            let attempts = 0;
            
            do {
                randomPokemon = generateRandomPokemon(guaranteedRare && i === 0);
                const isMinted = await nftContract.pokemonMinted(randomPokemon.pokemonId);
                if (!isMinted) break;
                attempts++;
                
                if (attempts > 50) {
                    for (let id = 1; id <= 1025; id++) {
                        if (!await nftContract.pokemonMinted(id)) {
                            randomPokemon = { pokemonId: id, rarity: "COMMON", color: "#aaa" };
                            break;
                        }
                    }
                    break;
                }
            } while (true);
            
            pokemonIds.push(randomPokemon.pokemonId);
        }

        console.log("Generated Pokémon IDs:", pokemonIds);
        
        // RUN DIAGNOSTIC BEFORE MINTING
        await preMintDiagnostic(pokemonIds);
        
        // Show fullscreen minting animation
        showMintingAnimation(pokemonIds);

    } catch (err) {
        console.error("Gacha mint error:", err);
        alert("Minting failed: " + (err.reason || err.message));
    }
}

// ==== PRE-MINT DIAGNOSTIC ====
async function preMintDiagnostic(pokemonIds) {
    console.log("🔍 PRE-MINT DIAGNOSTIC");
    
    try {
        // Check PKN balance
        const balance = await pknContract.balanceOf(window.userAddress);
        console.log(`💰 PKN Balance: ${ethers.utils.formatUnits(balance, 18)}`);
        
        // Check allowance
        const totalPrice = MINT_PRICES[pokemonIds.length];
        const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
        console.log(`🔐 Allowance: ${ethers.utils.formatUnits(allowance, 18)} PKN`);
        console.log(`🎯 Required: ${ethers.utils.formatUnits(totalPrice, 18)} PKN`);
        console.log(`✅ Allowance sufficient: ${allowance.gte(totalPrice)}`);
        
        // Check if Pokémon are already minted
        for (const pokemonId of pokemonIds) {
            const isMinted = await nftContract.pokemonMinted(pokemonId);
            console.log(`🔍 Pokémon #${pokemonId} minted: ${isMinted}`);
        }
        
        // Check contract state
        try {
            const mintPrice = await nftContract.mintPrice();
            console.log(`🏷️  Contract mint price: ${ethers.utils.formatUnits(mintPrice, 18)} PKN`);
        } catch (e) {
            console.log("ℹ️  No mintPrice function available");
        }
        
    } catch (err) {
        console.error("Diagnostic failed:", err);
    }
}

// Call this in your mintRandomPokemon function after generating IDs
// await preMintDiagnostic(pokemonIds);

// ==== FULLSCREEN MINTING ANIMATION WITH VIDEO ====
// ==== CLEAN FULLSCREEN MINTING ANIMATION ====
function showMintingAnimation(pokemonIds) {
    console.log("showMintingAnimation called with:", pokemonIds);
    
    const gachaButtons = document.querySelectorAll('.gacha-btn');
    gachaButtons.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '🎬 Rolling...';
    });

    // Create clean fullscreen video overlay - NO TEXT, NO BUTTONS
    const overlay = document.createElement('div');
    overlay.id = 'minting-overlay';
    overlay.innerHTML = `
        <div class="fullscreen-video-container">
            <video id="gacha-video" autoplay muted>
                <source src="Assets/images/roll.mp4" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Video event handlers
    const video = document.getElementById('gacha-video');
    
    if (video) {
        video.addEventListener('loadeddata', function() {
            console.log("Fullscreen gacha video loaded");
        });
        
        video.addEventListener('ended', function() {
            console.log("Gacha video ended");
            cleanupFullscreen();
            proceedWithMinting(pokemonIds);
        });
        
        video.addEventListener('error', function(e) {
            console.error("Video error:", e);
            cleanupFullscreen();
            proceedWithMinting(pokemonIds);
        });
        
        video.play().catch(e => {
            console.log("Video autoplay blocked:", e);
            // If autoplay fails, proceed directly to minting
            cleanupFullscreen();
            proceedWithMinting(pokemonIds);
        });
    }

    // Auto-proceed if video doesn't load within 3 seconds
    setTimeout(() => {
        if (document.getElementById('minting-overlay')) {
            console.log("Video timeout, proceeding with minting");
            cleanupFullscreen();
            proceedWithMinting(pokemonIds);
        }
    }, 3000);
}

// ==== CLEANUP FULLSCREEN ====
function cleanupFullscreen() {
    const overlay = document.getElementById('minting-overlay');
    if (overlay) {
        overlay.remove();
    }
    document.body.style.overflow = '';
    
    const gachaButtons = document.querySelectorAll('.gacha-btn');
    gachaButtons.forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = btn.classList.contains('single') ? '🎯 Mint 1 Pokémon' : 
                        btn.classList.contains('multi') ? '🎁 Mint 5 Pokémon' : 
                        '⭐ Mint 10 Pokémon';
    });
}

// ==== SHOW PLAY BUTTON IF AUTOPLAY BLOCKED ====
function showPlayButton() {
    const playBtn = document.createElement('button');
    playBtn.id = 'play-video-btn';
    playBtn.className = 'play-video-btn';
    playBtn.innerHTML = '▶️ Play Animation';
    playBtn.onclick = function() {
        const video = document.getElementById('gacha-video');
        if (video) {
            video.play();
            playBtn.remove();
        }
    };
    
    const overlayContent = document.querySelector('.video-overlay-content');
    if (overContent) {
        overlayContent.appendChild(playBtn);
    }
}


// ==== PROCEED WITH MINTING (CORRECTED VERSION) ====
async function proceedWithMinting(pokemonIds) {
    console.log("🔍 proceedWithMinting called with:", pokemonIds);
    
    const overlay = document.getElementById('minting-overlay');
    if (overlay) {
        overlay.innerHTML = `
            <div class="minting-content">
                <div style="font-size: 3rem; margin-bottom: 20px;">⏳</div>
                <h2 style="color: #00d1ff; margin-bottom: 20px;">Minting Pokémon...</h2>
                <div class="minting-spinner"></div>
                <p>Executing blockchain transactions...</p>
                <p style="color: #aaa; font-size: 0.9rem; margin-top: 10px;">This may take a few moments</p>
            </div>
        `;
    }

    try {
        const PRICE = ethers.utils.parseUnits("100", 18); // 100 PKN as defined in contract
        console.log(`💰 Contract mint price: ${ethers.utils.formatUnits(PRICE, 18)} PKN`);
        
        // Check PKN balance
        const balance = await pknContract.balanceOf(window.userAddress);
        console.log(`💰 Your PKN balance: ${ethers.utils.formatUnits(balance, 18)} PKN`);
        
        if (balance.lt(PRICE.mul(pokemonIds.length))) {
            alert(`Insufficient PKN balance! You need ${ethers.utils.formatUnits(PRICE.mul(pokemonIds.length), 18)} PKN.`);
            cleanupFullscreen();
            return;
        }

        // Check allowance for NFT contract (not marketplace!)
        const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
        console.log(`🔐 Current allowance: ${ethers.utils.formatUnits(allowance, 18)} PKN`);
        
        if (allowance.lt(PRICE.mul(pokemonIds.length))) {
            console.log("🔄 Increasing allowance...");
            const approveTx = await pknContract.approve(NFT_ADDRESS, PRICE.mul(pokemonIds.length));
            await approveTx.wait();
            console.log("✅ Allowance approved");
        }

        console.log("🔍 Starting mint transactions...");
        const results = [];
        
        for (let i = 0; i < pokemonIds.length; i++) {
            const pokemonId = pokemonIds[i];
            console.log(`🎯 Minting Pokémon #${pokemonId}...`);
            
            try {
                // Use the PokeAPI URI format that your contract expects
                const uri = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
                
                console.log(`📝 Calling mint(${pokemonId}, "${uri}")...`);
                
                // THIS IS THE CORRECT CALL - matches your contract exactly!
                const tx = await nftContract.mint(pokemonId, uri);
                console.log(`✅ Transaction sent: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`🎉 Pokémon #${pokemonId} minted successfully!`);
                
                results.push({ pokemonId, success: true, txHash: tx.hash });
                
                // Update progress
                if (overlay) {
                    const progress = Math.round((results.length / pokemonIds.length) * 100);
                    const p = overlay.querySelector('p');
                    if (p) p.textContent = `Minted ${results.length}/${pokemonIds.length} Pokémon (${progress}%)`;
                }
                
            } catch (err) {
                console.error(`❌ Failed to mint Pokémon #${pokemonId}:`, err);
                results.push({ pokemonId, success: false, error: err.message });
            }
        }

        console.log("📊 Final results:", results);
        showMintResults(results);
        
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("❌ proceedWithMinting error:", err);
        
        if (err.code === 'ACTION_REJECTED') {
            alert("Transaction was rejected by user");
        } else if (err.message.includes('execution reverted')) {
            alert("Contract rejected the transaction. Possible reasons:\n• Pokémon already minted\n• Invalid Pokémon ID\n• Insufficient PKN allowance");
        } else {
            alert("Minting failed: " + (err.reason || err.message));
        }
        
        cleanupFullscreen();
    }
}


// ==== SHOW MINT RESULTS ====
function showMintResults(results) {
    cleanupFullscreen();
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    if (successCount === results.length) {
        alert(`🎉 Successfully minted ${successCount} Pokémon! Check your inventory.`);
    } else if (successCount > 0) {
        alert(`✅ ${successCount} Pokémon minted successfully!\n❌ ${failedCount} failed. Check console for details.`);
        console.log("Failed mints:", results.filter(r => !r.success));
    } else {
        alert("❌ All mints failed. Check console for details.");
        console.log("All mints failed:", results);
    }
}

// ==== GLOBAL FUNCTION EXPORTS ====
window.mintRandomPokemon = mintRandomPokemon;
window.showMintingAnimation = showMintingAnimation;
window.proceedWithMinting = proceedWithMinting;
window.cleanupFullscreen = cleanupFullscreen;
window.showMintResults = showMintResults;

console.log("🎮 Gacha system initialized!");


// ==== SIMPLE CACHING SYSTEM ====
let marketplaceCache = {
    data: null,
    timestamp: 0,
    ttl: 30000 // 30 seconds cache
};

// ==== OPTIMIZED LOAD MARKETPLACE (WITH PROPER CACHING) ====
// ==== LOAD MARKETPLACE (FIXED VERSION) ====
async function loadMarketplace() {
    console.log("🔄 Loading marketplace...");
    
    const grid = document.getElementById("nfts-grid");
    if (!grid) {
        console.log("❌ No nfts-grid element found");
        return;
    }

    try {
        grid.innerHTML = `<p class="loading">Loading Pokémon Marketplace...</p>`;
        listedNFTs = [];
        
        console.log("🔍 Scanning for marketplace listings...");
        
        let activeListings = 0;
        const maxTokenCheck = 100;
        
        // Check tokens 1-100 for active listings
        for (let tokenId = 1; tokenId <= maxTokenCheck; tokenId++) {
            try {
                // Check if listed in marketplace
                const listing = await marketContract.getListing(tokenId);
                
                // Valid listing has price > 0
                if (listing.price.gt(0)) {
                    
                    // Verify NFT is actually in marketplace contract
                    const owner = await nftContract.ownerOf(tokenId);
                    if (owner.toLowerCase() === marketContract.address.toLowerCase()) {
                        
                        // Get Pokémon data
                        const pokemonId = await nftContract.getPokemonId(tokenId);
                        
                        try {
                            // Fetch Pokémon details from PokeAPI
                            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
                            if (res.ok) {
                                const pokemonData = await res.json();
                                
                                const nftData = {
                                    tokenId: tokenId,
                                    pokemonId: pokemonId.toNumber(),
                                    name: pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1),
                                    image: pokemonData.sprites.other['official-artwork'].front_default || pokemonData.sprites.front_default,
                                    types: pokemonData.types.map(t => t.type.name.toUpperCase()).join(' / '),
                                    price: ethers.utils.formatUnits(listing.price, 18),
                                    owner: listing.seller,
                                    isListed: true
                                };
                                
                                listedNFTs.push(nftData);
                                activeListings++;
                                
                                console.log(`✅ Loaded listing: ${nftData.name} (#${nftData.pokemonId}) for ${nftData.price} PKN`);
                            }
                        } catch (apiErr) {
                            console.warn(`Failed to fetch Pokémon ${pokemonId} data:`, apiErr.message);
                        }
                    }
                }
            } catch (err) {
                // Token doesn't exist or not listed - skip silently
                continue;
            }
        }
        
        console.log(`📊 Marketplace loaded: ${activeListings} listings`);
        
        // Render the marketplace
        renderMarketplaceGrid(activeListings);
        
    } catch (err) {
        console.error("❌ Marketplace load error:", err);
        grid.innerHTML = `<p class="error">Failed to load marketplace: ${err.message}</p>`;
    }
}

// ==== RENDER MARKETPLACE GRID ====
function renderMarketplaceGrid(listedCount) {
    const grid = document.getElementById("nfts-grid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    console.log(`🎨 Rendering ${listedCount} Pokémon in marketplace...`);
    
    if (listedCount === 0) {
        grid.innerHTML = `
            <div class="no-nfts">
                <h3>🏪 Marketplace Empty</h3>
                <p>No Pokémon are currently listed for sale.</p>
                <p>Be the first to list your Pokémon!</p>
            </div>`;
        return;
    }
    
    // Sort by token ID for consistent display
    listedNFTs.sort((a, b) => a.tokenId - b.tokenId);
    
    listedNFTs.forEach(nft => {
        const card = document.createElement("div");
        card.className = "nft-card";
        card.innerHTML = `
            <div class="nft-image-container">
                <img src="${nft.image}" alt="${nft.name}" loading="lazy">
                <div class="nft-rarity">#${nft.pokemonId}</div>
                <div class="listed-badge">FOR SALE</div>
            </div>
            <div class="nft-info">
                <h3 class="nft-name">${nft.name}</h3>
                <p class="types">${nft.types}</p>
                <p class="nft-price">${nft.price} PKN</p>
                <p class="nft-owner">Seller: ${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}</p>
            </div>
            <button class="buy-btn" onclick="buyNFT(${nft.tokenId})">Buy Now</button>
        `;
        grid.appendChild(card);
    });
    
    console.log(`✅ Marketplace rendered: ${listedCount} Pokémon`);
}


// ==== BUY NFT FUNCTION ====
async function buyNFT(tokenId, price) {
    if (!nftContract || !window.userAddress) {
        alert("Please connect your wallet first!");
        return;
    }

    try {
        const priceWei = ethers.utils.parseUnits(price.toString(), 18);
        
        // Check PKN balance
        const balance = await pknContract.balanceOf(window.userAddress);
        if (balance.lt(priceWei)) {
            alert("Insufficient PKN balance!");
            return;
        }

        // Check allowance
        const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
        if (allowance.lt(priceWei)) {
            const approveTx = await pknContract.approve(NFT_ADDRESS, priceWei);
            await approveTx.wait();
        }

        // Mint the Pokémon
        const uri = `https://pokeapi.co/api/v2/pokemon/${tokenId}`;
        const tx = await nftContract.mint(tokenId, uri);
        await tx.wait();

        alert(`🎉 Successfully minted Pokémon #${tokenId}!`);
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("Buy error:", err);
        alert("Purchase failed: " + (err.reason || err.message));
    }
}

// Make it global
window.buyNFT = buyNFT;


// ==== DECODE CONTRACT ERRORS ====
function decodeContractError(errorData) {
    console.log("🔍 DECODING CONTRACT ERROR...");
    console.log("Full error data:", errorData);
    
    // Common custom error selectors
    const errorSelectors = {
        '0xfb8f41b2': 'InsufficientPayment(uint256 required, uint256 provided)',
        '0x08c379a0': 'Error(string)',
        '0x7b0a47ee': 'MaxSupplyReached()',
        '0x2afc0e71': 'TokenAlreadyMinted()',
        '0x2dba9b87': 'Paused()',
        '0xa45f47fd': 'InsufficientAllowance()'
    };
    
    const selector = errorData.slice(0, 10);
    console.log("Error selector:", selector);
    console.log("Likely error:", errorSelectors[selector] || 'Unknown error');
    
    // If it's InsufficientPayment error, decode the values
    if (selector === '0xfb8f41b2') {
        try {
            // Remove selector and decode the rest
            const encodedData = errorData.slice(10);
            // This contains required and provided amounts
            console.log("Encoded payment data:", encodedData);
            alert("❌ Insufficient PKN payment! Check that you have enough PKN and proper allowance.");
        } catch (e) {
            console.log("Could not decode payment data");
        }
    }
    
    return errorSelectors[selector] || 'Unknown error';
}