// 這是underlying token
pragma solidity 0.8.17;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestErc20 is ERC20 {
    constructor(uint256 supply, string memory name, string memory symbol) ERC20("TestErc20", "TE") {
        _mint(msg.sender, supply);
    }
}
