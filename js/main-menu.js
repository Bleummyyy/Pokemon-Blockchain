/* ===== CONFIG ===== */
const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const NFT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPokemonId(uint256 tokenId) view returns (uint256)",
  "function pokemonMinted(uint256) view returns (bool)",
  "function tokenIdCounter() view returns (uint256)"
];

/* ===== LOCAL JSON CACHE ===== */
let pokedexCache = null;
const JSON_URL = '/pokemondata/pokedex.json';

async function loadPokedexCache() {
  if (pokedexCache) return pokedexCache;
  try {
    const res = await fetch(JSON_URL);
    pokedexCache = await res.json();
    console.log('✅ Local pokedex cached:', pokedexCache.length, 'entries');
  } catch (e) {
    console.warn('⚠️  local JSON missing – falling back to API');
    pokedexCache = [];
  }
  return pokedexCache;
}

/* ===== TYPE BADGE HELPER ===== */
const TYPE_NUMBER = {
  normal:1, fighting:2, flying:3, poison:4, ground:5, rock:6, bug:7, ghost:8,
  steel:9, fire:10, water:11, grass:12, electric:13, psychic:14, ice:15,
  dragon:16, dark:17, fairy:18
};
function makeTypeBadge(typeName) {
  const num = TYPE_NUMBER[typeName.toLowerCase()];
  if (!num) return document.createElement('span');
  const img = new Image();
  img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/brilliant-diamond-and-shining-pearl/${num}.png`;
  img.className = 'type-badge';
  img.alt = typeName;
  img.onerror = () => img.remove();
  return img;
}

/* ===== CENTRE-SPRITE (ANIMATED) ===== */
async function loadUserPokemon(walletAddress) {
  console.log("🎯 loadUserPokemon called for:", walletAddress);
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);

    let pokemonId = Number(localStorage.getItem('selectedPokemonToken')) || 0;
    if (!pokemonId) {
      // Find first owned token
      const totalTokens = await nftContract.tokenIdCounter();
      console.log('Total tokens minted:', totalTokens.toString());
      
      for (let tokenId = 0; tokenId < totalTokens; tokenId++) {
        try {
          const owner = await nftContract.ownerOf(tokenId);
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            pokemonId = tokenId;
            break;
          }
        } catch {
          continue; // Token doesn't exist or error
        }
      }
    }
    
    if (!pokemonId && pokemonId !== 0) {
      document.getElementById("pokemon-display").innerHTML = "";
      return;
    }

    // Get the Pokémon ID for this token
    const pokemonNumber = await nftContract.getPokemonId(pokemonId);
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonNumber}`);
    const name = res.ok ? (await res.json()).name : `pokemon${pokemonNumber}`;
    const sprite = `https://img.pokemondb.net/sprites/black-white/anim/normal/${name.toLowerCase()}.gif`;
    document.getElementById("pokemon-display").innerHTML =
      `<img src="${sprite}" alt="pokemon" class="center-sprite">`;
  } catch (err) {
    console.error("❌ loadUserPokemon failed:", err);
    document.getElementById("pokemon-display").innerHTML = "";
  }
}

/* ===== PANEL TILES (ALL OWNED TOKENS) ===== */
async function loadPlayerPokemon() {
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '<div class="loading-spinner"></div>';
  
  await loadPokedexCache();
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);

  try {
    // Get total tokens minted
    const totalTokens = await nftContract.tokenIdCounter();
    console.log('Total tokens minted:', totalTokens.toString());
    
    if (totalTokens.eq(0)) {
      grid.innerHTML = '<p style="color:#aaa">No Pokémon have been minted yet.</p>';
      return;
    }

    // FAST SCAN: Use balanceOf + parallel requests
    const balance = await nftContract.balanceOf(window.userAddress);
    console.log('User balance:', balance.toString());
    
    if (balance.eq(0)) {
      grid.innerHTML = '<p style="color:#aaa">You own no Pokémon.</p>';
      return;
    }

    // Parallel scan for much faster loading
    const owned = [];
    const scanPromises = [];
    
    for (let tokenId = 0; tokenId < totalTokens; tokenId++) {
      scanPromises.push(
        (async (id) => {
          try {
            const owner = await nftContract.ownerOf(id);
            if (owner.toLowerCase() === window.userAddress.toLowerCase()) {
              const pokemonId = await nftContract.getPokemonId(id);
              return { tokenId: id, pokemonId: pokemonId.toNumber() };
            }
          } catch {
            // Token doesn't exist or error - skip silently
          }
          return null;
        })(tokenId)
      );
    }

    // Wait for all scans to complete
    const results = await Promise.all(scanPromises);
    results.forEach(result => {
      if (result) owned.push(result);
    });

    console.log('Scan complete – total owned:', owned.length, owned);

    // Build tiles
    grid.innerHTML = '';
    if (owned.length === 0) {
      grid.innerHTML = '<p style="color:#aaa">You own no Pokémon.</p>';
      return;
    }

    for (const { tokenId, pokemonId } of owned) {
      const local = pokedexCache.find(p => p.id === pokemonId);
      const name = local ? local.name.english : `Pokémon #${pokemonId}`;
      const sprite = local ? local.image.hires
        : `https://img.pokemondb.net/sprites/black-white/normal/${pokemonId}.png`;
      const types = local ? (Array.isArray(local.type) ? local.type : [local.type])
        : ['unknown'];

      const tile = document.createElement('div');
      tile.className = 'pokemon-tile';
      tile.innerHTML = `
        <img src="${sprite}" alt="${name}" loading="lazy" 
             onerror="this.src='https://img.pokemondb.net/sprites/black-white/normal/${pokemonId}.png'">
        <span class="name">${name}</span>
        <span class="types"></span>
      `;
      
      const typeDiv = tile.querySelector('.types');
      types.forEach(t => typeDiv.appendChild(makeTypeBadge(t)));

      tile.dataset.tokenId = tokenId;
      tile.onclick = () => selectPokemonForBattle(tokenId);
      grid.appendChild(tile);
    }

  } catch (err) {
    console.error('Error loading Pokémon:', err);
    grid.innerHTML = '<p style="color:red">Error loading your Pokémon. Check console for details.</p>';
  }
}

