// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @notice Minimal UUPS contract kept as a lightweight upgrade test helper.
contract MinimalUUPS is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private _identityRegistry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address identityRegistry_)
        public
        initializer
    {
        __Ownable_init(initialOwner);
        _identityRegistry = identityRegistry_;
    }

    function identityRegistry() external view returns (address) {
        return _identityRegistry;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    function getVersion() external pure returns (string memory) {
        return "0.0.1";
    }
}
