// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";

contract BridgeSale {
  Bridge immutable bridge;
  constructor(Bridge input_bridge) public {
    bridge = input_bridge;
  }

}

