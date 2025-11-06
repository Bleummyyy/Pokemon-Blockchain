// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PokemonNFT is ERC721URIStorage {
    IERC20 public immutable pknToken;
    uint256 public tokenIdCounter;

    // NEW: Prevent duplicate Pokémon
    mapping(uint256 => bool) public pokemonMinted;

    mapping(uint256 => uint256) public tokenIdToPokemonId;

    uint256 public constant PRICE = 100 * 10**18; // 100 PKN

    constructor(address _pknToken) ERC721("Pokemon NFT", "PKMN") {
        require(_pknToken != address(0), "Invalid PKN address");
        pknToken = IERC20(_pknToken);
    }

    function mint(uint256 pokemonId, string calldata uri) external {
        require(!pokemonMinted[pokemonId], "Pokemon already minted! Each is unique.");
        require(pokemonId >= 1 && pokemonId <= 1025, "Invalid Pokemon ID (1-1025)");

        require(pknToken.transferFrom(msg.sender, address(this), PRICE), "Payment failed");

        uint256 tokenId = tokenIdCounter++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        pokemonMinted[pokemonId] = true;
        tokenIdToPokemonId[tokenId] = pokemonId;
    }

    // FIXED: Use ownerOf() instead of _exists()
    function getPokemonId(uint256 tokenId) external view returns (uint256) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenIdToPokemonId[tokenId];
    }
}