// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PokemonNFT is ERC721URIStorage {
    IERC20 public pknToken;
    uint256 public tokenIdCounter;

    // Track which Pokémon is in each NFT
    mapping(uint256 => uint256) public tokenIdToPokemonId;

    uint256 public constant PRICE = 100 * 10**18; // 100 PKN

    constructor(address _pknToken) ERC721("Pokemon NFT", "PKMN") {
        pknToken = IERC20(_pknToken);
    }

    function mint(uint256 pokemonId, string memory uri) external {
        require(pknToken.transferFrom(msg.sender, address(this), PRICE), "Payment failed");

        uint256 tokenId = tokenIdCounter++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        // Now we USE pokemonId → no warning!
        tokenIdToPokemonId[tokenId] = pokemonId;
    }

    // Optional: View function to get Pokémon ID from NFT
    function getPokemonId(uint256 tokenId) external view returns (uint256) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenIdToPokemonId[tokenId];
    }
}