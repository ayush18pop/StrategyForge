// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol" as OZProxy;

/// @notice Thin wrapper so Foundry scripts/tests can deploy an ERC1967 proxy
/// using a local contract name from this package.
contract ERC1967Proxy is OZProxy.ERC1967Proxy {
    constructor(address implementation, bytes memory data)
        OZProxy.ERC1967Proxy(implementation, data)
    {}
}
