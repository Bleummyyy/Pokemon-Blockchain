// // js/login.js – FINAL: WORKS WITH cdn.jsdelivr.net

// let provider, signer;
// window.userAddress = null;

// // In login() function, after connecting:
// if (typeof initMarketplace === "function") {
//   setTimeout(initMarketplace, 100); // Wait for marketplace.js to load
// }

// async function login() {
//   if (!window.ethereum) {
//     alert("Install MetaMask: https://metamask.io");
//     window.open("https://metamask.io", "_blank");
//     return;
//   }

//   try {
//     provider = new ethers.providers.Web3Provider(window.ethereum);
//     await provider.send("eth_requestAccounts", []);
//     signer = await provider.getSigner();
//     window.userAddress = await signer.getAddress();

//     localStorage.setItem("walletConnected", "true");
//     localStorage.setItem("userAddress", window.userAddress);

//     updateWalletUI();

//     const link = document.getElementById("marketplace-link");
//     if (link) link.style.display = "inline-block";

//     alert("Connected! Marketplace unlocked.");

//     if (typeof loadMarketplace === "function") loadMarketplace();
//     if (typeof loadMyNFTs === "function") loadMyNFTs();

//   } catch (err) {
//     console.error(err);
//     if (err.code === 4001) alert("Cancelled.");
//     else alert("Error: " + err.message);
//   }
// }

// function updateWalletUI() {
//   const info = document.getElementById("wallet-info");
//   const addr = document.getElementById("address");
//   const btnSpan = document.querySelector(".login-btn span");
//   const loginBtn = document.querySelector(".login-btn");

//   if (info && addr && btnSpan && loginBtn && window.userAddress) {
//     info.style.display = "block";
//     addr.textContent = `${window.userAddress.slice(0,6)}...${window.userAddress.slice(-4)}`;
//     btnSpan.textContent = "Connected";
//     loginBtn.classList.add("connected");
//     loginBtn.disabled = true;
//   }
// }

// window.addEventListener("load", async () => {
//   const saved = localStorage.getItem("userAddress");
//   const connected = localStorage.getItem("walletConnected") === "true";

//   if (connected && saved && !window.userAddress) {
//     window.userAddress = saved;
//     try {
//       provider = new ethers.providers.Web3Provider(window.ethereum);
//       signer = await provider.getSigner();

//       updateWalletUI();

//       const link = document.getElementById("marketplace-link");
//       if (link) link.style.display = "inline-block";

//       if (typeof loadMarketplace === "function") loadMarketplace();
//       if (typeof loadMyNFTs === "function") loadMyNFTs();

//     } catch (err) {
//       localStorage.clear();
//       alert("Wallet changed. Reconnect.");
//     }
//   }
// });

// document.addEventListener("DOMContentLoaded", () => {
//   const btn = document.getElementById("login-btn");
//   if (btn) btn.addEventListener("click", login);
// });








// js/login.js – FINAL: CONNECTED BUTTON ON ALL PAGES

let provider, signer;
window.userAddress = null;

async function login() {
  if (!window.ethereum) {
    alert("Install MetaMask: https://metamask.io");
    window.open("https://metamask.io", "_blank");
    return;
  }

  try {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    window.userAddress = await signer.getAddress();

    localStorage.setItem("walletConnected", "true");
    localStorage.setItem("userAddress", window.userAddress);

    updateWalletUI(); // ← THIS UPDATES ALL PAGES

    const link = document.getElementById("marketplace-link");
    if (link) link.style.display = "inline-block";

    alert("Connected!");

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
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();

      updateWalletUI(); // ← THIS MAKES BUTTON "Connected"

      const link = document.getElementById("marketplace-link");
      if (link) link.style.display = "inline-block";

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

