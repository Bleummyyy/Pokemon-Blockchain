
function saveWalletSession() {
  if (window.userAddress) {
    sessionStorage.setItem("walletConnected", "true");
    sessionStorage.setItem("userAddress", window.userAddress);
    console.log("✅ Wallet session saved:", window.userAddress);
  }
}

// ==== LOAD PROTECTION ====
let isLoadingMarketplace = false;
let hasLoadedMarketplace = false;
let isInitializing = false;
let pokemonDataCache = null;

let nftContract, pknContract, marketContract;
let listedNFTs = [];
let currentPage = 1;
const itemsPerPage = 15;

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
// SIMPLIFIED VERSION - remove the protection
async function initMarketplace() {
    console.log("initMarketplace called");
    
    // SAFETY CHECK: Make sure required elements exist
    if (!window.ethereum || !window.userAddress) {
        console.log("Wallet not connected yet");
        return;
    }
    
    const grid = document.getElementById("nfts-grid");
    if (!grid) {
        console.error("nfts-grid element not found on page!");
        return;
    }

    try {
        console.log("Initializing contracts...");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
        pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
        marketContract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);

        window.nftContract = nftContract;
        window.pknContract = pknContract;
        window.marketContract = marketContract;

        console.log("Contracts initialized");
        updateMarketplaceUI();
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("Marketplace init failed:", err);
    }
}

