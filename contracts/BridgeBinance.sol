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
  address[] public currentValidatorSet;

  mapping (uint => bytes32) private headers;
  uint largestBlockNumber;

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

  function decodeBlockData(bytes memory rlpHeader) internal pure returns (uint blockNumber, bytes memory extraData, address miner) {
    Lib_RLPReader.RLPItem[] memory nodes = Lib_RLPReader.readList(rlpHeader);
    return (Lib_RLPReader.readUint256(nodes[8]), Lib_RLPReader.readBytes(nodes[12]), Lib_RLPReader.readAddress(nodes[2]));
  }

  constructor(bytes memory genesisHeader, address[] memory consensusAddrs) public {
    // add validators
    for (uint i = 0; i < consensusAddrs.length; i++) {
      //console.log("validator", consensusAddrs[i]);
      currentValidatorSet.push(consensusAddrs[i]);
    }

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
    uint blockNumber;
    bytes memory extraData;
    address miner;

    (blockNumber, extraData, miner) = decodeBlockData(rlpHeader);
    if (blockNumber > largestBlockNumber) largestBlockNumber = blockNumber;

    // confirm miner is in validator set
    // disgusting O(n) algorithm
    bool found = false;
    for (uint i = 0; i < currentValidatorSet.length; i++) {
      if (currentValidatorSet[i] == miner) found = true;
    }
    require(found, "miner not in validator set");

    // TODO: validate block
    // see https://docs.binance.org/smart-chain/guides/concepts/consensus.html
    // also https://github.com/binance-chain/bsc/blob/master/consensus/parlia/parlia.go#L153

    bytes memory slice = Lib_BytesUtils.slice(extraData, extraData.length - 65);
    (bytes32 r, bytes32 s, uint8 v) = splitSignature(slice);
    // bruh.
    v = v + 27;
    bytes memory nonSignedHeader = encodeRlpHeaderNoSign(rlpHeader);
    bytes32 signedmsg = keccak256(nonSignedHeader);
    address signer = ecrecover(signedmsg, v, r, s);
    require(signer == miner, "not signed by miner");

    headers[blockNumber] = blockHash;
  }

  function getBlockByNumber(uint blockNumber) public view returns (bytes32 hash, uint24 depth) {
    bytes32 ret = headers[blockNumber];
    require(ret != 0, "block not found");
    return (ret, uint24(largestBlockNumber-blockNumber));
  }
}

