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

  mapping (uint => mapping (address => Checkpoint)) private att;
  mapping (address => address) private trusted;
  address[] trusters;

  constructor() public {
  }

  /**
   * Attest to a given block number having a hash
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
}