// ==== UPDATE MARKETPLACE UI ====
function updateMarketplaceUI() {
    if (!window.userAddress) return;

    // ALWAYS save when marketplace loads
    saveWalletSession();
    
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



// ==== FAST METHOD: Get active listings directly ====
async function tryFastMarketplaceLoad() {
    try {
        console.log("Trying fast marketplace load...");
        
        if (!marketContract) return 0;
        
        // Try to get all listed NFTs at once (if your contract supports this)
        const activeListings = await marketContract.getActiveListings();
        console.log(`Fast method found ${activeListings.length} active listings`);
        
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
        
        console.log(`Fast method loaded ${nftDataArray.length} valid listings`);
        return nftDataArray.length;
        
    } catch (err) {
        console.log("Fast method failed, falling back to batch method:", err.message);
        return 0;
    }
}

// ==== OPTIMIZED BATCH METHOD: Check only minted Pokémon ====
async function tryOptimizedBatchLoad() {
    console.log("Using optimized batch load...");
    
    let listedCount = 0;
    const batchSize = 50; // Process in batches for better performance
    const maxPokemonToCheck = 151; // Only check Gen 1 for speed
    
    // Get total supply to know how many tokens exist
    let totalSupply = maxPokemonToCheck;
    try {
        const supply = await nftContract.totalSupply();
        totalSupply = Math.min(supply.toNumber(), maxPokemonToCheck);
    } catch (err) {
        console.log("Could not get total supply, using default limit");
    }
    
    console.log(`Checking first ${totalSupply} Pokémon...`);
    
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
        
        console.log(`Batch ${batchStart}-${batchEnd}: ${validNFTs.length} listed`);
        
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
    if (!grid) return;
    
    grid.innerHTML = "";
    
    console.log(`Rendering ${listedCount} Pokémon in marketplace...`);
    
    if (listedCount === 0) {
        grid.innerHTML = `
            <div class="no-nfts">
                <h3>🏪 Marketplace Empty</h3>
                <p>No Pokémon are currently listed for sale.</p>
                <p>Be the first to list your Pokémon!</p>
            </div>`;
        return;
    }
    
    listedNFTs.sort((a, b) => a.tokenId - b.tokenId);
    
    listedNFTs.forEach(nft => {
        // Parse types - handle both number arrays and string formats
        let typeNumbers = [];
        
        if (Array.isArray(nft.types)) {
            typeNumbers = nft.types;
        } else if (typeof nft.types === 'string') {
            // Handle string format like "1 / 2" or "normal / fighting"
            typeNumbers = nft.types.split(' / ').map(typeStr => {
                // Try to parse as number first
                const num = parseInt(typeStr.trim());
                if (!isNaN(num)) return num;
                
                // If it's a string name, convert to number using TYPE_NUMBER
                return TYPE_NUMBER[typeStr.trim().toLowerCase()];
            }).filter(num => num !== undefined && !isNaN(num));
        }
        
        // Generate type badges using number images
        const typeBadgesHTML = typeNumbers.map(typeNumber => {
            const typeName = NUMBER_TO_TYPE[typeNumber];
            if (!typeName) {
                console.warn(`Unknown type number: ${typeNumber}`);
                return `<span class="type-fallback">Type ${typeNumber}</span>`;
            }
            return `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/brilliant-diamond-and-shining-pearl/${typeNumber}.png" 
                      alt="${typeName}" 
                      class="type-badge"
                      title="${typeName.charAt(0).toUpperCase() + typeName.slice(1)}"
                      onerror="this.style.display='none'">`;
        }).join('');
        
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
                <div class="type-badges-container">
                    ${typeBadgesHTML}
                </div>
                <p class="nft-price">${nft.price} PKN</p>
            </div>
            <button class="buy-btn" onclick="buyNFT(${nft.tokenId})">Buy Now</button>
        `;
        grid.appendChild(card);
    });
    
    console.log(`Marketplace rendered: ${listedCount} Pokémon`);
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
        console.log("DUPLICATES FOUND:", duplicates);
        duplicates.forEach(([id, count]) => {
            const dupNFTs = listedNFTs.filter(nft => nft.tokenId == id);
            console.log(`Token ${id} appears ${count} times:`, dupNFTs);
        });
    } else {
        console.log("No duplicates found");
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

        alert(`Successfully purchased Pokémon!`);
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
            </div>
            <button class="buy-btn" onclick="buyNFT(${nft.tokenId}, '${nft.price}')">Buy Now</button>
        `;
        grid.appendChild(card);
    });
}

// <p class="nft-owner">Owner: ${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}</p> 

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

/* =================  mintRandomPokemon  ================= */
// ==== UPDATED MAIN MINT FUNCTION ====
async function mintRandomPokemon(count = 1, isFree = false) {
    console.log(`🎯 mintRandomPokemon | count:${count} isFree:${isFree}`);

    if (!nftContract || !window.userAddress) {
        alert("Please connect your wallet first!");
        return;
    }

    // Generate unique Pokémon IDs
    const pokemonIds = [];
    const guaranteedRare = count === 10;
    
    for (let i = 0; i < count; i++) {
        let pokemonData;
        let attempts = 0;
        
        do {
            pokemonData = generateRandomPokemon(guaranteedRare && i === 0);
            const isMinted = await nftContract.pokemonMinted(pokemonData.pokemonId);
            if (!isMinted) break;
            
            attempts++;
            if (attempts > 50) {
                // Find any unminted Pokémon
                for (let id = 1; id <= 1025; id++) {
                    if (!await nftContract.pokemonMinted(id)) {
                        pokemonData = { pokemonId: id };
                        break;
                    }
                }
                break;
            }
        } while (true);
        
        pokemonIds.push(pokemonData.pokemonId);
    }

    console.log("Generated Pokémon IDs:", pokemonIds);

    // Show animation
    showMintingAnimation(pokemonIds);
    
    // Use SUPER SAFE minting
    await superSafeMint(pokemonIds, isFree);
}

// ==== SUPER SAFE MINT FUNCTION ====
async function superSafeMint(pokemonIds, isFirstFree = false) {
    console.log("🛡️ SUPER SAFE MINT STARTING...");
    
    const results = [];
    
    for (let i = 0; i < pokemonIds.length; i++) {
        const pokemonId = pokemonIds[i];
        
        console.log(`\n🎯 Processing Pokémon #${pokemonId} (${i+1}/${pokemonIds.length})`);
        
        // STEP 1: Pre-check
        const preCheck = await preMintCheck(pokemonId);
        if (!preCheck.canMint) {
            results.push({ pokemonId, success: false, error: preCheck.error });
            continue;
        }

        // STEP 2: Attempt mint with detailed debugging
        const debugResult = await debugMintProcess(pokemonId);
        
        // STEP 3: Final verification (wait longer)
        await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds
        
        const finalCheck = await verifyFinalState(pokemonId);
        
        if (finalCheck.owned) {
            console.log(`🎉 CONFIRMED: Pokémon #${pokemonId} is DEFINITELY in your inventory!`);
            results.push({ pokemonId, success: true, confirmed: true });
        } else if (finalCheck.mintedButNotOwned) {
            console.log(`⚠️  Pokémon #${pokemonId} was minted but you don't own it!`);
            results.push({ pokemonId, success: false, error: "Minted but not owned" });
        } else {
            console.log(`❌ Pokémon #${pokemonId} was not minted at all`);
            results.push({ pokemonId, success: false, error: "Not minted" });
        }
        
        updateMintProgress(i + 1, pokemonIds.length);
    }
    
    showSuperSafeResults(results);
    return results;
}

// ==== PRE-MINT CHECK ====
async function preMintCheck(pokemonId) {
    try {
        // Check if already minted
        const isMinted = await nftContract.pokemonMinted(pokemonId);
        if (isMinted) {
            const owner = await nftContract.ownerOf(pokemonId);
            if (owner.toLowerCase() === window.userAddress.toLowerCase()) {
                return { canMint: false, error: "You already own this Pokémon" };
            }
            return { canMint: false, error: "Pokémon already minted by someone else" };
        }
        
        return { canMint: true };
    } catch (error) {
        return { canMint: false, error: error.message };
    }
}

// ==== FINAL STATE VERIFICATION ====
async function verifyFinalState(pokemonId) {
    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const isMinted = await nftContract.pokemonMinted(pokemonId);
        if (!isMinted) {
            return { owned: false, mintedButNotOwned: false };
        }
        
        const owner = await nftContract.ownerOf(pokemonId);
        const youOwnIt = owner.toLowerCase() === window.userAddress.toLowerCase();
        
        return { 
            owned: youOwnIt, 
            mintedButNotOwned: isMinted && !youOwnIt 
        };
    } catch (error) {
        return { owned: false, mintedButNotOwned: false, error: error.message };
    }
}

