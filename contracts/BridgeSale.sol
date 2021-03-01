// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";

contract BridgeSale {
  Bridge immutable bridge;
  address immutable depositOnL1;

  // prevent double spend with the same tx
  mapping (bytes32 => bool) private seenTransactions;

  constructor(Bridge input_bridge, address dep) public {
    bridge = input_bridge;
    depositOnL1 = dep;
  }

  receive() external payable {
    // thanks for the coin
  }

  function redeemDeposit(bytes memory rlpBlockHeader, bytes memory rlpTransaction) public {
    bytes32 blockHash = keccak256(rlpBlockHeader);
    bytes32 transactionHash = keccak256(rlpTransaction);
    require(bridge.isHeaderStored(blockHash), "block is not in Bridge");
    require(!seenTransactions[transactionHash], "already paid out transaction");
    seenTransactions[transactionHash] = true;

    // TODO: confirm block is deep enough in blockchain on bridge

    // TODO: confirm transaction is in block

    // TODO: optionally validate the transaction (do we have to? it's in the block)

    // TODO: confirm to address is deposit address

    // TODO: transfer value (with ratio) of coins to from address

  }
}

