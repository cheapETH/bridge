// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

// derived from https://github.com/pantos-io/ethrelay/blob/master/contracts/TestimoniumCore.sol

/*struct BlockHeader {
  // two hashes
  bytes32 parent_hash;
  bytes32 uncles_hash;
  // payout
  address coinbase;
  // state roots
  bytes32 state_root;
  bytes32 transaction_root;
  bytes32 receipt_root;
  // bloom
  uint256 bloom;
  // ints
  uint difficulty;
  uint block_number;
  uint gas_limit;
  uint gas_used;
  uint timestamp;
  // sealed header
  bytes32 mix_hash;
  bytes8 nonce;
}*/

contract Bridge {
  struct Header {
    uint24 blockNumber;
    uint232 totalDifficulty;

    bytes32 parentHash;
  }

  // really, this isn't a built-in?
  function copy(bytes memory sourceArray, uint newLength) private pure returns (bytes memory) {
    uint newArraySize = newLength;
    if (newArraySize > sourceArray.length) {
      newArraySize = sourceArray.length;
    }

    bytes memory newArray = new bytes(newArraySize);
    for (uint i = 0; i < newArraySize; i++){
      newArray[i] = sourceArray[i];
    }
    return newArray;
  }

  mapping (bytes32 => Header) private headers;
  bytes32 longestChainEndpoint;

  constructor(bytes32 genesisHash) {
  }

  function submitHeader(bytes memory rlpHeader) public returns (bytes32) {
    bytes32 blockHash = keccak256(rlpHeader);
    bytes32 miningHash = getMiningHash(rlpHeader);
  }

  // the mining hash is the block hash without mixHash and nonce (length 42)
  function getMiningHash(bytes memory rlpHeader) private pure returns (bytes32) {
    bytes memory rlpWithoutNonce = copy(rlpHeader, rlpHeader.length-42);
    uint16 rlpHeaderWithoutNonceLength = uint16(rlpHeader.length-3-42);
    bytes2 headerLengthBytes = bytes2(rlpHeaderWithoutNonceLength);
    rlpWithoutNonce[1] = headerLengthBytes[0];
    rlpWithoutNonce[2] = headerLengthBytes[1];
    return keccak256(rlpWithoutNonce);
  }
}

