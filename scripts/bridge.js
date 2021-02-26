var Web3 = require('web3');

const USE_DEVETH = true;

if (USE_DEVETH) {
  var w3 = new Web3("https://rpc.deveth.org/");
  var bombDelayFromParent = 900000000;
} else {
  var w3 = new Web3("https://mainnet.cheapeth.org/rpc");
  var bombDelayFromParent = 9000000;
}

let sleep = require('util').promisify(setTimeout);
var rlp = require('rlp');
const lib = require('./lib');

const MAX_BLOCK_CHUNK = 10;
//const bridgeAddress = "0x76523BB738Ff66d3B83Dde2cA56A930dd20994eF";
const bridgeAddress = null;

console.log("Using bridge at address", bridgeAddress);

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Running from the address:",
    deployer.address
  );
  console.log("Account balance:", (await deployer.getBalance()).toString());

  var Bridge;
  if (bridgeAddress == null) {
    const genesis_block = await w3.eth.getBlock("latest");

    const BridgeFactory = await ethers.getContractFactory("Bridge");
    Bridge = await BridgeFactory.deploy(lib.getBlockRlp(genesis_block), bombDelayFromParent);

    console.log("Deployed Bridge address:", Bridge.address);
  } else {
    Bridge = await ethers.getContractAt("Bridge", bridgeAddress);
  }

  var seen = {};
  while (1) {
    var ep = await Bridge.getLongestChainEndpoint();

    console.log(ep);
    if (seen[ep]) {
      await sleep(5000);
      continue;
    }

    var hdr = await Bridge.getHeader(ep);
    console.log(hdr);
    var blockNumber = hdr['blockNumber'].toNumber();
    const latestBlock = await w3.eth.getBlock('latest');
    const blocksBehind = latestBlock['number'] - blockNumber;
    console.log("we are at", blockNumber, "which is", blocksBehind, "blocks behind", latestBlock['number']);

    // not behind?
    if (blocksBehind == 0) {
      await sleep(5000);
      continue;
    }
    seen[ep] = true;

    var hdrs = [];
    for (var i = 0; i < Math.min(MAX_BLOCK_CHUNK, blocksBehind); i++) {
      const submitBlockNumber = blockNumber+i+1;
      const new_block = await w3.eth.getBlock(submitBlockNumber);
      hdrs.push(lib.getBlockRlp(new_block));
    }
    const ret = await Bridge.submitHeaders(hdrs);
    console.log("submitted", hdrs.length, "block headers with tx hash", ret['hash']);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

