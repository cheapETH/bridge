// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";

contract BridgeSale {
  Bridge immutable bridge;
  address immutable depositOnL1;

  constructor(Bridge input_bridge, address dep) public {
    bridge = input_bridge;
    depositOnL1 = dep;
  }

  receive() external payable {
    // thanks for the coin
  }

  function redeemDeposit(bytes memory rlpBlockHeader, bytes memory rlpTransaction) public {
    bytes32 blockHash = keccak256(rlpBlockHeader);
    require(Bridge.isHeaderStored(blockHash), "block is not in Bridge");

    // TODO: confirm block is deep enough in blockchain on bridge

    // TODO: confirm transaction is in block

    // TODO: confirm to address is deposit address

    // TODO: transfer value (with ratio) of coins to from address

  }
}

