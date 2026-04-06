// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

contract Issuer is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory tokenName_, string memory tokenSymbol_, uint256 initialSupply_, uint8 decimals_)
        ERC20(tokenName_, tokenSymbol_)
    {
        _DECIMALS = decimals_;
        _mint(_msgSender(), initialSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }
}