// ==== SUPER SAFE RESULTS ====
function showSuperSafeResults(results) {
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log("📊 SUPER SAFE RESULTS:", results);
    
    let message = "";
    
    if (successCount === results.length) {
        message = `🎉 PERFECT! All ${successCount} Pokémon are confirmed in your inventory!`;
    } else if (successCount > 0) {
        message = `✅ ${successCount} Pokémon successfully minted!\n❌ ${failedCount} failed.`;
        
        // Show details of failures
        results.filter(r => !r.success).forEach(fail => {
            console.log(`   ❌ #${fail.pokemonId}: ${fail.error}`);
        });
    } else {
        message = `❌ All ${failedCount} mints failed. Check console for details.`;
    }
    
    alert(message);
    
    // Always show detailed results in console
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ #${result.pokemonId}: SUCCESS - Confirmed in inventory`);
        } else {
            console.log(`❌ #${result.pokemonId}: FAILED - ${result.error}`);
        }
    });
}

// ==== RELIABLE BATCH MINTING ====
async function reliableBatchMint(pokemonIds, isFirstFree = false) {
  console.log("Starting RELIABLE batch mint:", pokemonIds);
  
  const results = [];
  
  try {
    // Price calculation
    const PRICE = ethers.utils.parseUnits("100", 18);
    const totalPrice = isFirstFree ? ethers.BigNumber.from(0) : PRICE.mul(pokemonIds.length);

    // Balance check
    if (!totalPrice.isZero()) {
      const balance = await pknContract.balanceOf(window.userAddress);
      if (balance.lt(totalPrice)) {
        alert(`Insufficient PKN! You need ${ethers.utils.formatUnits(totalPrice, 18)} PKN.`);
        cleanupFullscreen();
        return;
      }
    }

    // Allowance check
    if (!totalPrice.isZero()) {
      const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
      if (allowance.lt(totalPrice)) {
        console.log("Approving PKN...");
        const approveTx = await pknContract.approve(NFT_ADDRESS, totalPrice);
        await approveTx.wait();
        console.log("Approval confirmed");
      }
    }

    // MINT EACH POKÉMON WITH ON-CHAIN VERIFICATION
    for (let i = 0; i < pokemonIds.length; i++) {
      const pokemonId = pokemonIds[i];
      const uri = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
      
      console.log(`🎯 Minting Pokémon #${pokemonId}...`);
      
      // METHOD 1: Try direct mint with minimal error handling
      let mintSuccess = await attemptSimpleMint(pokemonId, uri);
      
      // METHOD 2: If that fails, verify on-chain state
      if (!mintSuccess) {
        console.log(`🔄 Checking on-chain state for #${pokemonId}...`);
        mintSuccess = await verifyPokemonOwnership(pokemonId);
      }
      
      if (mintSuccess) {
        results.push({ pokemonId, success: true });
        console.log(`✅ CONFIRMED: Pokémon #${pokemonId} is in your inventory!`);
      } else {
        results.push({ pokemonId, success: false });
        console.log(`❌ Pokémon #${pokemonId} mint failed`);
      }
      
      // Update UI progress
      updateMintProgress(i + 1, pokemonIds.length);
    }

  } catch (err) {
    console.error("Batch mint error:", err);
    
    // Even if there's an error, check what actually got minted
    console.log("🔄 Verifying all Pokémon after error...");
    for (const pokemonId of pokemonIds) {
      if (!results.some(r => r.pokemonId === pokemonId)) {
        const verified = await verifyPokemonOwnership(pokemonId);
        results.push({ pokemonId, success: verified });
        console.log(`Post-error verification #${pokemonId}:`, verified ? "SUCCESS" : "FAILED");
      }
    }
  } finally {
    // ALWAYS show results based on actual on-chain state
    showFinalMintResults(results);
    cleanupFullscreen();
    updateMintButtons();
    await updatePKNBalance();
    await loadMarketplace();
  }
}

// ==== SIMPLE MINT ATTEMPT ====
async function attemptSimpleMint(pokemonId, uri) {
  try {
    console.log(`Attempting mint for #${pokemonId}...`);
    
    // Just send the transaction and don't over-complicate it
    const tx = await nftContract.mint(pokemonId, uri, {
      gasLimit: 300000 // Ensure enough gas
    });
    
    console.log(`Transaction sent: ${tx.hash}`);
    
    // Wait for transaction but don't stress about the result
    try {
      const receipt = await tx.wait();
      console.log(`Transaction mined: ${receipt.blockNumber}`);
      
      // Check if transaction actually succeeded
      if (receipt.status === 1) {
        return true;
      } else {
        console.log(`Transaction status failed: ${receipt.status}`);
        return false;
      }
    } catch (receiptError) {
      console.log("Receipt error (but transaction might have succeeded):", receiptError.message);
      // Don't return false yet - we'll verify on-chain
      return null; // Unknown state
    }
    
  } catch (mintError) {
    console.log(`Mint attempt error for #${pokemonId}:`, mintError.message);
    return false; // Definitely failed
  }
}

