// 這是underlying token
pragma solidity 0.8.17;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestErc20A is ERC20 {
    constructor(uint256 supply, string memory name, string memory symbol) ERC20("TestErc20A", "EA") {
        _mint(msg.sender, supply);
    }
}
