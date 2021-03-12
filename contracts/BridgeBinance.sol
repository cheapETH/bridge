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
    ENC_ADDRESS,
    ENC_UINT,
    ENC_BYTES
  }

  function encodeRlpHeaderNoSign(bytes memory rlpHeader) internal pure returns (bytes memory) {
    Lib_RLPReader.RLPItem[] memory nodes = Lib_RLPReader.readList(rlpHeader);
    EncType[15] memory encMap = [EncType.ENC_BYTES32,EncType.ENC_BYTES32,EncType.ENC_ADDRESS,EncType.ENC_BYTES32,EncType.ENC_BYTES32,EncType.ENC_BYTES32,EncType.ENC_BYTES,EncType.ENC_UINT,EncType.ENC_UINT,EncType.ENC_UINT,EncType.ENC_UINT,EncType.ENC_UINT,EncType.ENC_BYTES, EncType.ENC_BYTES32, EncType.ENC_UINT];

    bytes[] memory raw = new bytes[](nodes.length);
    for(uint i = 0; i < nodes.length; i++) {
      if(encMap[i] == EncType.ENC_BYTES32) {
        bytes32 tmp = Lib_RLPReader.readBytes32(nodes[i]);
        raw[i] = Lib_RLPWriter.writeBytes(abi.encodePacked(tmp));
        continue;
      }
      if(encMap[i] == EncType.ENC_ADDRESS) {
        address tmp = Lib_RLPReader.readAddress(nodes[i]);
        raw[i] = Lib_RLPWriter.writeAddress(tmp);
        continue;
      }
      if(encMap[i] == EncType.ENC_UINT) {
        uint tmp = Lib_RLPReader.readUint256(nodes[i]);
        raw[i] = Lib_RLPWriter.writeUint(tmp);
        continue;
      }
      if(encMap[i] == EncType.ENC_BYTES) {
        bytes memory tmp = Lib_RLPReader.readBytes(nodes[i]);
        // remove trailing 65 bytes of signature from extraData
        if (i == 12) {
          tmp = Lib_BytesUtils.slice(tmp,0, tmp.length - 65);
        }
        raw[i] = Lib_RLPWriter.writeBytes(tmp);
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
    uint8 v;
    bytes32 r;
    bytes32 s;
    uint start = extraData.length-65+32; // +32 for length storage?
    assembly {
      let sig := add(extraData, start)
      r := mload(add(sig, 0))
      s := mload(add(sig, 32))
      v := mload(add(sig, 33))  // actually the 64th byte
    }
    bytes memory nonSignedHeader = encodeRlpHeaderNoSign(rlpHeader);
    console.logBytes(nonSignedHeader);
    // TODO: extract the correct part of the block header for this
    bytes32 signedmsg = keccak256("");
    address signer = ecrecover(signedmsg, v, r, s);
    console.log(signer, miner);
    //require(signer == miner, "not signed by miner");

    headers[blockNumber] = blockHash;
  }

  function getBlockByNumber(uint blockNumber) public view returns (bytes32 hash, uint24 depth) {
    bytes32 ret = headers[blockNumber];
    require(ret != 0, "block not found");
    return (ret, uint24(largestBlockNumber-blockNumber));
  }
}

