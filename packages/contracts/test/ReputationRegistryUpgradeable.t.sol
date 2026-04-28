// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ERC1967Proxy.sol";
import "../src/IdentityRegistryUpgradeable.sol";
import "../src/ReputationRegistryUpgradeable.sol";

contract ReputationRegistryUpgradeableTest is Test {
    IdentityRegistryUpgradeable identity;
    ReputationRegistryUpgradeable reputation;

    address owner = address(0x1);
    address agentOwner = address(0x2);
    address clientA = address(0x3);
    address clientB = address(0x4);

    uint256 agentId;

    function setUp() public {
        IdentityRegistryUpgradeable identityImplementation = new IdentityRegistryUpgradeable();
        ERC1967Proxy identityProxy = new ERC1967Proxy(
            address(identityImplementation),
            abi.encodeCall(
                IdentityRegistryUpgradeable.initialize,
                (owner, "AgentIdentity", "AGENT")
            )
        );
        identity = IdentityRegistryUpgradeable(address(identityProxy));

        ReputationRegistryUpgradeable reputationImplementation = new ReputationRegistryUpgradeable();
        ERC1967Proxy reputationProxy = new ERC1967Proxy(
            address(reputationImplementation),
            abi.encodeCall(
                ReputationRegistryUpgradeable.initialize,
                (owner, address(identity))
            )
        );
        reputation = ReputationRegistryUpgradeable(address(reputationProxy));

        vm.prank(agentOwner);
        agentId = identity.register("0g://cid/agent");
    }

    function test_give_feedback_and_summary() public {
        vm.prank(clientA);
        reputation.giveFeedback(
            agentId,
            850,
            2,
            "yield",
            "usdc",
            "/run",
            "0g://feedback/1",
            keccak256("feedback-1")
        );

        vm.prank(clientB);
        reputation.giveFeedback(
            agentId,
            950,
            2,
            "yield",
            "usdc",
            "/run",
            "0g://feedback/2",
            keccak256("feedback-2")
        );

        address[] memory clients = new address[](2);
        clients[0] = clientA;
        clients[1] = clientB;

        (uint64 count, int128 average, uint8 decimals) = reputation.getSummary(
            agentId,
            clients,
            "yield",
            "usdc"
        );

        assertEq(count, 2);
        assertEq(average, 900);
        assertEq(decimals, 2);
    }

    function test_self_feedback_reverts() public {
        vm.prank(agentOwner);
        vm.expectRevert("Self-feedback not allowed");
        reputation.giveFeedback(
            agentId,
            900,
            2,
            "yield",
            "usdc",
            "/run",
            "0g://feedback/self",
            keccak256("feedback-self")
        );
    }

    function test_revoke_feedback() public {
        vm.prank(clientA);
        reputation.giveFeedback(
            agentId,
            800,
            2,
            "yield",
            "usdc",
            "/run",
            "0g://feedback/1",
            keccak256("feedback-1")
        );

        vm.prank(clientA);
        reputation.revokeFeedback(agentId, 1);

        (, , , , bool revoked) = reputation.readFeedback(agentId, clientA, 1);
        assertTrue(revoked);
    }

    function test_append_response_tracks_count() public {
        vm.prank(clientA);
        reputation.giveFeedback(
            agentId,
            800,
            2,
            "yield",
            "usdc",
            "/run",
            "0g://feedback/1",
            keccak256("feedback-1")
        );

        vm.prank(agentOwner);
        reputation.appendResponse(
            agentId,
            clientA,
            1,
            "0g://response/1",
            keccak256("response-1")
        );

        vm.prank(owner);
        reputation.appendResponse(
            agentId,
            clientA,
            1,
            "0g://response/2",
            keccak256("response-2")
        );

        address[] memory responders = new address[](0);
        uint64 count = reputation.getResponseCount(agentId, clientA, 1, responders);
        assertEq(count, 2);
    }
}
