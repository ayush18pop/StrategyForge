// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ERC1967Proxy.sol";
import "../src/IdentityRegistryUpgradeable.sol";
import "../src/ValidationRegistryUpgradeable.sol";

contract ValidationRegistryUpgradeableTest is Test {
    IdentityRegistryUpgradeable identity;
    ValidationRegistryUpgradeable validation;

    address owner = address(0x1);
    address agentOwner = address(0x2);
    address validator = address(0x3);

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

        ValidationRegistryUpgradeable validationImplementation = new ValidationRegistryUpgradeable();
        ERC1967Proxy validationProxy = new ERC1967Proxy(
            address(validationImplementation),
            abi.encodeCall(
                ValidationRegistryUpgradeable.initialize,
                (owner, address(identity))
            )
        );
        validation = ValidationRegistryUpgradeable(address(validationProxy));

        vm.prank(agentOwner);
        agentId = identity.register("0g://cid/agent");
    }

    function test_validation_request_and_response() public {
        bytes32 requestHash = keccak256("request-1");

        vm.prank(agentOwner);
        validation.validationRequest(
            validator,
            agentId,
            "0g://validation/request-1",
            requestHash
        );

        vm.prank(validator);
        validation.validationResponse(
            requestHash,
            88,
            "0g://validation/response-1",
            keccak256("response-1"),
            "security"
        );

        (
            address validatorAddress,
            uint256 validatedAgentId,
            uint8 response,
            ,
            string memory tag,
            uint256 lastUpdate
        ) = validation.getValidationStatus(requestHash);

        assertEq(validatorAddress, validator);
        assertEq(validatedAgentId, agentId);
        assertEq(response, 88);
        assertEq(tag, "security");
        assertGt(lastUpdate, 0);
    }

    function test_summary_averages_responses() public {
        bytes32 requestHash1 = keccak256("request-1");
        bytes32 requestHash2 = keccak256("request-2");

        vm.startPrank(agentOwner);
        validation.validationRequest(
            validator,
            agentId,
            "0g://validation/request-1",
            requestHash1
        );
        validation.validationRequest(
            validator,
            agentId,
            "0g://validation/request-2",
            requestHash2
        );
        vm.stopPrank();

        vm.startPrank(validator);
        validation.validationResponse(
            requestHash1,
            80,
            "0g://validation/response-1",
            keccak256("response-1"),
            "security"
        );
        validation.validationResponse(
            requestHash2,
            90,
            "0g://validation/response-2",
            keccak256("response-2"),
            "security"
        );
        vm.stopPrank();

        address[] memory validators = new address[](1);
        validators[0] = validator;

        (uint64 count, uint8 average) = validation.getSummary(
            agentId,
            validators,
            "security"
        );

        assertEq(count, 2);
        assertEq(average, 85);
    }

    function test_only_validator_can_respond() public {
        bytes32 requestHash = keccak256("request-1");

        vm.prank(agentOwner);
        validation.validationRequest(
            validator,
            agentId,
            "0g://validation/request-1",
            requestHash
        );

        vm.prank(owner);
        vm.expectRevert("not validator");
        validation.validationResponse(
            requestHash,
            70,
            "0g://validation/response-1",
            keccak256("response-1"),
            "security"
        );
    }
}
