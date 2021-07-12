var Web3 = require('web3');

var poa = false;
if (process.env['NETWORK'] == "deveth") {
  console.log("Deploying bridge to deveth");
  var w3 = new Web3("https://rpc.deveth.org/");
  var bombDelayFromParent = 900000000;
} else if (process.env['NETWORK'] == "binance") {
  console.log("Deploying bridge to binance");
  var w3 = new Web3("https://bsc-dataseed.binance.org/");
  poa = true;
} else {
  console.log("Deploying bridge to mainnet");
  // https://docs.linkpool.io/docs/public_rpc
  var w3 = new Web3("https://main-light.eth.linkpool.io/");
  var bombDelayFromParent = 9000000;
}

let sleep = require('util').promisify(setTimeout);
var rlp = require('rlp');
const lib = require('./lib');

const MAX_BLOCK_CHUNK = 10;

const bridgeAddress = process.env['BRIDGE'];

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

    if (poa) {
      const BridgeFactory = await ethers.getContractFactory("BridgeBinance");
      const validators = await lib.getValidatorsBinance(w3, genesis_block.number);
      Bridge = await BridgeFactory.deploy(lib.getBlockRlp(genesis_block), validators);
    } else {
      const BridgeFactory = await ethers.getContractFactory("Bridge");
      Bridge = await BridgeFactory.deploy(lib.getBlockRlp(genesis_block), bombDelayFromParent);
    }

    console.log("Deployed Bridge address:", Bridge.address);
  } else {
    Bridge = await ethers.getContractAt("Bridge", bridgeAddress);
  }

  var seen = {};
  while (1) {
    const longestCommitedChainHash = await Bridge.getLongestChainEndpoint();
    console.log("longestCommitedChainHash:", longestCommitedChainHash);
    if (seen[longestCommitedChainHash]) {
      await sleep(5000);
      continue;
    }

    var hdr = await Bridge.getHeader(longestCommitedChainHash);
    var blockNumber = hdr['blockNumber'].toNumber();

    const latestBlock = await w3.eth.getBlock('latest');
    const blocksBehind = latestBlock['number'] - blockNumber;
    console.log("we are at", blockNumber, "which is", blocksBehind, "blocks behind", latestBlock['number']);

    // not behind?
    if (blocksBehind == 0) {
      await sleep(5000);
      continue;
    }

    // new headers to submit
    var hdrs = [];

    // might rewind a bit for chain reorg
    while (1) {
      const supposedCurrentBlock = await w3.eth.getBlock(blockNumber);
      if (await Bridge.isHeaderStored(supposedCurrentBlock['hash'])) break;
      blockNumber -= 1;
      console.log("rewinding...");
    }

    console.log("syncing from block", blockNumber);
    while (hdrs.length < MAX_BLOCK_CHUNK && blockNumber != latestBlock['number']) {
      blockNumber += 1;
      const new_block = await w3.eth.getBlock(blockNumber);
      hdrs.push(lib.getBlockRlp(new_block));
    }

    const ret = await Bridge.submitHeaders(hdrs);
    console.log("submitted", hdrs.length, "block headers with tx hash", ret['hash']);

    // we can wait for the transaction now
    seen[longestCommitedChainHash] = true;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

