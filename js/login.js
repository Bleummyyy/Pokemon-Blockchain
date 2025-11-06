let provider, signer;
window.userAddress = null;

async function login() {
  if (!window.ethereum) {
    alert("Install MetaMask: https://metamask.io");
    window.open("https://metamask.io", "_blank");
    return;
  }

  try {
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

    // ONLY UPDATE PKN BALANCE IF FUNCTION EXISTS
    if (typeof updatePKNBalance === "function") {
      await updatePKNBalance();
    }

    alert("Connected!");

    // Auto-init pages if functions exist
    if (typeof initMarketplace === "function") initMarketplace();
    if (typeof loadMyNFTs === "function") loadMyNFTs();

  } catch (err) {
    console.error(err);
    if (err.code === 4001) alert("Cancelled.");
    else alert("Error: " + err.message);
  }
}

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

