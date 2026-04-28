// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ERC1967Proxy.sol";
import "../src/IdentityRegistryUpgradeable.sol";

contract IdentityRegistryUpgradeableTest is Test {
    bytes32 private constant AGENT_WALLET_SET_TYPEHASH =
        keccak256(
            "AgentWalletSet(uint256 agentId,address newWallet,address owner,uint256 deadline)"
        );
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    IdentityRegistryUpgradeable implementation;
    IdentityRegistryUpgradeable registry;

    address owner = address(0x1);
    address agentOperator = address(0x2);
    address approvedOperator = address(0x3);
    address nextWallet = vm.addr(0xA11CE);

    function setUp() public {
        implementation = new IdentityRegistryUpgradeable();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                IdentityRegistryUpgradeable.initialize,
                (owner, "AgentIdentity", "AGENT")
            )
        );
        registry = IdentityRegistryUpgradeable(address(proxy));
    }

    function test_register_with_uri_and_agent_wallet() public {
        vm.prank(agentOperator);
        uint256 agentId = registry.register("0g://cid/agent-1");

        assertEq(agentId, 0);
        assertEq(registry.ownerOf(agentId), agentOperator);
        assertEq(registry.getAgent(agentId), "0g://cid/agent-1");
        assertEq(registry.getAgentWallet(agentId), agentOperator);
    }

    function test_update_agent_uri_compatibility_method() public {
        vm.prank(agentOperator);
        uint256 agentId = registry.register("0g://cid/v1");

        vm.prank(agentOperator);
        registry.updateAgent(agentId, "0g://cid/v2");

        assertEq(registry.getAgent(agentId), "0g://cid/v2");
    }

    function test_set_metadata_requires_authorization() public {
        vm.prank(agentOperator);
        uint256 agentId = registry.register("0g://cid/v1");

        vm.prank(agentOperator);
        registry.setMetadata(agentId, "mcpEndpoint", bytes("https://api.example"));

        bytes memory value = registry.getMetadata(agentId, "mcpEndpoint");
        assertEq(string(value), "https://api.example");

        vm.prank(address(0x999));
        vm.expectRevert("Not authorized");
        registry.setMetadata(agentId, "mcpEndpoint", bytes("https://evil"));
    }

    function test_transfer_clears_agent_wallet() public {
        vm.prank(agentOperator);
        uint256 agentId = registry.register("0g://cid/v1");

        vm.prank(agentOperator);
        registry.transferFrom(agentOperator, approvedOperator, agentId);

        assertEq(registry.ownerOf(agentId), approvedOperator);
        assertEq(registry.getAgentWallet(agentId), address(0));
    }

    function test_set_agent_wallet_accepts_eoa_signature() public {
        vm.prank(agentOperator);
        uint256 agentId = registry.register("0g://cid/v1");

        uint256 walletPrivateKey = 0xA11CE;
        uint256 deadline = block.timestamp + 60;
        bytes32 structHash = keccak256(
            abi.encode(
                AGENT_WALLET_SET_TYPEHASH,
                agentId,
                nextWallet,
                agentOperator,
                deadline
            )
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("ERC8004IdentityRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(registry)
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(agentOperator);
        registry.setAgentWallet(agentId, nextWallet, deadline, signature);

        assertEq(registry.getAgentWallet(agentId), nextWallet);
    }
}
