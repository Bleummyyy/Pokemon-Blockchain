let provider, signer;
window.userAddress = null;
window.pokemonData = null; // Global Pokémon cache

async function login() {
  if (!window.ethereum) {
    alert("Install MetaMask: https://metamask.io");
    window.open("https://metamask.io", "_blank");
    return;
  }

  try {
    // Show loading screen with Pokémon progress
    showPokemonLoading("Connecting wallet & loading Pokémon data...", 0);
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    window.userAddress = await signer.getAddress();

    localStorage.setItem("walletConnected", "true");
    localStorage.setItem("userAddress", window.userAddress);

    updateWalletUI();

    // SHOW MARKETPLACE LINK ON INDEX.HTML
    const link = document.getElementById("marketplace-link");
    if (link) link.style.display = "inline-block";

    // STEP 1: Check if we have cached Pokémon data
    const cachedPokemonData = localStorage.getItem("pokemonData");
    const cacheTimestamp = localStorage.getItem("pokemonDataTimestamp");
    const isCacheValid = cacheTimestamp && (Date.now() - cacheTimestamp < 24 * 60 * 60 * 1000); // 24 hours

    if (cachedPokemonData && isCacheValid) {
      // Use cached data - INSTANT
      console.log("🚀 Loading cached Pokémon data...");
      window.pokemonData = JSON.parse(cachedPokemonData);
      hidePokemonLoading();
      completeLogin();
    } else {
      // STEP 2: Load fresh Pokémon data with progress
      console.log("🔄 Fetching fresh Pokémon data...");
      await loadAllPokemonData();
      hidePokemonLoading();
      completeLogin();
    }

  } catch (err) {
    hidePokemonLoading();
    console.error(err);
    if (err.code === 4001) alert("Cancelled.");
    else alert("Error: " + err.message);
  }
}

// ==== POKÉMON DATA PRE-LOADING SYSTEM ====
async function loadAllPokemonData() {
  console.log("🚀 Starting Pokémon data pre-load...");
  window.pokemonData = {};
  
  const totalPokemon = 1025;
  const batchSize = 25; // Process 25 at a time
  let loadedCount = 0;

  // Process in batches for better performance and progress tracking
  for (let start = 1; start <= totalPokemon; start += batchSize) {
    const end = Math.min(start + batchSize - 1, totalPokemon);
    
    const batchPromises = [];
    for (let id = start; id <= end; id++) {
      batchPromises.push(loadSinglePokemon(id));
    }
    
    // Wait for current batch to complete
    await Promise.all(batchPromises);
    loadedCount = end;
    
    // Update loading progress
    const progress = Math.round((loadedCount / totalPokemon) * 100);
    updatePokemonLoadingProgress(progress, `Loading Pokémon... ${loadedCount}/${totalPokemon}`);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save to localStorage for future visits
  localStorage.setItem("pokemonData", JSON.stringify(window.pokemonData));
  localStorage.setItem("pokemonDataTimestamp", Date.now());
  
  console.log("✅ All Pokémon data pre-loaded!", window.pokemonData);
}

async function loadSinglePokemon(id) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!response.ok) {
      console.warn(`Pokémon ${id} not found`);
      return;
    }
    
    const data = await response.json();
    
    // Transform to optimized format
    window.pokemonData[id] = {
      id: data.id,
      name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
      types: data.types.map(t => t.type.name.toUpperCase()),
      images: {
        official_artwork: data.sprites.other['official-artwork']?.front_default || data.sprites.front_default,
        front_default: data.sprites.front_default,
        front_shiny: data.sprites.front_shiny
      },
      stats: {
        hp: data.stats[0].base_stat,
        attack: data.stats[1].base_stat,
        defense: data.stats[2].base_stat,
        special_attack: data.stats[3].base_stat,
        special_defense: data.stats[4].base_stat,
        speed: data.stats[5].base_stat
      },
      attacks: {
        basic: data.moves.slice(0, 3).map(m => m.move.name),
        special: data.moves.slice(3, 6).map(m => m.move.name)
      },
      metadata: {
        height: data.height / 10,
        weight: data.weight / 10,
        base_experience: data.base_experience,
        species: data.species?.name || "Unknown"
      }
    };
    
    return true;
  } catch (error) {
    console.warn(`Failed to load Pokémon ${id}:`, error.message);
    return false;
  }
}

