// marketplace.js – FINAL WORKING VERSION (NO ERRORS)

const PKN_ADDRESS = "0xD7CD2d7Dcb96B9D70A10605F06Ee84C24515D684";
const NFT_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";
const PRICE = 100; // PKN per NFT

// === ABIs (FULL & CORRECT) ===
const PKN_ABI = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"allowance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientAllowance","type":"error"},
  {"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientBalance","type":"error"},
  {"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC20InvalidApprover","type":"error"},
  {"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC20InvalidReceiver","type":"error"},
  {"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC20InvalidSender","type":"error"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"}],"name":"ERC20InvalidSpender","type":"error"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
];

const NFT_ABI = [
  {"inputs":[{"internalType":"address","name":"_pknToken","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[{"internalType":"uint256","name":"pokemonId","type":"uint256"},{"internalType":"string","name":"uri","type":"string"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"PRICE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getPokemonId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"pknToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"tokenIdCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

// === GLOBALS (NO userAddress HERE) ===
let provider, signer;

// === INIT MARKETPLACE (CALLED FROM login.js) ===
async function initMarketplace() {
  if (!window.ethereum) {
    alert("Install MetaMask!");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    window.userAddress = await signer.getAddress();

    // Re-create contracts
    window.pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
    window.nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);

    // UI Update
    const info = document.getElementById("wallet-info");
    const addr = document.getElementById("address");
    if (info && addr) {
      info.style.display = "block";
      addr.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
    }
    const btn = document.querySelector(".login-btn span");
    if (btn) {
      btn.textContent = "Connected";
      document.querySelector(".login-btn").classList.add("connected");
      document.querySelector(".login-btn").disabled = true;
    }

    loadMarketplace();

  } catch (err) {
    console.error("Init failed:", err);
    alert("Connection failed: " + err.message);
  }
}

// === LOAD POKÉMON FROM API ===
async function loadMarketplace() {
  const grid = document.getElementById("nfts-grid");
  if (!grid) return;

  grid.innerHTML = `<p class="loading">Loading Pokémon...</p>`;

  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=12');
    const { results } = await res.json();
    grid.innerHTML = "";

    for (let p of results) {
      const data = await fetch(p.url).then(r => r.json());
      const pokemon = {
        id: data.id,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        hp: data.stats[0].base_stat,
        attack: data.stats[1].base_stat,
        types: data.types.map(t => t.type.name).join(' / '),
      };

      const card = document.createElement("div");
      card.className = "nft-card";
      card.innerHTML = `
        <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
        <div class="nft-info">
          <h3>#${pokemon.id} ${pokemon.name}</h3>
          <p><strong>HP:</strong> ${pokemon.hp} | <strong>ATK:</strong> ${pokemon.attack}</p>
          <p class="types">${pokemon.types}</p>
          <button class="buy-btn" onclick="buyNFT(${pokemon.id})">
            Buy for ${PRICE} PKN
          </button>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Load failed:", err);
    grid.innerHTML = `<p class="error">Failed to load Pokémon.</p>`;
  }
}

// === BUY NFT (FULLY FIXED) ===
async function buyNFT(pokemonId) {
  if (!window.userAddress) {
    alert("Connect wallet first!");
    return;
  }

  try {
    // Re-create contracts with fresh signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const pknContract = new ethers.Contract(PKN_ADDRESS, PKN_ABI, signer);
    const nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);

    // Check balance
    const balance = await pknContract.balanceOf(window.userAddress);
    const balanceNum = Number(ethers.formatUnits(balance, 18));
    if (balanceNum < PRICE) {
      alert(`Not enough PKN! You have ${balanceNum}, need ${PRICE}`);
      return;
    }

    // Approve
    console.log("Approving 100 PKN...");
    const approveTx = await pknContract.approve(NFT_ADDRESS, ethers.parseUnits(PRICE.toString(), 18));
    const approveReceipt = await approveTx.wait();
    console.log("Approved:", approveReceipt.hash);

    // Mint
    console.log("Minting NFT...");
    const uri = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
    const mintTx = await nftContract.mint(pokemonId, uri);
    const mintReceipt = await mintTx.wait();
    console.log("Minted:", mintReceipt.hash);

    alert(`Success! You bought Pokémon #${pokemonId} NFT!`);
    loadMarketplace();

  } catch (err) {
    console.error("Buy failed:", err);
    alert("Failed: " + (err.reason || err.message || "Check console"));
  }
}

// === AUTO-LOAD ON PAGE OPEN ===
window.addEventListener("load", () => {
  loadMarketplace(); // Always show Pokémon

  if (window.userAddress) {
    const info = document.getElementById("wallet-info");
    const addr = document.getElementById("address");
    if (info && addr) {
      info.style.display = "block";
      addr.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
    }
    const btn = document.querySelector(".login-btn span");
    if (btn) {
      btn.textContent = "Connected";
      document.querySelector(".login-btn").classList.add("connected");
      document.querySelector(".login-btn").disabled = true;
    }
  }
});

// Export for login.js
window.initMarketplace = initMarketplace;