// ==== ON-CHAIN VERIFICATION ====
async function verifyPokemonOwnership(pokemonId) {
  try {
    // Wait a moment for blockchain state to update
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`🔍 Verifying ownership of #${pokemonId}...`);
    
    // Check if Pokémon is minted
    const isMinted = await nftContract.pokemonMinted(pokemonId);
    console.log(`#${pokemonId} minted:`, isMinted);
    
    if (isMinted) {
      // Check if you own it
      const owner = await nftContract.ownerOf(pokemonId);
      const youOwnIt = owner.toLowerCase() === window.userAddress.toLowerCase();
      console.log(`#${pokemonId} owner:`, owner, "You own it:", youOwnIt);
      
      return youOwnIt;
    }
    
    return false;
  } catch (error) {
    console.log(`Verification failed for #${pokemonId}:`, error.message);
    return false;
  }
}

// ==== PROGRESS UPDATER ====
function updateMintProgress(current, total) {
  const overlay = document.getElementById('minting-overlay');
  if (overlay) {
    const pct = Math.round((current / total) * 100);
    overlay.innerHTML = `
      <div class="minting-content">
        <div style="font-size:3rem;margin-bottom:20px;">🔄</div>
        <h2 style="color:#00d1ff;margin-bottom:20px;">Minting Pokémon...</h2>
        <div class="minting-spinner"></div>
        <p>Processing ${current}/${total} (${pct}%)</p>
        <p style="color:#aaa;font-size:0.9rem;margin-top:10px;">Verifying on-chain...</p>
      </div>`;
  }
}

// ==== FINAL RESULTS DISPLAY ====
function showFinalMintResults(results) {
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  console.log("FINAL ON-CHAIN RESULTS:", results);
  
  if (successCount === results.length) {
    alert(`🎉 SUCCESS! All ${successCount} Pokémon are in your inventory!`);
  } else if (successCount > 0) {
    alert(`✅ ${successCount} Pokémon successfully minted to your inventory!\n❌ ${failedCount} failed to mint.`);
  } else {
    alert(`❌ No Pokémon were minted. All ${failedCount} attempts failed.`);
  }
  
  // Log detailed results to console for debugging
  results.forEach(result => {
    if (result.success) {
      console.log(`🎯 Pokémon #${result.pokemonId}: SUCCESS - Check your inventory!`);
    } else {
      console.log(`💥 Pokémon #${result.pokemonId}: FAILED - Not in your inventory`);
    }
  });
}

// ==== UPDATE YOUR GACHA BUTTONS ====
function updateMintButtons() {
  const gachaButtons = document.querySelectorAll('.gacha-btn');
  gachaButtons.forEach(btn => {
    btn.disabled = false;
    btn.innerHTML = btn.classList.contains('single') ? '🎯 Mint 1 Pokémon' : 
                    btn.classList.contains('multi') ? '🎁 Mint 5 Pokémon' : 
                    '⭐ Mint 10 Pokémon';
  });
}

// Make sure these are global
window.mintRandomPokemon = mintRandomPokemon;
window.reliableBatchMint = reliableBatchMint;
/* ======================================================= */