function selectPokemonForBattle(tokenId) {
  localStorage.setItem('selectedPokemonToken', tokenId);
  document.getElementById('pokemon-panel').classList.add('hidden');
  loadUserPokemon(window.userAddress);
}

/* ===== WALLET + PANEL BINDINGS ===== */
document.addEventListener("DOMContentLoaded", async () => {
  // Check wallet connection
  const connected = localStorage.getItem("walletConnected");
  const address = localStorage.getItem("userAddress");
  
  console.log('Wallet connection status:', { connected, address });
  
  if (connected && address) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      
      if (accounts[0]?.toLowerCase() === address.toLowerCase()) {
        window.userAddress = address;
        console.log('User address set:', window.userAddress);
        await loadUserPokemon(address);
      } else {
        console.log('Connected wallet does not match stored address');
        // Reset connection if mismatch
        localStorage.removeItem("walletConnected");
        localStorage.removeItem("userAddress");
      }
    } catch (err) {
      console.error('Error initializing wallet:', err);
    }
  }

  // Panel bindings
  const btn = document.getElementById('choose-pokemon-btn');
  const panel = document.getElementById('pokemon-panel');
  const close = document.getElementById('close-panel-btn');
  
  if (!btn || !panel || !close) {
    console.error('Missing required elements:', { btn, panel, close });
    return;
  }
  
  btn.addEventListener('click', async () => {
    console.log('Opening Pokémon panel...');
    if (!window.userAddress) {
      alert('Please connect your wallet first!');
      return;
    }
    panel.classList.remove('hidden');
    await loadPlayerPokemon();
  });
  
  close.addEventListener('click', () => panel.classList.add('hidden'));
});

/* ===== ARENA TOURNAMENT SYSTEM ===== */
/* ===== ARENA TOURNAMENT SYSTEM ===== */
async function enterArena() {
  if (!window.userAddress) {
    alert('Please connect your wallet first!');
    return;
  }
  
  const selectedToken = localStorage.getItem('selectedPokemonToken');
  if (!selectedToken && selectedToken !== '0') {
    alert('Please select a Pokémon first!');
    document.getElementById('choose-pokemon-btn').click();
    return;
  }
  
  // Show opponent count selection
  const opponentCount = await showOpponentSelection();
  if (opponentCount) {
    // Start tournament immediately with selected opponent count
    startQuickTournament(opponentCount);
  }
}

function showOpponentSelection() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;
    
    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #CD853F, #D2691E);
        border: 3px solid #8B4513;
        border-radius: 15px;
        padding: 30px;
        text-align: center;
        color: #8B4513;
        min-width: 300px;
      ">
        <h2 style="margin-bottom: 20px;">⚔️ Round Robin Battle Arena</h2>
        <p style="margin-bottom: 20px; font-weight: bold;">Choose your opponents:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          <button class="opponent-btn" data-count="1">1 Opponent</button>
          <button class="opponent-btn" data-count="3">3 Opponents</button>
          <button class="opponent-btn" data-count="7">7 Opponents</button>
          <button class="opponent-btn" data-count="15">15 Opponents</button>
        </div>
        <button id="cancel-battle" style="
          background: #8B4513;
          color: #FFEBCD;
          border: 2px solid #A0522D;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
        ">Cancel</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add styles for opponent buttons
    const style = document.createElement('style');
    style.textContent = `
      .opponent-btn {
        background: #D2691E;
        color: #FFEBCD;
        border: 2px solid #8B4513;
        padding: 15px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s ease;
      }
      .opponent-btn:hover {
        background: #CD853F;
        transform: scale(1.05);
      }
    `;
    document.head.appendChild(style);
    
    // Event listeners
    modal.querySelectorAll('.opponent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const count = parseInt(btn.dataset.count);
        document.body.removeChild(modal);
        document.head.removeChild(style);
        resolve(count);
      });
    });
    
    modal.querySelector('#cancel-battle').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
      resolve(null);
    });
  });
}

function startQuickTournament(opponentCount) {
  // Store tournament settings
  localStorage.setItem('tournamentOpponentCount', opponentCount);
  localStorage.setItem('quickTournament', 'true');
  
  // Navigate to battle page
  window.location.href = 'battle-tournament.html';
}