// ==== LOADING UI FUNCTIONS ====
function showPokemonLoading(message, progress) {
  // Create or show loading overlay
  let loadingOverlay = document.getElementById('pokemon-loading-overlay');
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pokemon-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-overlay-content">
        <div class="loading-spinner"></div>
        <h3>Preparing Your Pokémon Adventure</h3>
        <p id="loading-message">${message}</p>
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <p id="loading-detail">Loading Pokémon data... 0%</p>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Add CSS styles
    const styles = `
      #pokemon-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        color: white;
        font-family: Arial, sans-serif;
      }
      .loading-overlay-content {
        text-align: center;
        max-width: 400px;
        padding: 40px;
        background: #1a1a1a;
        border-radius: 12px;
        border: 2px solid #00d1ff;
      }
      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #333;
        border-top: 4px solid #00d1ff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        background: #333;
        border-radius: 4px;
        margin: 20px 0;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #00d1ff, #ff6b35);
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
      }
      #loading-detail {
        color: #aaa;
        font-size: 0.9rem;
        margin-top: 10px;
      }
    `;
    if (!document.getElementById('loading-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'loading-styles';
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  }
  
  loadingOverlay.style.display = 'flex';
  updatePokemonLoadingProgress(progress, message);
}

function updatePokemonLoadingProgress(progress, message) {
  const progressFill = document.getElementById('progress-fill');
  const loadingDetail = document.getElementById('loading-detail');
  const loadingMessage = document.getElementById('loading-message');
  
  if (progressFill) progressFill.style.width = progress + '%';
  if (loadingDetail) loadingDetail.textContent = `Loading Pokémon data... ${progress}%`;
  if (loadingMessage && message) loadingMessage.textContent = message;
}

function hidePokemonLoading() {
  const loadingOverlay = document.getElementById('pokemon-loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// ==== COMPLETE LOGIN PROCESS ====
async function completeLogin() {
  // ONLY UPDATE PKN BALANCE IF FUNCTION EXISTS
  if (typeof updatePKNBalance === "function") {
    await updatePKNBalance();
  }

  alert("Connected! All Pokémon data loaded");

  // Auto-init pages if functions exist - NOW THEY WILL BE INSTANT!
  if (typeof initMarketplace === "function") initMarketplace();
  if (typeof loadMyNFTs === "function") loadMyNFTs();
}

// ==== EXISTING FUNCTIONS (UNCHANGED) ====
function updateWalletUI() {
  const info = document.getElementById("wallet-info");
  const addr = document.getElementById("address");
  const loginBtn = document.querySelector(".login-btn");
  const profile = document.getElementById("profile-dropdown");

  if (window.userAddress) {
    // SHOW WALLET INFO
    if (info && addr) {
      info.style.display = "flex";
      addr.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
    }

    // CHANGE LOGIN BUTTON TO "Connected"
    if (loginBtn) {
      const span = loginBtn.querySelector("span");
      if (span) span.textContent = "Connected";
      loginBtn.classList.add("connected");
      loginBtn.disabled = true;
      loginBtn.style.display = "block"; // KEEP VISIBLE
    }

    // SHOW PROFILE (ONLY ON MARKETPLACE/MYNFT)
    if (profile) {
      profile.style.display = "flex";
    }
  } else {
    // RESET ON LOGOUT
    if (info) info.style.display = "none";
    if (loginBtn) {
      const span = loginBtn.querySelector("span");
      if (span) span.textContent = "Login";
      loginBtn.classList.remove("connected");
      loginBtn.disabled = false;
      loginBtn.style.display = "block";
    }
    if (profile) profile.style.display = "none";
  }
}

// === TOGGLE DROPDOWN ===
function toggleDropdown() {
  const menu = document.getElementById("dropdown-menu");
  menu.classList.toggle("show");
}

// === LOGOUT ===
function logout() {
  // Clear wallet data
  localStorage.removeItem("walletConnected");
  localStorage.removeItem("userAddress");
  // DON'T clear Pokémon data - keep it for faster reloads
  window.userAddress = null;

  // Reset UI
  const walletInfo = document.getElementById("wallet-info");
  const profileDropdown = document.getElementById("profile-dropdown");
  const loginBtn = document.querySelector(".login-btn");

  if (walletInfo) walletInfo.style.display = "none";
  if (profileDropdown) profileDropdown.style.display = "none";
  if (loginBtn) {
    loginBtn.style.display = "block";
    loginBtn.querySelector("span").textContent = "Login";
    loginBtn.classList.remove("connected");
    loginBtn.disabled = false;
  }

  // REDIRECT TO HOMESCREEN
  window.location.href = "index.html";
}

// Close dropdown when clicking outside
window.addEventListener("click", (e) => {
  if (!e.target.matches(".profile-img") && !e.target.matches(".logout-btn")) {
    const menu = document.getElementById("dropdown-menu");
    if (menu && menu.classList.contains("show")) {
      menu.classList.remove("show");
    }
  }
});

// AUTO-RECONNECT + UPDATE UI
window.addEventListener("load", async () => {
  const saved = localStorage.getItem("userAddress");
  const connected = localStorage.getItem("walletConnected") === "true";

  if (connected && saved && !window.userAddress) {
    window.userAddress = saved;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      updateWalletUI();

      // SHOW MARKETPLACE LINK
      const link = document.getElementById("marketplace-link");
      if (link) link.style.display = "inline-block";

      // Load cached Pokémon data if available
      const cachedPokemonData = localStorage.getItem("pokemonData");
      if (cachedPokemonData) {
        window.pokemonData = JSON.parse(cachedPokemonData);
        console.log("Loaded cached Pokémon data");
      }

      // UPDATE PKN BALANCE ONLY IF AVAILABLE
      if (typeof updatePKNBalance === "function") {
        await updatePKNBalance();
      }

      if (typeof initMarketplace === "function") initMarketplace();
      if (typeof loadMyNFTs === "function") loadMyNFTs();

    } catch (err) {
      localStorage.removeItem("walletConnected");
      localStorage.removeItem("userAddress");
      alert("Wallet changed. Reconnect.");
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("login-btn");
  if (btn) btn.addEventListener("click", login);
});