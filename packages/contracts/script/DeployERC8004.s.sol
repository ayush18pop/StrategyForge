// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/ERC1967Proxy.sol";
import "../src/IdentityRegistryUpgradeable.sol";
import "../src/ReputationRegistryUpgradeable.sol";
import "../src/ValidationRegistryUpgradeable.sol";

contract DeployERC8004 is Script {
    struct DeploymentResult {
        address identityImplementation;
        address identityProxy;
        address reputationImplementation;
        address reputationProxy;
        address validationImplementation;
        address validationProxy;
        address owner;
        uint256 initialAgentId;
    }

    function run() external returns (DeploymentResult memory result) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address defaultOwner = vm.addr(privateKey);
        address owner = _envOrAddress("ERC8004_OWNER", defaultOwner);
        string memory identityName = _envOrString(
            "ERC8004_NAME",
            "AgentIdentity"
        );
        string memory identitySymbol = _envOrString(
            "ERC8004_SYMBOL",
            "AGENT"
        );
        string memory initialAgentURI = _envOrString("INITIAL_AGENT_URI", "");

        vm.startBroadcast(privateKey);

        IdentityRegistryUpgradeable identityImplementation = new IdentityRegistryUpgradeable();
        ERC1967Proxy identityProxy = new ERC1967Proxy(
            address(identityImplementation),
            abi.encodeCall(
                IdentityRegistryUpgradeable.initialize,
                (owner, identityName, identitySymbol)
            )
        );
        IdentityRegistryUpgradeable identity = IdentityRegistryUpgradeable(
            address(identityProxy)
        );

        ReputationRegistryUpgradeable reputationImplementation = new ReputationRegistryUpgradeable();
        ERC1967Proxy reputationProxy = new ERC1967Proxy(
            address(reputationImplementation),
            abi.encodeCall(
                ReputationRegistryUpgradeable.initialize,
                (owner, address(identity))
            )
        );

        ValidationRegistryUpgradeable validationImplementation = new ValidationRegistryUpgradeable();
        ERC1967Proxy validationProxy = new ERC1967Proxy(
            address(validationImplementation),
            abi.encodeCall(
                ValidationRegistryUpgradeable.initialize,
                (owner, address(identity))
            )
        );

        uint256 initialAgentId = type(uint256).max;
        if (bytes(initialAgentURI).length > 0) {
            require(
                owner == defaultOwner,
                "INITIAL_AGENT_URI requires ERC8004_OWNER == deployer"
            );
            initialAgentId = identity.register(initialAgentURI);
        }

        vm.stopBroadcast();

        result = DeploymentResult({
            identityImplementation: address(identityImplementation),
            identityProxy: address(identityProxy),
            reputationImplementation: address(reputationImplementation),
            reputationProxy: address(reputationProxy),
            validationImplementation: address(validationImplementation),
            validationProxy: address(validationProxy),
            owner: owner,
            initialAgentId: initialAgentId
        });

        _writeDeploymentJson(result);
        _logDeployment(result, initialAgentURI);
    }

    function _writeDeploymentJson(DeploymentResult memory result) internal {
        string memory deploymentKey = "erc8004";
        vm.serializeAddress(
            deploymentKey,
            "identityImplementation",
            result.identityImplementation
        );
        vm.serializeAddress(
            deploymentKey,
            "identityProxy",
            result.identityProxy
        );
        vm.serializeAddress(
            deploymentKey,
            "reputationImplementation",
            result.reputationImplementation
        );
        vm.serializeAddress(
            deploymentKey,
            "reputationProxy",
            result.reputationProxy
        );
        vm.serializeAddress(
            deploymentKey,
            "validationImplementation",
            result.validationImplementation
        );
        vm.serializeAddress(
            deploymentKey,
            "validationProxy",
            result.validationProxy
        );
        vm.serializeAddress(deploymentKey, "owner", result.owner);
        string memory finalJson = vm.serializeUint(
            deploymentKey,
            "initialAgentId",
            result.initialAgentId
        );

        string memory outputPath = string.concat(
            vm.projectRoot(),
            "/script/erc8004-deployment.json"
        );
        vm.writeJson(finalJson, outputPath);
    }

    function _logDeployment(
        DeploymentResult memory result,
        string memory initialAgentURI
    ) internal view {
        console2.log("ERC-8004 deployment complete");
        console2.log("Owner:", result.owner);
        console2.log(
            "Identity implementation:",
            result.identityImplementation
        );
        console2.log("Identity proxy:", result.identityProxy);
        console2.log(
            "Reputation implementation:",
            result.reputationImplementation
        );
        console2.log("Reputation proxy:", result.reputationProxy);
        console2.log(
            "Validation implementation:",
            result.validationImplementation
        );
        console2.log("Validation proxy:", result.validationProxy);

        if (bytes(initialAgentURI).length > 0) {
            console2.log("Initial agent URI:", initialAgentURI);
            console2.log("Initial agentId:", result.initialAgentId);
        }
    }

    function _envOrAddress(string memory key, address defaultValue)
        internal
        view
        returns (address)
    {
        try vm.envAddress(key) returns (address value) {
            return value;
        } catch {
            return defaultValue;
        }
    }

    function _envOrString(string memory key, string memory defaultValue)
        internal
        view
        returns (string memory)
    {
        try vm.envString(key) returns (string memory value) {
            return value;
        } catch {
            return defaultValue;
        }
    }
}
