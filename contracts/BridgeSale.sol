// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";
import "hardhat/console.sol";
import "solidity-rlp/contracts/RLPReader.sol";

contract BridgeSale {
  using RLPReader for *;

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

  function redeemDeposit(bytes memory rlpBlockHeader, bytes memory rlpTransaction) public {
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
    console.log(depth);
    require(depth >= BLOCK_DEPTH_REQUIRED);

    // TODO: confirm transaction is in block

    // TODO: optionally validate the transaction (do we have to? it's in the block)

    // TODO: confirm to address is deposit address

    // TODO: transfer value (with ratio) of coins to from address

  }
}

