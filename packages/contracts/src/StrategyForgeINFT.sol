// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title StrategyForgeINFT
/// @notice ERC-721 token representing the StrategyForge agent. The iNFT (intelligent NFT)
/// holds mutable brainCid that points to the agent's knowledge on 0G Storage.
contract StrategyForgeINFT is ERC721, Ownable {
    mapping(uint256 => string) private _brainCids;
    uint256 private _nextTokenId;

    event BrainUpdated(uint256 indexed tokenId, string newCid);

    constructor() ERC721("StrategyForge Agent", "SFA") Ownable(msg.sender) {}

    /// @notice Mint a new agent iNFT with an initial brain CID
    /// @param to Address to mint the token to
    /// @param initialBrainCid The 0G Storage root CID of the agent's initial knowledge
    /// @return tokenId The minted token ID
    function mint(address to, string calldata initialBrainCid) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _brainCids[tokenId] = initialBrainCid;
        emit BrainUpdated(tokenId, initialBrainCid);
        return tokenId;
    }

    /// @notice Update the agent's brain CID (called after pipeline completion)
    /// @param tokenId The token ID of the agent
    /// @param newCid The new 0G Storage root CID
    /// @dev Only the token owner (the agent's wallet or operator) can call this
    function updateBrain(uint256 tokenId, string calldata newCid) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _brainCids[tokenId] = newCid;
        emit BrainUpdated(tokenId, newCid);
    }

    /// @notice Get the current brain CID for an agent
    /// @param tokenId The token ID of the agent
    /// @return The 0G Storage root CID of the agent's knowledge
    function brainCid(uint256 tokenId) external view returns (string memory) {
        return _brainCids[tokenId];
    }
}
