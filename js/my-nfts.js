// my-nfts.js
async function loadMyNFTs() {
  const grid = document.getElementById("nfts-grid");
  if (!grid) return;

  if (!window.userAddress || !window.nftContract) {
    grid.innerHTML = `<p class="loading">Connect wallet to view your NFTs...</p>`;
    return;
  }

  grid.innerHTML = `<p class="loading">Loading your Pokémon NFTs...</p>`;

  try {
    const balance = await window.nftContract.balanceOf(window.userAddress);
    const balanceNum = balance.toNumber();

    if (balanceNum === 0) {
      grid.innerHTML = `<p class="no-nfts">No NFTs yet. <a href="marketplace.html">Buy some!</a></p>`;
      return;
    }

    grid.innerHTML = "";
    const tokenIds = [];

    // Get all owned token IDs
    for (let i = 0; i < balanceNum; i++) {
      const tokenId = await window.nftContract.tokenOfOwnerByIndex(window.userAddress, i);
      tokenIds.push(tokenId.toNumber());
    }

    // Load metadata for each
    for (const tokenId of tokenIds) {
      const pokemonId = await window.nftContract.getPokemonId(tokenId);
      const uri = await window.nftContract.tokenURI(tokenId);
      const response = await fetch(uri);
      const metadata = await response.json();
      const image = metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/");

      const card = document.createElement("div");
      card.className = "nft-card";
      card.innerHTML = `
        <div class="nft-image-container">
          <img src="${image}" alt="Pokémon #${pokemonId}">
          <div class="nft-rarity">NFT #${tokenId}</div>
        </div>
        <div class="nft-info">
          <h3 class="nft-name">Pokémon #${pokemonId}</h3>
          <p class="nft-id">Token ID: ${tokenId}</p>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Load NFTs error:", err);
    grid.innerHTML = `<p class="error">Failed to load NFTs. Try refreshing.</p>`;
  }
}

// AUTO LOAD ON PAGE LOAD
window.addEventListener("load", () => {
  if (window.userAddress) {
    updateWalletUI();
    loadMyNFTs();
  }
});