// ==== PRE-MINT DIAGNOSTIC ====
async function preMintDiagnostic(pokemonIds) {
    console.log("PRE-MINT DIAGNOSTIC");
    
    try {
        // Check PKN balance
        const balance = await pknContract.balanceOf(window.userAddress);
        console.log(`💰 PKN Balance: ${ethers.utils.formatUnits(balance, 18)}`);
        
        // Check allowance
        const totalPrice = MINT_PRICES[pokemonIds.length];
        const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
        console.log(`Allowance: ${ethers.utils.formatUnits(allowance, 18)} PKN`);
        console.log(`Required: ${ethers.utils.formatUnits(totalPrice, 18)} PKN`);
        console.log(`Allowance sufficient: ${allowance.gte(totalPrice)}`);
        
        // Check if Pokémon are already minted
        for (const pokemonId of pokemonIds) {
            const isMinted = await nftContract.pokemonMinted(pokemonId);
            console.log(`Pokémon #${pokemonId} minted: ${isMinted}`);
        }
        
        // Check contract state
        try {
            const mintPrice = await nftContract.mintPrice();
            console.log(`Contract mint price: ${ethers.utils.formatUnits(mintPrice, 18)} PKN`);
        } catch (e) {
            console.log("No mintPrice function available");
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
        btn.innerHTML = 'Rolling...';
    });

    // Create clean fullscreen video overlay - NO TEXT, NO BUTTONS
    const overlay = document.createElement('div');
    overlay.id = 'minting-overlay';
    overlay.innerHTML = `
        <div class="fullscreen-video-container">
            <video id="gacha-video" autoplay muted>
                <source src="assets/images/roll.mp4" type="video/mp4">
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
    }, 5000);
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
// function showPlayButton() {
//     const playBtn = document.createElement('button');
//     playBtn.id = 'play-video-btn';
//     playBtn.className = 'play-video-btn';
//     playBtn.innerHTML = '▶️ Play Animation';
//     playBtn.onclick = function() {
//         const video = document.getElementById('gacha-video');
//         if (video) {
//             video.play();
//             playBtn.remove();
//         }
//     };
    
//     const overlayContent = document.querySelector('.video-overlay-content');
//     if (overContent) {
//         overlayContent.appendChild(playBtn);
//     }
// }


/* =================  proceedWithMinting  ================= */
async function debugMintTransaction(pokemonId, uri) {
    console.log("=== DEBUG MINT TRANSACTION ===");
    console.log("Pokémon ID:", pokemonId);
    console.log("URI:", uri);
    
    try {
        // Check current state
        const isMintedBefore = await nftContract.pokemonMinted(pokemonId);
        console.log("Minted before?", isMintedBefore);
        
        // Call mint function
        console.log("Calling mint function...");
        const tx = await nftContract.mint(pokemonId, uri);
        console.log("Transaction sent:", tx.hash);
        
        // Wait for confirmation
        console.log("Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("Transaction receipt:", receipt);
        
        // Check final state
        const isMintedAfter = await nftContract.pokemonMinted(pokemonId);
        const owner = await nftContract.ownerOf(pokemonId);
        console.log("Minted after?", isMintedAfter);
        console.log("Owner:", owner);
        console.log("You are:", window.userAddress);
        console.log("Ownership match:", owner.toLowerCase() === window.userAddress.toLowerCase());
        
        return { success: true, receipt, owner };
        
    } catch (err) {
        console.error("Debug mint error:", err);
        // Even if there's an error, check if it was actually minted
        try {
            const isMintedAfter = await nftContract.pokemonMinted(pokemonId);
            const owner = await nftContract.ownerOf(pokemonId);
            console.log("Despite error - Minted after?", isMintedAfter);
            console.log("Despite error - Owner:", owner);
            console.log("Despite error - Ownership match:", owner.toLowerCase() === window.userAddress.toLowerCase());
            
            if (isMintedAfter && owner.toLowerCase() === window.userAddress.toLowerCase()) {
                console.log("🎯 FALSE NEGATIVE: Transaction succeeded despite error!");
                return { success: true, recovered: true, owner };
            }
        } catch (checkError) {
            console.error("Couldn't check mint status:", checkError);
        }
        
        return { success: false, error: err };
    }
}


async function proceedWithMinting(pokemonIds, isFirstFree = false) {
  console.log("proceedWithMinting | ids:", pokemonIds, "isFirstFree:", isFirstFree);

  const overlay = document.getElementById('minting-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div class="minting-content">
        <div style="font-size:3rem;margin-bottom:20px;">⏳</div>
        <h2 style="color:#00d1ff;margin-bottom:20px;">Minting Pokémon...</h2>
        <div class="minting-spinner"></div>
        <p>Executing blockchain transactions...</p>
        <p style="color:#aaa;font-size:0.9rem;margin-top:10px;">This may take a few moments</p>
      </div>`;
  }

  const results = [];
  
  try {
    const PRICE = ethers.utils.parseUnits("100", 18);
    const totalPrice = isFirstFree ? ethers.BigNumber.from(0) : PRICE.mul(pokemonIds.length);

    // Balance check (skip if free)
    if (!totalPrice.isZero()) {
      const balance = await pknContract.balanceOf(window.userAddress);
      if (balance.lt(totalPrice)) {
        alert(`Insufficient PKN! You need ${ethers.utils.formatUnits(totalPrice, 18)} PKN.`);
        cleanupFullscreen(); 
        return;
      }
    }

    // Allowance check (skip if free)
    if (!totalPrice.isZero()) {
      const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
      if (allowance.lt(totalPrice)) {
        const approveTx = await pknContract.approve(NFT_ADDRESS, totalPrice);
        await approveTx.wait();
      }
    }

    // Mint each Pokémon
    for (let i = 0; i < pokemonIds.length; i++) {
      const pokemonId = pokemonIds[i];
      const uri = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
      
      console.log(`🔄 Minting Pokémon #${pokemonId}...`);
      
      try {
        // Use the debug function to see what's actually happening
        const mintResult = await debugMintTransaction(pokemonId, uri);
        
        if (mintResult.success) {
          if (mintResult.recovered) {
            console.log(`✅ RECOVERED: Pokémon #${pokemonId} was minted successfully despite UI error`);
            results.push({ pokemonId, success: true, recovered: true });
          } else {
            console.log(`✅ SUCCESS: Pokémon #${pokemonId} minted successfully`);
            results.push({ pokemonId, success: true });
          }
        } else {
          console.log(`❌ FAILED: Pokémon #${pokemonId} mint failed`);
          results.push({ pokemonId, success: false, error: mintResult.error });
        }

      } catch (mintError) {
        console.error(`Unexpected error minting #${pokemonId}:`, mintError);
        
        // Final fallback: check if it was actually minted despite the error
        try {
          const owner = await nftContract.ownerOf(pokemonId);
          if (owner.toLowerCase() === window.userAddress.toLowerCase()) {
            console.log(`🎯 FINAL RECOVERY: Pokémon #${pokemonId} belongs to you!`);
            results.push({ pokemonId, success: true, recovered: true });
          } else {
            results.push({ pokemonId, success: false, error: mintError.message });
          }
        } catch (ownerError) {
          results.push({ pokemonId, success: false, error: mintError.message });
        }
      }

      // Update progress
      if (overlay) {
        const pct = Math.round(((i + 1) / pokemonIds.length) * 100);
        const p = overlay.querySelector('p');
        if (p) p.textContent = `Processing ${i + 1}/${pokemonIds.length} Pokémon (${pct}%)`;
      }
    }

  } catch (err) {
    console.error("Overall proceedWithMinting error:", err);
    // Even if there's an overall error, check what actually got minted
    for (const pokemonId of pokemonIds) {
      try {
        const owner = await nftContract.ownerOf(pokemonId);
        if (owner.toLowerCase() === window.userAddress.toLowerCase()) {
          console.log(`🔄 Checking #${pokemonId} after overall error: SUCCESS`);
          if (!results.some(r => r.pokemonId === pokemonId)) {
            results.push({ pokemonId, success: true, recovered: true });
          }
        }
      } catch (e) {
        // Pokémon not minted
        if (!results.some(r => r.pokemonId === pokemonId)) {
          results.push({ pokemonId, success: false, error: "Overall process failed" });
        }
      }
    }
  } finally {
    // Always clean up and show results
    cleanupFullscreen();
    showAccurateMintResults(results);
    updateMintButtons();
    await updatePKNBalance();
    await loadMarketplace();
  }
}

