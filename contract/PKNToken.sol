pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PKNToken is ERC20 {
    constructor() ERC20("Pokoin", "PKN") {
        // 1,000,000 PKN  (18 decimals)
        _mint(msg.sender, 1_000_000 * 10**18);
    }
}