// marketplace.js - FIXED VERSION (no totalSupply dependency)
let nftContract, pknContract, marketContract;
let listedNFTs = [];
let currentPage = 1;
const itemsPerPage = 20;

// Contract addresses
const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const PKN_ADDRESS = "0xD7CD2d7Dcb96B9D70A10605F06Ee84C24515D684";
const MARKET_ADDRESS = "0x307e03dF77f93b6B486f07287740EeA01BAE25d0";

// ABIs - REMOVED totalSupply
const NFT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getPokemonId(uint256 tokenId) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function pokemonMinted(uint256) view returns (bool)",
    "function mint(uint256 pokemonId, string memory uri) external", // THIS IS CRITICAL
    "function totalSupply() view returns (uint256)"
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
async function initMarketplace() {
    console.log("Initializing marketplace...", window.userAddress);
    
    if (!window.ethereum || !window.userAddress) {
        console.log("Wallet not connected yet");
        const grid = document.getElementById("nfts-grid");
        if (grid) {
            grid.innerHTML = `<p class="loading">Please connect your wallet first in the login page.</p>`;
        }
        return;
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
        pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
        marketContract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);

        window.nftContract = nftContract;
        window.pknContract = pknContract;
        window.marketContract = marketContract;

        // Update UI to show connected wallet
        updateMarketplaceUI();
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("Marketplace init failed:", err);
        const grid = document.getElementById("nfts-grid");
        if (grid) {
            grid.innerHTML = `<p class="error">Failed to initialize marketplace: ${err.message}</p>`;
        }
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
async function loadMarketplace() {
    const grid = document.getElementById("nfts-grid");
    if (!grid || !nftContract) {
        console.log("Marketplace not ready yet");
        return;
    }

    grid.innerHTML = `<p class="loading">Loading Pokémon Marketplace...</p>`;

    try {
        listedNFTs = [];
        grid.innerHTML = "";

        // METHOD 1: Check Pokémon 1-1025 to see which are minted
        console.log("Checking Pokémon 1-1025...");
        let availableNFTs = 0;

        // Check first 151 Pokémon (Gen 1) to start - faster loading
        for (let pokemonId = 1; pokemonId <= 151; pokemonId++) {
            try {
                // Check if this Pokémon is minted using pokemonMinted function
                const isMinted = await nftContract.pokemonMinted(pokemonId);
                
                if (isMinted) {
                    // Find the tokenId for this Pokémon
                    // We'll need to find a way to get tokenId from pokemonId
                    // For now, let's assume tokenId = pokemonId
                    const tokenId = pokemonId;
                    
                    try {
                        const owner = await nftContract.ownerOf(tokenId);
                        
                        // Skip if user owns this NFT
                        if (owner.toLowerCase() === window.userAddress.toLowerCase()) continue;

                        // Fetch Pokémon data
                        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
                        if (!res.ok) continue;
                        
                        const data = await res.json();
                        const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);
                        const image = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
                        const types = data.types.map(t => t.type.name.toUpperCase()).join(' / ');

                        // Fixed price for now
                        const price = "100";

                        const nftData = {
                            tokenId,
                            pokemonId,
                            name,
                            image,
                            types,
                            price,
                            owner
                        };

                        listedNFTs.push(nftData);
                        availableNFTs++;

                        const card = document.createElement("div");
                        card.className = "nft-card";
                        card.innerHTML = `
                            <div class="nft-image-container">
                                <img src="${image}" alt="${name}" loading="lazy">
                                <div class="nft-rarity">#${pokemonId}</div>
                            </div>
                            <div class="nft-info">
                                <h3 class="nft-name">${name}</h3>
                                <p class="types">${types}</p>
                                <p class="nft-price">${price} PKN</p>
                                <p class="nft-owner">Owner: ${owner.slice(0, 6)}...${owner.slice(-4)}</p>
                            </div>
                            <button class="buy-btn" onclick="buyNFT(${tokenId}, '${price}')">Buy Now</button>
                        `;
                        grid.appendChild(card);

                    } catch (err) {
                        console.warn(`Pokemon ${pokemonId} owner check failed:`, err.message);
                    }
                }
            } catch (err) {
                console.warn(`Pokemon ${pokemonId} check failed:`, err.message);
            }
        }

        if (availableNFTs === 0) {
            grid.innerHTML = `
                <div class="no-nfts">
                    <p>No Pokémon available for purchase yet.</p>
                    <p style="font-size: 14px; color: #666; margin-top: 10px;">
                        Pokémon will appear here once they are minted and listed for sale.
                    </p>
                </div>`;
        } else {
            console.log(`Loaded ${availableNFTs} Pokémon for sale`);
            applyFilters();
        }

    } catch (err) {
        console.error("Marketplace load error:", err);
        grid.innerHTML = `
            <div class="error">
                <p>Failed to load marketplace: ${err.message}</p>
                <button onclick="loadMarketplace()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Retry
                </button>
            </div>`;
    }
}

// ==== BUY NFT ====
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

        // For now, show a message since we don't have the actual buy function
        alert(`Would purchase Pokémon #${tokenId} for ${price} PKN\n\nThis feature will be available once the marketplace contract is fully implemented.`);
        
        // TODO: Implement actual purchase when marketplace contract is ready
        // const tx = await marketContract.buy(tokenId, { value: priceWei });
        // await tx.wait();
        
        // await updatePKNBalance();
        // await loadMarketplace();

    } catch (err) {
        console.error("Buy error:", err);
        alert("Purchase failed: " + (err.reason || err.message));
    }
}

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

// Prices for different mint options
const MINT_PRICES = {
    1: ethers.utils.parseUnits("50", 18),
    5: ethers.utils.parseUnits("200", 18),
    10: ethers.utils.parseUnits("400", 18)
};

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

        // Check allowance
        const allowance = await pknContract.allowance(window.userAddress, NFT_ADDRESS);
        if (allowance.lt(totalPrice)) {
            const approveTx = await pknContract.approve(NFT_ADDRESS, totalPrice);
            await approveTx.wait();
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
        
        // Show fullscreen minting animation
        showMintingAnimation(pokemonIds);

    } catch (err) {
        console.error("Gacha mint error:", err);
        alert("Minting failed: " + (err.reason || err.message));
    }
}

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

// ==== PROCEED WITH MINTING AFTER ANIMATION ====
async function proceedWithMinting(pokemonIds) {
    console.log("proceedWithMinting called with:", pokemonIds);
    
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
        const results = [];
        for (const pokemonId of pokemonIds) {
            try {
                const uri = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
                const tx = await nftContract.mint(pokemonId, uri);
                const receipt = await tx.wait();
                results.push({ pokemonId, success: true });
                
                if (overlay) {
                    const progress = Math.round((results.length / pokemonIds.length) * 100);
                    const p = overlay.querySelector('p');
                    if (p) p.textContent = `Minted ${results.length}/${pokemonIds.length} Pokémon (${progress}%)`;
                }
            } catch (err) {
                results.push({ pokemonId, success: false, error: err.message });
            }
        }

        showMintResults(results);
        await updatePKNBalance();
        await loadMarketplace();

    } catch (err) {
        console.error("Gacha mint error:", err);
        alert("Minting failed: " + (err.reason || err.message));
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