// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0

// TODO: upgrade this to be decentralized
contract SimplicityStateTrusted {
  address owner;
  constructor() { owner = msg.sender; }
  modifier onlyOwner() { require(msg.sender == owner); _; }

  mapping (uint => bytes32) private L2State;

  function getTrustedState(uint blockNumber) external returns (bytes32) view {
    bytes32 ret = L2State[blockNumber];
    require(ret != bytes32(0));
    return ret;
  }

  function setTrustedState(uint blockNumber, bytes32 l1BlockHash, bytes32 l2BlockHash) external onlyOwner {
    require(blockhash(blockNumber) == l1BlockHash);
    L2State[blockNumber] = l2BlockHash;
  }
}
