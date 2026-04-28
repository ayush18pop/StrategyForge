// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/StrategyForgeINFT.sol";

contract StrategyForgeINFTTest is Test {
    StrategyForgeINFT nft;
    address owner = address(0x1);
    address user = address(0x2);

    function setUp() public {
        vm.prank(owner);
        nft = new StrategyForgeINFT();
    }

    function test_mint_and_store_brain_cid() public {
        string memory initialCid = "QmXxxx...";

        vm.prank(owner);
        uint256 tokenId = nft.mint(user, initialCid);

        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(tokenId), user);
        assertEq(nft.brainCid(tokenId), initialCid);
    }

    function test_update_brain_cid() public {
        string memory initialCid = "QmXxxx...";
        string memory newCid = "QmYyyy...";

        vm.prank(owner);
        uint256 tokenId = nft.mint(user, initialCid);

        vm.prank(user);
        nft.updateBrain(tokenId, newCid);

        assertEq(nft.brainCid(tokenId), newCid);
    }

    function test_update_brain_requires_ownership() public {
        string memory initialCid = "QmXxxx...";
        string memory newCid = "QmYyyy...";

        vm.prank(owner);
        uint256 tokenId = nft.mint(user, initialCid);

        vm.prank(address(0x3)); // different address
        vm.expectRevert("Not token owner");
        nft.updateBrain(tokenId, newCid);
    }

    function test_sequential_mints() public {
        vm.startPrank(owner);
        uint256 id1 = nft.mint(user, "QmCid1");
        uint256 id2 = nft.mint(user, "QmCid2");
        uint256 id3 = nft.mint(user, "QmCid3");
        vm.stopPrank();

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
        assertEq(nft.brainCid(id1), "QmCid1");
        assertEq(nft.brainCid(id2), "QmCid2");
        assertEq(nft.brainCid(id3), "QmCid3");
    }

    function test_mint_only_owner() public {
        vm.prank(user);
        vm.expectRevert();
        nft.mint(user, "QmCid");
    }

    function test_emit_brain_updated_on_mint() public {
        string memory cid = "QmInitial";

        vm.expectEmit(true, false, false, true);
        emit StrategyForgeINFT.BrainUpdated(0, cid);

        vm.prank(owner);
        nft.mint(user, cid);
    }

    function test_emit_brain_updated_on_update() public {
        string memory initialCid = "QmXxxx...";
        string memory newCid = "QmYyyy...";

        vm.prank(owner);
        uint256 tokenId = nft.mint(user, initialCid);

        vm.expectEmit(true, false, false, true);
        emit StrategyForgeINFT.BrainUpdated(tokenId, newCid);

        vm.prank(user);
        nft.updateBrain(tokenId, newCid);
    }
}
