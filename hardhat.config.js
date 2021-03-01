require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");

var fs = require('fs');
var bridgeKey = fs.readFileSync("/Users/taylor/.bridgekey",{ encoding: 'utf8' });

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    cheapeth: {
      url: "https://node.cheapeth.org/rpc",
      accounts: [bridgeKey],
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
  },
};