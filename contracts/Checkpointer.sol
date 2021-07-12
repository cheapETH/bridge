// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

/**
 * @title Checkpointer
 * @dev Allow users to attest to the state of the chain
 */
contract Checkpointer {
  uint16 constant MINIMUM_BLOCK_LOOKBACK = 100;
  uint16 constant MAX_TRUSTED = 100;

  struct Checkpoint {
    bytes32 hash;
    uint savedBlockNumber;
  }

  // This is a list of the current valid "stakers"
  address[] trusters;

  // This is a mapping of what address the stakers trust
  mapping (address => address) private trusted;

  // For each block, this is a mapping from an address to what they trust
  mapping (uint => mapping (address => Checkpoint)) private att;

  constructor() public {
  }

  /**
   * Attest to a given block number having a hash
   * Anybody can call this, and on this chain they can't attest to the wrong hash
   * Note: this transaction itself is signed by msg.sender
   */
  function attest(uint number, bytes32 blockHash) public {
    require(block.number >= MINIMUM_BLOCK_LOOKBACK, "chain is too new");
    require(number <= (block.number - MINIMUM_BLOCK_LOOKBACK), "block is too recent");

    bytes32 hash = blockhash(number);
    require(hash != 0, "blockhash not found");
    require(hash == blockHash, "blockhash doesn't match attestation");

    att[number][msg.sender] = Checkpoint({
      hash: blockHash,
      savedBlockNumber: number
    });
  }

  function getBlockByNumber(uint blockNumber, address verifier) public view returns (Checkpoint memory) {
    return att[blockNumber][verifier];
  }

  /**
   * Designate a verifier to trust
   */
  function trust(address toTrust) public {
    trusted[msg.sender] = toTrust;
    if (trusters.length < MAX_TRUSTED) {
      trusters.push(msg.sender);
    } else {
      // find lowest balance truster to replace
      uint lowest = 0;
      uint tbalance = trusters[0].balance;
      for (uint i = 1; i < trusters.length; i++) {
        if (trusters[i].balance < tbalance) {
          lowest = i;
          tbalance = trusters[i].balance;
        }
      }
      trusters[lowest] = msg.sender;
    }
  }

  function getTrusted() public view returns (address[] memory) {
    address[] memory ret = new address[](trusters.length);
    for(uint i = 0; i < trusters.length; i++) {
      ret[i] = trusted[trusters[i]];
    }
    return ret;
  }
}

