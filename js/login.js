// js/login.js
async function login() {
  try {
    if (!window.ethereum) {
      alert("Install MetaMask: https://metamask.io");
      window.open("https://metamask.io", "_blank");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts[0];

    // CHANGE BUTTON TO "Connected"
    const loginBtn = document.getElementById("login-btn");
    loginBtn.querySelector("span").textContent = "Connected";
    loginBtn.classList.add("connected");
    loginBtn.disabled = true;

    // SHOW WALLET
    const walletInfo = document.getElementById("wallet-info");
    walletInfo.style.display = "block";
    document.getElementById("address").textContent = `${address.slice(0,6)}...${address.slice(-4)}`;

    // SHOW MARKETPLACE LINK
    const marketplaceLink = document.getElementById("marketplace-link");
    marketplaceLink.style.display = "inline";  // This line was missing!

    window.userAddress = address;
    alert("Connected! Marketplace unlocked.");

  } catch (err) {
    console.error(err);
    if (err.code === 4001) {
      alert("Connection cancelled.");
    } else {
      alert("Error: " + err.message);
    }
  }
}

// Attach click
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-btn").addEventListener("click", login);
});

// js/login.js – SHARED LOGIN FOR ALL PAGES

let userAddress = null;

async function connectWallet() {
  if (!window.ethereum) {
    alert("Install MetaMask!");
    return;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    // SAVE GLOBALLY
    window.userAddress = userAddress;

    // UPDATE UI
    updateLoginUI();

    // TRIGGER PAGE LOADS
    if (typeof loadMarketplace === "function") loadMarketplace();
    if (typeof loadMyNFTs === "function") loadMyNFTs();

  } catch (err) {
    alert("Connection failed: " + err.message);
  }
}

function updateLoginUI() {
  const info = document.getElementById("wallet-info");
  const addr = document.getElementById("address");
  const btn = document.querySelector(".login-btn span");
  const loginBtn = document.querySelector(".login-btn");

  if (info && addr && btn && loginBtn && userAddress) {
    info.style.display = "block";
    addr.textContent = `${userAddress.slice(0,6)}...${userAddress.slice(-4)}`;
    btn.textContent = "Connected";
    loginBtn.classList.add("connected");
    loginBtn.disabled = true;
  }
}

// AUTO-UPDATE ON LOAD
window.addEventListener("load", () => {
  if (window.userAddress) {
    userAddress = window.userAddress;
    updateLoginUI();
    if (typeof loadMarketplace === "function") loadMarketplace();
    if (typeof loadMyNFTs === "function") loadMyNFTs();
  }
});