// my-nfts.js — SIMPLIFIED VERSION
console.log("my-nfts.js loaded");

// Use var instead of let to avoid redeclaration errors
if (typeof nftContract === 'undefined') {
    var nftContract, pknContract, marketContract;
}

// Contract addresses
const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const PKN_ADDRESS = "0xD7CD2d7Dcb96B9D70A10605F06Ee84C24515D684";
const MARKET_ADDRESS = "0x307e03dF77f93b6B486f07287740EeA01BAE25d0";

// ABIs
const NFT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function getPokemonId(uint256 tokenId) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId)",
    "function pokemonMinted(uint256) view returns (bool)"
];

const PKN_ABI = [
    "function balanceOf(address) view returns (uint256)"
];

const MARKET_ABI = [
    "function getListing(uint256 tokenId) view returns (tuple(uint256 tokenId, uint256 price, address seller))",
    "function list(uint256 tokenId, uint256 price)",
    "function cancel(uint256 tokenId)"
];

// ==== INIT INVENTORY ====
async function initInventory() {
    console.log("initInventory called, userAddress:", window.userAddress);
    
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

        // Update UI
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

// ==== LOAD INVENTORY ====
async function loadMyNFTs() {
    const grid = document.getElementById("nfts-grid");
    if (!grid) return;

    grid.innerHTML = `<p class="loading">Loading your Pokémon...</p>`;

    try {
        let ownedNFTs = [];
        
        // Check first 50 tokens to find which ones you own
        for (let tokenId = 1; tokenId <= 50; tokenId++) {
            try {
                const owner = await nftContract.ownerOf(tokenId);
                if (owner.toLowerCase() === window.userAddress.toLowerCase()) {
                    const pokemonId = Number(await nftContract.getPokemonId(tokenId));
                    ownedNFTs.push({ tokenId, pokemonId });
                    console.log(`Found owned NFT: tokenId=${tokenId}, pokemonId=${pokemonId}`);
                }
            } catch (err) {
                // Token doesn't exist, skip it
            }
        }

        console.log(`Found ${ownedNFTs.length} owned NFTs`);

        if (ownedNFTs.length === 0) {
            grid.innerHTML = `
                <div class="no-nfts">
                    <h3>No Pokémon Found</h3>
                    <p>You don't own any Pokémon NFTs yet.</p>
                    <a href="marketplace.html">Go to Marketplace to mint some!</a>
                </div>`;
            return;
        }

        grid.innerHTML = "";

        // Display owned NFTs
        for (const { tokenId, pokemonId } of ownedNFTs) {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
                if (!res.ok) continue;
                
                const data = await res.json();
                const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);
                const image = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
                const types = data.types.map(t => t.type.name.toUpperCase()).join(' / ');

                const card = document.createElement("div");
                card.className = "nft-card";
                card.innerHTML = `
                    <div class="nft-image-container">
                        <img src="${image}" alt="${name}">
                        <div class="nft-rarity">#${pokemonId}</div>
                    </div>
                    <div class="nft-info">
                        <h3>${name}</h3>
                        <p class="types">${types}</p>
                        <p class="nft-id">Token ID: ${tokenId}</p>
                    </div>
                    <button class="sell-btn" onclick="listForSale(${tokenId})">List for Sale</button>
                `;
                grid.appendChild(card);

            } catch (err) {
                console.warn(`Failed to load Pokémon ${pokemonId}:`, err);
            }
        }

    } catch (err) {
        console.error("Inventory error:", err);
        grid.innerHTML = `<p class="error">Failed to load inventory: ${err.message}</p>`;
    }
}

// ==== LIST FOR SALE ====
async function listForSale(tokenId) {
    const price = prompt("Price in PKN?", "100");
    if (!price) return;
    
    try {
        await (await nftContract.approve(MARKET_ADDRESS, tokenId)).wait();
        await (await marketContract.list(tokenId, ethers.utils.parseUnits(price, 18))).wait();
        alert("Listed for sale!");
        await loadMyNFTs();
    } catch (err) {
        alert("Failed to list: " + err.message);
    }
}

// Make functions global
window.initInventory = initInventory;
window.listForSale = listForSale;

console.log("my-nfts.js initialization complete");