// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";
import "hardhat/console.sol";
import "solidity-rlp/contracts/RLPReader.sol";
import "./lib/Lib_RLPWriter.sol";
import "./lib/Lib_MerkleTrie.sol";

contract BridgeSale {
  using RLPReader for *;
  using Lib_RLPWriter for *;

  Bridge immutable bridge;
  address immutable depositOnL1;
  uint8 constant BLOCK_DEPTH_REQUIRED = 5;

  // prevent double spend with the same tx
  mapping (bytes32 => bool) private seenTransactions;

  constructor(Bridge input_bridge, address dep) public {
    bridge = input_bridge;
    depositOnL1 = dep;
  }

  receive() external payable {
    // thanks for the coin
  }

  function decodeBlockData(bytes memory rlpHeader) internal pure returns (bytes32, uint) {
    uint idx;
    RLPReader.Iterator memory it = rlpHeader.toRlpItem().iterator();

    bytes32 transactionsRoot;
    uint blockNumber;
    while (it.hasNext()) {
      if ( idx == 4 ) transactionsRoot = bytes32(it.next().toUint());
      else if ( idx == 8 ) blockNumber = it.next().toUint();
      else it.next();
      idx++;
    }

    return (transactionsRoot, blockNumber);
  }

  struct Transaction {
    uint256 nonce;
    uint256 gasPrice;
    uint256 gasLimit;
    address to;
    uint256 value;
    bytes data;
    uint256 v;
    bytes32 r;
    bytes32 s;
  }

  function decodeTransactionData(bytes memory rlpHeader) internal pure returns (address, address, uint) {
    RLPReader.Iterator memory it = rlpHeader.toRlpItem().iterator();
    Transaction memory txx = Transaction({
      nonce: it.next().toUint(),
      gasPrice: it.next().toUint(),
      gasLimit: it.next().toUint(),
      to: it.next().toAddress(),
      value: it.next().toUint(),
      data: it.next().toBytes(),
      v: it.next().toUint(),
      r: bytes32(it.next().toUint()),
      s: bytes32(it.next().toUint())
    });

    uint chainId = (txx.v - 36) / 2;

    bytes[] memory raw = new bytes[](9);
    raw[0] = Lib_RLPWriter.writeUint(txx.nonce);
    raw[1] = Lib_RLPWriter.writeUint(txx.gasPrice);
    raw[2] = Lib_RLPWriter.writeUint(txx.gasLimit);
    if (txx.to == address(0)) {
      raw[3] = Lib_RLPWriter.writeBytes('');
    } else {
      raw[3] = Lib_RLPWriter.writeAddress(txx.to);
    }
    raw[4] = Lib_RLPWriter.writeUint(txx.value);
    raw[5] = Lib_RLPWriter.writeBytes(txx.data);
    raw[6] = Lib_RLPWriter.writeUint(chainId);
    raw[7] = Lib_RLPWriter.writeBytes(bytes(''));
    raw[8] = Lib_RLPWriter.writeBytes(bytes(''));
    bytes32 hash = keccak256(Lib_RLPWriter.writeList(raw));

    address from = ecrecover(hash, 28, txx.r, txx.s);
    require(from != address(0x0), "signature verification failed");
    return (from, txx.to, txx.value);
  }

  function redeemDeposit(bytes memory rlpBlockHeader, bytes memory rlpTransaction, address payable inputFrom, bytes memory key, bytes memory proof) public {
    bytes32 blockHash = keccak256(rlpBlockHeader);
    bytes32 transactionHash = keccak256(rlpTransaction);
    require(bridge.isHeaderStored(blockHash), "block is not in Bridge");
    require(!seenTransactions[transactionHash], "already paid out transaction");
    seenTransactions[transactionHash] = true;

    bytes32 transactionsRoot;
    uint blockNumber;
    (transactionsRoot, blockNumber) = decodeBlockData(rlpBlockHeader);

    // confirm block is deep enough in blockchain on bridge
    bytes32 hash;
    uint24 depth;
    (hash, depth) = bridge.getBlockByNumber(blockNumber);
    require(depth >= BLOCK_DEPTH_REQUIRED, "block not deep enough in chain");

    // parse and validate the transaction (do we have to? it's in the block)
    // yes, we have to validate to recover the from address
    address from;
    address to;
    uint value;
    (from, to, value) = decodeTransactionData(rlpTransaction);
    require(from == inputFrom, "wrong from address");
    require(to == depositOnL1, "wrong to address");

    // confirm transaction is in block
    bool ret = Lib_MerkleTrie.verifyInclusionProof(key, rlpTransaction, proof, transactionsRoot);
    require(ret, "transaction is in block");

    // transfer value (with ratio) of coins to from address
    inputFrom.transfer(value/100);
  }
}

