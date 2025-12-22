// js/config.js
const NFT_ADDRESS = "0x190A26bbAFD2Ae85B2eD205Eb01292Ba35Db0A3D";
const NFT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPokemonId(uint256 tokenId) view returns (uint256)",
  "function pokemonMinted(uint256) view returns (bool)",
  "function tokenIdCounter() view returns (uint256)"
];

let pokedexCache = null;

async function loadPokedexCache() {
  if (pokedexCache) return pokedexCache;
  try {
    const res = await fetch('/pokemondata/pokedex.json');
    pokedexCache = await res.json();
    console.log('✅ Local pokedex cached:', pokedexCache.length, 'entries');
  } catch (e) {
    console.warn('⚠️  local JSON missing – falling back to API');
    pokedexCache = [];
  }
  return pokedexCache;
}