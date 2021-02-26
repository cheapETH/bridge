// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./Ethash.sol";
import "hardhat/console.sol";
import "solidity-rlp/contracts/RLPReader.sol";

// derived from https://github.com/pantos-io/ethrelay/blob/master/contracts/TestimoniumCore.sol

contract Bridge {
  uint8 constant ALLOWED_FUTURE_BLOCK_TIME = 15 seconds;
  bytes32 constant EMPTY_UNCLE_HASH = hex"1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
  uint32 immutable bombDelayFromParent;

  using RLPReader for *;
  using Ethash for *;

  struct FullHeader {
    bytes32 parent;
    bytes32 uncleHash;
    uint difficulty;
    uint blockNumber;
    uint timestamp;
    bytes32 mixHash;
    uint nonce;
  }

  function decodeBlockData(bytes memory rlpHeader) internal pure returns (FullHeader memory) {
    FullHeader memory header;

    uint idx;
    RLPReader.Iterator memory it = rlpHeader.toRlpItem().iterator();

    while (it.hasNext()) {
      if ( idx == 0 ) header.parent = bytes32(it.next().toUint());
      else if ( idx == 1 ) header.uncleHash = bytes32(it.next().toUint());
      else if ( idx == 7 ) header.difficulty = it.next().toUint();
      else if ( idx == 8 ) header.blockNumber = it.next().toUint();
      else if ( idx == 11 ) header.timestamp = it.next().toUint();
      else if ( idx == 13 ) header.mixHash = bytes32(it.next().toUint());
      else if ( idx == 14 ) header.nonce = it.next().toUint();
      else it.next();
      idx++;
    }

    return header;
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

  struct Header {
    uint24 blockNumber;
    uint232 totalDifficulty;
    bytes32 parentHash;

    uint64 timestamp;
    uint128 difficulty;

    bool noUncle;
  }

  mapping (bytes32 => Header) private headers;
  bytes32 longestChainEndpoint;

  constructor(bytes memory genesisHeader, uint32 bombDelayFromParentInput) public {
    bytes32 genesisHash = keccak256(genesisHeader);
    FullHeader memory header = decodeBlockData(genesisHeader);

    Header memory newHeader;
    newHeader.blockNumber = uint24(header.blockNumber);
    newHeader.parentHash = header.parent;
    newHeader.totalDifficulty = 0; // 0 is a fine place to start

    newHeader.timestamp = uint64(header.timestamp);
    newHeader.difficulty = uint128(header.difficulty);
    newHeader.noUncle = header.uncleHash == EMPTY_UNCLE_HASH;

    headers[genesisHash] = newHeader;
    longestChainEndpoint = genesisHash;

    bombDelayFromParent = bombDelayFromParentInput - 1;
  }

  function isHeaderStored(bytes32 hash) public view returns (bool) {
    return headers[hash].blockNumber != 0;
  }

  function getLongestChainEndpoint() public view returns (bytes32 hash) {
    return longestChainEndpoint;
  }

  // walk back the blockchain until we find this block number
  function getBlockByNumber(uint blockNumber) public view returns (bytes32 hash, uint24 depth) {
    bytes32 ptr = longestChainEndpoint;
    uint24 retdepth = 0;
    while (true) {
      if (headers[ptr].blockNumber == blockNumber) return (ptr, retdepth);
      retdepth += 1;
      ptr = headers[ptr].parentHash;
    }
  }

  function getHeader(bytes32 blockHash) public view returns (bytes32 parentHash, uint blockNumber, uint totalDifficulty) {
    Header storage header = headers[blockHash];
    return (
      header.parentHash,
      header.blockNumber,
      header.totalDifficulty
    );
  }
  
  function submitHeaders(bytes[] memory rlpHeaders) public {
    for (uint i = 0; i < rlpHeaders.length; i++) {
      submitHeader(rlpHeaders[i]);
    }
  }

  function submitHeader(bytes memory rlpHeader) public {
    bytes32 blockHash = keccak256(rlpHeader);
    bytes32 miningHash = getMiningHash(rlpHeader);

    FullHeader memory header = decodeBlockData(rlpHeader);

    // confirm block header isn't in the future
    require(header.timestamp < now + ALLOWED_FUTURE_BLOCK_TIME, "block is in the future");

    // verify block is in chain
    require(isHeaderStored(header.parent), "parent does not exist");
    Header memory parentHeader = headers[header.parent];
    require(parentHeader.blockNumber == header.blockNumber-1, "parent block number is wrong");

    // confirm block is in order
    require(parentHeader.timestamp <= header.timestamp, "parent happened after this block");

    // confirm difficultly is correct with formula
    uint expectedDifficulty = calculateDifficulty(parentHeader, header.timestamp);
    require(header.difficulty == expectedDifficulty, "expected difficulty doesn't match");

    // verify block was hard to make
    // tmp = sha3_512(miningHash + header.nonce)
    // hh = sha3_256(tmp + header.mixHash)
    uint[16] memory tmp = Ethash.computeS(uint(miningHash), uint(header.nonce));
    uint hh = Ethash.computeSha3(tmp, header.mixHash);
    // confirm hh * header.difficulty < 2**256
    uint c = hh * header.difficulty;
    require(c / hh == header.difficulty, "block difficultly didn't match hash");

    // create block
    Header memory newHeader;
    newHeader.blockNumber = uint24(header.blockNumber);
    newHeader.totalDifficulty = uint232(parentHeader.totalDifficulty + header.difficulty);
    newHeader.parentHash = header.parent;
    newHeader.timestamp = uint64(header.timestamp);
    newHeader.difficulty = uint128(header.difficulty);
    newHeader.noUncle = header.uncleHash == EMPTY_UNCLE_HASH;

    // add block to chain
    if (newHeader.totalDifficulty > headers[longestChainEndpoint].totalDifficulty) {
      longestChainEndpoint = blockHash;
    }
    headers[blockHash] = newHeader;
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

  function calculateDifficulty(Header memory parent, uint timestamp) private view returns (uint) {
    int x = int((timestamp - parent.timestamp) / 9);

    // take into consideration uncles of parent
    if (parent.noUncle) {
      x = 1 - x;
    } else {
      x = 2 - x;
    }

    if (x < -99) {
      x = -99;
    }

    x = int(parent.difficulty) + int(parent.difficulty) / 2048 * x;

    // minimum difficulty = 131072
    if (x < 131072) {
      x = 131072;
    }

    // calculate a fake block number for the ice-age delay
    // Specification: https://eips.ethereum.org/EIPS/eip-1234
    uint fakeBlockNumber = 0;
    if (parent.blockNumber >= bombDelayFromParent) {
      fakeBlockNumber = parent.blockNumber - bombDelayFromParent;
    }

    // for the exponential factor
    uint periodCount = fakeBlockNumber / 100000;

    // the exponential factor, commonly referred to as "the bomb"
    // diff = diff + 2^(periodCount - 2)
    if (periodCount > 1) {
      return uint(x) + 2**(periodCount - 2);
    }

    return uint(x);
  }
}

