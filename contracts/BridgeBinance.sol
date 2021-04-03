// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./lib/Lib_RLPReader.sol";
import "./lib/Lib_RLPWriter.sol";
import "./lib/Lib_BytesUtils.sol";
/**
 * @title BridgeBinance
 * @dev The Bridge tracks and verifies the state of binance smart chain
 */
contract BridgeBinance {
  uint16 constant ALLOWED_FUTURE_BLOCK_TIME = 5 minutes;

  address[] public currentValidatorSet;
  bytes32 constant EMPTY_UNCLE_HASH = hex"1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
  uint constant EPOCH_LENGTH = 200;
  // TODO: this should be moved to some library
  struct FullHeader {
    bytes32 parent;
    bytes32 uncleHash;
    uint difficulty;
    uint blockNumber;
    uint timestamp;
    bytes32 mixHash;
    uint nonce;
    address miner;
    bytes extraData;
  }
  // and this too
  function decodeBlockData(bytes memory rlpHeader) internal pure returns (FullHeader memory) {
    Lib_RLPReader.RLPItem[] memory nodes = Lib_RLPReader.readList(rlpHeader);
    FullHeader memory header = FullHeader({
      parent: Lib_RLPReader.readBytes32(nodes[0]),
      uncleHash: Lib_RLPReader.readBytes32(nodes[1]),
      miner: Lib_RLPReader.readAddress(nodes[2]),
      difficulty: Lib_RLPReader.readUint256(nodes[7]),
      blockNumber: Lib_RLPReader.readUint256(nodes[8]),
      timestamp: Lib_RLPReader.readUint256(nodes[11]),
      extraData: Lib_RLPReader.readBytes(nodes[12]),
      mixHash: Lib_RLPReader.readBytes32(nodes[13]),
      nonce: Lib_RLPReader.readUint256(nodes[14])
    });

    return header;
  }

  enum EncType {
    ENC_BYTES32,
    ENC_BYTES8,
    ENC_ADDRESS,
    ENC_UINT,
    ENC_BYTES
  }

  function encodeRlpHeaderNoSign(bytes memory rlpHeader) internal pure returns (bytes memory) {
    Lib_RLPReader.RLPItem[] memory nodes = Lib_RLPReader.readList(rlpHeader);
    EncType[15] memory encMap = [
      EncType.ENC_BYTES32, // parentHash
      EncType.ENC_BYTES32, // sha3Uncles
      EncType.ENC_ADDRESS, // miner aka coinbase
      EncType.ENC_BYTES32, // stateRoot
      EncType.ENC_BYTES32, // txHash
      EncType.ENC_BYTES32, // receiptsRoot
      EncType.ENC_BYTES,   // logsBloom
      EncType.ENC_UINT,    // difficulty
      EncType.ENC_UINT,    // Number ??? maybe blockNumber
      EncType.ENC_UINT,    // gasLimit
      EncType.ENC_UINT,    // gasUsed
      EncType.ENC_UINT,    // timestamp
      EncType.ENC_BYTES,   // extraData
      EncType.ENC_BYTES32, // mixHash
      EncType.ENC_BYTES    // nonce, should be exactly 8 bytes
    ];

    bytes[] memory raw = new bytes[](nodes.length + 1);
    // bsc chain id is 0x38
    raw[0] = Lib_RLPWriter.writeUint(0x38);
    for(uint i = 0; i < nodes.length; i++) {
      uint ri = i + 1;

      if(encMap[i] == EncType.ENC_BYTES32) {
        bytes32 tmp = Lib_RLPReader.readBytes32(nodes[i]);
        raw[ri] = Lib_RLPWriter.writeBytes(abi.encodePacked(tmp));
        continue;
      }
      if(encMap[i] == EncType.ENC_ADDRESS) {
        address tmp = Lib_RLPReader.readAddress(nodes[i]);
        raw[ri] = Lib_RLPWriter.writeAddress(tmp);
        continue;
      }
      if(encMap[i] == EncType.ENC_UINT) {
        uint tmp = Lib_RLPReader.readUint256(nodes[i]);
        raw[ri] = Lib_RLPWriter.writeUint(tmp);
        continue;
      }
      if(encMap[i] == EncType.ENC_BYTES) {
        bytes memory tmp = Lib_RLPReader.readBytes(nodes[i]);
        // remove trailing 65 bytes of signature from extraData
        if (i == 12) {
          tmp = Lib_BytesUtils.slice(tmp,0, tmp.length - 65);
        }
        raw[ri] = Lib_RLPWriter.writeBytes(tmp);
        continue;
      }
    }
    return Lib_RLPWriter.writeList(raw);
  }

  struct Header {
    uint24 blockNumber;
    bytes32 hash;
    //uint232 totalDifficulty;
    bytes32 parentHash;
    uint64 timestamp;
  }

  mapping (uint => Header) private headers;
  mapping (bytes32 => uint) private hash2blockNumber;
  uint largestBlockNumber;
  bool noGenesis;

  constructor(bytes memory genesisHeader, address[] memory consensusAddrs) public {
    // add validators
    for (uint i = 0; i < consensusAddrs.length; i++) {
      //console.log("validator", consensusAddrs[i]);
      currentValidatorSet.push(consensusAddrs[i]);
    }
    //skip parent block check
    noGenesis = true;
    // first block should be good to be normal
    submitHeader(genesisHeader);
  }

  function submitHeaders(bytes[] memory rlpHeaders) public {
    for (uint i = 0; i < rlpHeaders.length; i++) {
      submitHeader(rlpHeaders[i]);
    }
  }

  function splitSignature(bytes memory sig) public pure returns (bytes32 r, bytes32 s, uint8 v)
  {
      require(sig.length == 65, "invalid signature length");

      assembly {
          /*
          First 32 bytes stores the length of the signature

          add(sig, 32) = pointer of sig + 32
          effectively, skips first 32 bytes of signature

          mload(p) loads next 32 bytes starting at the memory address p into memory
          */

          // first 32 bytes, after the length prefix
          r := mload(add(sig, 32))
          // second 32 bytes
          s := mload(add(sig, 64))
          // final byte (first byte of the next 32 bytes)
          v := byte(0, mload(add(sig, 96)))
      }

      // implicitly return (r, s, v)
  }

  function submitHeader(bytes memory rlpHeader) public {
    bytes32 blockHash = keccak256(rlpHeader);

    FullHeader memory header = decodeBlockData(rlpHeader);
    require(header.timestamp < now + ALLOWED_FUTURE_BLOCK_TIME, "block in in the future");

    if (header.blockNumber > largestBlockNumber) largestBlockNumber = header.blockNumber;

    // confirm miner is in validator set
    // disgusting O(n) algorithm
    bool found = false;
    for (uint i = 0; i < currentValidatorSet.length; i++) {
      if (currentValidatorSet[i] == header.miner) found = true;
    }
    require(found, "miner not in validator set");

    bytes32 empty;
    require(header.mixHash == empty, "mixhash should be zero");
    require(header.uncleHash == EMPTY_UNCLE_HASH, "shouldn't have any uncles");

    // verify block is in chain, skip if genesis block
    if(!noGenesis) {
      require(isHeaderStored(header.parent), "parent does not exist");
      Header memory parentHeader = getHeaderInternal(header.parent);
      require(parentHeader.blockNumber == header.blockNumber-1, "parent block number is wrong");

      // confirm block is in order
      require(parentHeader.timestamp <= header.timestamp, "parent happened after this block");
      noGenesis = false;
    }
    // TODO: validate block
    // see https://docs.binance.org/smart-chain/guides/concepts/consensus.html
    // also https://github.com/binance-chain/bsc/blob/master/consensus/parlia/parlia.go#L153

    // signature is always last 65 bytes
    bytes memory sig = Lib_BytesUtils.slice(header.extraData, header.extraData.length - 65);
    address signer = getSigner(sig, rlpHeader);
    require(signer == header.miner, "not signed by miner");

    uint expectedDifficulty = calculateDifficulty(header.miner, header.blockNumber);
    require(header.difficulty == expectedDifficulty, "expected difficulty doesn't match");

    if (header.blockNumber % EPOCH_LENGTH == 0) {
      updateValidatorSet(header.extraData);
    }

    Header memory newHeader;
    newHeader.blockNumber = uint24(header.blockNumber);
    newHeader.hash = blockHash;
    newHeader.parentHash = header.parent;
    newHeader.timestamp = uint64(header.timestamp);

    headers[header.blockNumber] = newHeader;
    hash2blockNumber[blockHash] = header.blockNumber;
  }

  function updateValidatorSet(bytes memory extraData) private {
    // 32 -> extraVaniry 65 -> signature, everything between validator bytes
    // TODO: make proper constants
    bytes memory validatorBytes = Lib_BytesUtils.slice(extraData, 32, extraData.length - 65 - 32);
    require(validatorBytes.length % 20 == 0, "invalid validator bytes length");
    uint validators = validatorBytes.length / 20;
    uint offset = 0;
    for(uint i = 0; i < validators; i++) {
      address addr = Lib_BytesUtils.toAddress(validatorBytes, offset);
      currentValidatorSet[i] = addr;
      offset += 20;
    }
  }

  // see https://github.com/binance-chain/bsc/blob/f16d8e0dd37f465b4a8297e5430ec3d017474ab7/consensus/parlia/parlia.go#L869
  // also https://github.com/binance-chain/bsc/blob/f16d8e0dd37f465b4a8297e5430ec3d017474ab7/consensus/parlia/snapshot.go#L241

  function calculateDifficulty(address miner, uint blockNumber) private view returns (uint) {
    uint offset = (blockNumber + 1) % uint64(currentValidatorSet.length);

    uint index = offset == 0 ? 21 : offset;
    index = index - 1;

    if (currentValidatorSet[index] == miner) {
      return 2; // diffInTurn
    } else {
      return 1; // diffNoTurn
    }
  }

  function getSigner(bytes memory sig, bytes memory rlpHeader) private pure returns (address) {
    (bytes32 r, bytes32 s, uint8 v) = splitSignature(sig);
    // bruh.
    v = v + 27;
    bytes memory nonSignedHeader = encodeRlpHeaderNoSign(rlpHeader);
    bytes32 signedmsg = keccak256(nonSignedHeader);
    address signer = ecrecover(signedmsg, v, r, s);
    return signer;
  }

  function isHeaderStored(bytes32 hash) public view returns (bool) {
    return hash2blockNumber[hash] != 0;
  }

  function getLongestChainEndpoint() public view returns (bytes32 hash) {
   return headers[largestBlockNumber].hash;
  }

  function getHeaderInternal(bytes32 hash) private view returns (Header memory) {
    uint blockNumber = hash2blockNumber[hash];
    require(blockNumber != 0, "block not found");
    return headers[blockNumber];
  }

  function getHeader(bytes32 blockHash) public view returns (bytes32 parentHash, uint blockNumber, uint totalDifficulty) {
    Header memory header = getHeaderInternal(blockHash);
    return (
      header.parentHash,
      header.blockNumber,
      0
    );
  }

  function getBlockByNumber(uint blockNumber) public view returns (bytes32 hash, uint24 depth) {
    Header memory ret = headers[blockNumber];
    require(ret.hash != 0, "block not found");
    return (ret.hash, uint24(largestBlockNumber-blockNumber));
  }
}