// NEW: More accurate results display
function showAccurateMintResults(results) {
  const successCount = results.filter(r => r.success).length;
  const recoveredCount = results.filter(r => r.recovered).length;
  const failedCount = results.filter(r => !r.success).length;
  
  console.log("FINAL MINT RESULTS:", { successCount, recoveredCount, failedCount, results });
  
  if (successCount === results.length) {
    if (recoveredCount > 0) {
      alert(`🎉 Success! All ${successCount} Pokémon were minted! \n(Some had minor display issues but worked correctly)`);
    } else {
      alert(`🎉 Success! All ${successCount} Pokémon were minted successfully!`);
    }
  } else if (successCount > 0) {
    if (recoveredCount > 0) {
      alert(`✅ ${successCount} Pokémon minted successfully! \n(${recoveredCount} had display issues but worked)\n❌ ${failedCount} failed completely.`);
    } else {
      alert(`✅ ${successCount} Pokémon minted successfully!\n❌ ${failedCount} failed.`);
    }
  } else {
    alert("❌ All mints failed. Check console for details.");
  }
}
/* ======================================================= */

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

console.log("Gacha system initialized!");


// ==== SIMPLE CACHING SYSTEM ====
let marketplaceCache = {
    data: null,
    timestamp: 0,
    ttl: 30000 // 30 seconds cache
};

// ==== OPTIMIZED LOAD MARKETPLACE (WITH PROPER CACHING) ====
// ==== ULTIMATE FAST MARKETPLACE ====
async function loadMarketplace() {
    console.log("🚀 ULTIMATE FAST Loading marketplace...");
    
    const grid = document.getElementById("nfts-grid");
    if (!grid) return;
    
    try {
        grid.innerHTML = `<p class="loading"> Loading marketplace instantly...</p>`;
        
        // Load Pokémon data if not cached
        if (!pokemonDataCache) {
            const response = await fetch('/pokemondata/pokedex.json');
            const data = await response.json();
            pokemonDataCache = {};
            data.forEach(pokemon => {
                pokemonDataCache[pokemon.id] = pokemon;
            });
        }
        
        // METHOD 1: Try to get all active listings at once (FASTEST)
        let listings = [];
        try {
            const activeListings = await marketContract.getActiveListings();
            console.log(`📊 Found ${activeListings.length} active listings via getActiveListings()`);
            
            // Process all active listings in parallel
            const listingPromises = activeListings.map(async (tokenIdBN) => {
                const tokenId = tokenIdBN.toNumber();
                try {
                    const listing = await marketContract.getListing(tokenId);
                    const pokemonId = await nftContract.getPokemonId(tokenId);
                    return { tokenId, pokemonId: pokemonId.toNumber(), listing };
                } catch (e) {
                    return null;
                }
            });
            
            listings = (await Promise.all(listingPromises)).filter(Boolean);
            
        } catch (err) {
            console.log("getActiveListings failed, using parallel scan...");
            // Fallback to parallel scanning
            listings = await scanListingsParallel();
        }
        
        console.log(`Total listings: ${listings.length}`);
        renderMarketplaceDirect(listings);
        
    } catch (err) {
        console.error("Marketplace error:", err);
        if (grid) grid.innerHTML = `<p class="error">Failed to load marketplace</p>`;
    }
}

// ==== DIRECT RENDERER ====




// ==== LOAD ALL POKEMON DATA FROM JSON FILES ====
// ==== ULTRA-FAST MARKETPLACE LOADER ====
async function loadMarketplace() {
    console.log("🚀 ULTRA-FAST Loading marketplace...");
    
    const grid = document.getElementById("nfts-grid");
    if (!grid) return;
    
    try {
        grid.innerHTML = `<p class="loading">Scanning marketplace at warp speed...</p>`;
        
        // Load Pokémon data if not cached
        if (!pokemonDataCache) {
            console.log("📥 Loading Pokémon JSON data...");
            const response = await fetch('/pokemondata/pokedex.json');
            const data = await response.json();
            pokemonDataCache = {};
            data.forEach(pokemon => {
                pokemonDataCache[pokemon.id] = pokemon;
            });
            console.log("Pokémon JSON data loaded");
        }
        
        // Use parallel scanning (getActiveListings is failing)
        console.log("⚡ Scanning for listings in parallel...");
        const listings = await scanListingsParallel();
        
        console.log(`Found ${listings.length} active listings`);
        
        // Instant render
        renderMarketplaceDirect(listings);
        
    } catch (err) {
        console.error("Marketplace error:", err);
        const grid = document.getElementById("nfts-grid");
        if (grid) grid.innerHTML = `<p class="error">Failed to load marketplace</p>`;
    }
}

