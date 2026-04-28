// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/IdentityRegistryUpgradeable.sol";
import "../src/ReputationRegistryUpgradeable.sol";
import "../src/StrategyForgeINFT.sol";

contract Deploy is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("PRIVATE_KEY");
    address deployerAddr = vm.addr(deployerKey);

    vm.startBroadcast(deployerKey);

    // Deploy IdentityRegistry
    IdentityRegistryUpgradeable identityImpl = new IdentityRegistryUpgradeable();
    bytes memory identityInitData = abi.encodeCall(
      IdentityRegistryUpgradeable.initialize,
      (deployerAddr, "ERC8004IdentityRegistry", "AGENT")
    );
    ERC1967Proxy identityProxy = new ERC1967Proxy(address(identityImpl), identityInitData);
    address identityRegistryAddress = address(identityProxy);

    console.log("IdentityRegistryUpgradeable deployed at:", identityRegistryAddress);

    // Deploy ReputationRegistry
    ReputationRegistryUpgradeable reputationImpl = new ReputationRegistryUpgradeable();
    bytes memory reputationInitData = abi.encodeCall(
      ReputationRegistryUpgradeable.initialize,
      (deployerAddr, identityRegistryAddress)
    );
    ERC1967Proxy reputationProxy = new ERC1967Proxy(address(reputationImpl), reputationInitData);
    address reputationRegistryAddress = address(reputationProxy);

    console.log("ReputationRegistryUpgradeable deployed at:", reputationRegistryAddress);

    // Deploy StrategyForgeINFT
    StrategyForgeINFT inft = new StrategyForgeINFT();

    console.log("StrategyForgeINFT deployed at:", address(inft));

    vm.stopBroadcast();

    // Log deployment summary
    console.log("\n=== Deployment Summary ===");
    console.log("IdentityRegistry:", identityRegistryAddress);
    console.log("ReputationRegistry:", reputationRegistryAddress);
    console.log("StrategyForgeINFT:", address(inft));
    console.log("Deployer:", deployerAddr);
  }
}