// ==== PARALLEL LISTING SCANNER ====
async function scanListingsParallel() {
    const listings = [];
    const batchSize = 10; // Process 10 tokens at once
    const maxTokenCheck = 100;
    
    // Create batches
    const batches = [];
    for (let start = 1; start <= maxTokenCheck; start += batchSize) {
        const end = Math.min(start + batchSize - 1, maxTokenCheck);
        batches.push({ start, end });
    }
    
    // Process batches in parallel
    for (const batch of batches) {
        const { start, end } = batch;
        
        // Create promises for this batch
        const batchPromises = [];
        for (let tokenId = start; tokenId <= end; tokenId++) {
            batchPromises.push(checkTokenListing(tokenId));
        }
        
        // Wait for all checks in this batch
        const batchResults = await Promise.all(batchPromises);
        
        // Add valid listings
        batchResults.forEach(result => {
            if (result) listings.push(result);
        });
        
        console.log(`Batch ${start}-${end}: ${batchResults.filter(Boolean).length} found`);
        
        // Update progress
        updateLoadingProgress(end, maxTokenCheck);
    }
    
    return listings;
}

// ==== CHECK SINGLE TOKEN LISTING ====
async function checkTokenListing(tokenId) {
    try {
        const listing = await marketContract.getListing(tokenId);
        
        if (listing.price.gt(0)) {
            const pokemonId = await nftContract.getPokemonId(tokenId);
            return { 
                tokenId, 
                pokemonId: pokemonId.toNumber(), 
                listing 
            };
        }
    } catch (e) {
        // Token doesn't exist or error - skip silently
    }
    return null;
}

// ==== LOADING PROGRESS ====
function updateLoadingProgress(current, total) {
    const grid = document.getElementById("nfts-grid");
    const progress = Math.round((current / total) * 100);
    
    if (grid && progress < 100) {
        grid.innerHTML = `
            <div class="loading" style="text-align: center; padding: 40px;">
                <h3>🚀 Scanning Marketplace...</h3>
                <div style="width: 200px; height: 8px; background: #333; border-radius: 4px; margin: 20px auto;">
                    <div style="width: ${progress}%; height: 100%; background: #00d1ff; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
                <p>${progress}% complete (${current}/${total} tokens scanned)</p>
            </div>
        `;
    }
}

// ==== DIRECT RENDERER ====
const TYPE_MAPPING = {
    // Name to Number (for images)
    normal: 1,
    fighting: 2, 
    flying: 3,
    poison: 4,
    ground: 5,
    rock: 6,
    bug: 7,
    ghost: 8,
    steel: 9,
    fire: 10,
    water: 11,
    grass: 12,
    electric: 13,
    psychic: 14,
    ice: 15,
    dragon: 16,
    dark: 17,
    fairy: 18
};

// ==== REVERSE MAPPING FOR NUMBER TO NAME ====
const NUMBER_TO_TYPE = {};
for (const [name, number] of Object.entries(TYPE_NUMBER)) {
    NUMBER_TO_TYPE[number] = name;
}

// ==== SIMPLIFIED DIRECT RENDERER ====
// ==== FIXED DIRECT RENDERER ====
function renderMarketplaceDirect(listings) {
    const grid = document.getElementById("nfts-grid");
    if (!grid) {
        console.error("nfts-grid element not found in render!");
        return;
    }
    
    console.log("Starting render with", listings.length, "listings");
    
    grid.innerHTML = "";
    
    if (listings.length === 0) {
        grid.innerHTML = `<div class="no-nfts"><h3>Marketplace Empty</h3></div>`;
        return;
    }
    
    const cardsHTML = listings.map(item => {
        const pokemon = pokemonDataCache[item.pokemonId];
        if (!pokemon) {
            console.warn(`Pokémon data not found for ID: ${item.pokemonId}`);
            return '';
        }
        
        const imageUrl = pokemon.image.hires || pokemon.image.thumbnail || pokemon.image.sprite;
        const pokemonName = pokemon.name.english;
        const pokemonTypes = pokemon.type; // This is array of strings like ['Grass', 'Poison']
        const price = ethers.utils.formatUnits(item.listing.price, 18);
        
        console.log(`Rendering ${pokemonName} with types:`, pokemonTypes);
        
        // FIXED: Convert type names to numbers for image URLs
        let typeBadgesHTML = '';
        if (pokemonTypes && Array.isArray(pokemonTypes)) {
            typeBadgesHTML = pokemonTypes.map(typeName => {
                // Convert to lowercase for mapping
                const lowerType = typeName.toLowerCase();
                const typeNumber = TYPE_MAPPING[lowerType];
                
                console.log(`Converting ${typeName} to number: ${typeNumber}`);
                
                if (!typeNumber) {
                    console.warn(`Unknown type name: ${typeName}`);
                    return `<span class="type-fallback">${typeName}</span>`;
                }
                
                return `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/brilliant-diamond-and-shining-pearl/${typeNumber}.png" 
                          alt="${typeName}" 
                          class="type-badge"
                          title="${typeName}"
                          onerror="this.style.display='none'">`;
            }).join('');
        }
        
        const isOwner =
  window.userAddress &&
  item.listing.seller.toLowerCase() === window.userAddress.toLowerCase();

const buyButtonHTML = isOwner
  ? `<button class="buy-btn disabled" disabled>Your Listing</button>`
  : `<button class="buy-btn" onclick="buyListedNFT(${item.tokenId})">Buy Now</button>`;

return `
  <div class="nft-card">
    <div class="nft-image-container">
      <img src="${imageUrl}" alt="${pokemonName}" loading="lazy">
      <div class="nft-rarity">#${pokemon.id}</div>
      <div class="listed-badge">FOR SALE</div>
    </div>

    <div class="nft-info">
      <h3 class="nft-name">${pokemonName}</h3>
      <div class="type-badges-container">
        ${typeBadgesHTML || '<span class="type-fallback">No types</span>'}
      </div>
      <p class="nft-price">${price} PKN</p>
    </div>

    ${buyButtonHTML}
  </div>
`;

    }).join('');
    
    grid.innerHTML = cardsHTML;
    console.log(`✅ Marketplace loaded: ${listings.length} Pokémon`);
}
//<p class="nft-owner">Seller: ${item.listing.seller.slice(0, 6)}...${item.listing.seller.slice(-4)}</p>
// ==== INSTANT RENDERER ====
// ==== INSTANT RENDERER WITH FALLBACKS ====
function renderMarketplaceWithJSON(listings, grid) {
    grid.innerHTML = "";
    
    if (listings.length === 0) {
        grid.innerHTML = `<div class="no-nfts"><h3>Marketplace Empty</h3></div>`;
        return;
    }
    
    const cardsHTML = listings.map(item => {
        const pokemon = pokemonDataCache[item.pokemonId];
        
        if (!pokemon) {
            console.warn(`Pokémon data not found for ID: ${item.pokemonId}`);
            return '';
        }
        
        // Use hires image, fallback to thumbnail, fallback to sprite
        const imageUrl = pokemon.image.hires || pokemon.image.thumbnail || pokemon.image.sprite;
        const pokemonName = pokemon.name.english;
        const pokemonTypes = pokemon.type.join(' / ').toUpperCase();
        const price = ethers.utils.formatUnits(item.listing.price, 18);
        
        return `
            <div class="nft-card">
                <div class="nft-image-container">
                    <img src="${imageUrl}" alt="${pokemonName}" loading="lazy">
                    <div class="nft-rarity">#${pokemon.id}</div>
                    <div class="listed-badge">FOR SALE</div>
                </div>
                <div class="nft-info">
                    <h3 class="nft-name">${pokemonName}</h3>
                    <p class="types">${pokemonTypes}</p>
                    <p class="nft-price">${price} PKN</p>
                    <p class="nft-owner">Seller: ${item.listing.seller.slice(0, 6)}...${item.listing.seller.slice(-4)}</p>
                </div>
                <button class="buy-btn" onclick="buyListedNFT(${item.tokenId})">Buy Now</button>
            </div>
        `;
    }).join('');
    
    grid.innerHTML = cardsHTML;
    console.log(`✅ Marketplace loaded: ${listings.length} Pokémon`);
}

function renderMarketplaceWithJSON(listings, pokemonData, grid) {
    grid.innerHTML = "";
    
    if (listings.length === 0) {
        grid.innerHTML = `<div class="no-nfts"><h3>Marketplace Empty</h3></div>`;
        return;
    }
    
    const cardsHTML = listings.map(item => {
        const pokemon = pokemonData[item.pokemonId];
        if (!pokemon) return '';
        
        return `
            <div class="nft-card">
                <div class="nft-image-container">
                    <img src="${pokemon.images.official_artwork}" alt="${pokemon.name}">
                    <div class="nft-rarity">#${pokemon.id}</div>
                    <div class="listed-badge">FOR SALE</div>
                </div>
                <div class="nft-info">
                    <h3>${pokemon.name}</h3>
                    <p class="types">${pokemon.types.join(' / ')}</p>
                    <p class="nft-price">${ethers.utils.formatUnits(item.listing.price, 18)} PKN</p>
                </div>
                <button class="buy-btn" onclick="buyListedNFT(${item.tokenId})">Buy Now</button>
            </div>
        `;
    }).join('');
    
    grid.innerHTML = cardsHTML;
    console.log(`Marketplace loaded: ${listings.length} Pokémon`);
}

// ==== RENDER MARKETPLACE GRID ====



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

if (window.ethereum && window.ethereum.selectedAddress) {
  sessionStorage.setItem("walletConnected", "true");
  sessionStorage.setItem("userAddress", window.ethereum.selectedAddress);
}