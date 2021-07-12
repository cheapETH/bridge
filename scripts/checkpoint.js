var Web3 = require('web3');
const lib = require('./lib');
let sleep = require('util').promisify(setTimeout);

const checkpointerAddress = process.env['CHECKPOINTER'];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Running from the address:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  if (checkpointerAddress == null) {
    const CheckpointerFactory = await ethers.getContractFactory("Checkpointer");
    Checkpointer = await CheckpointerFactory.deploy();
    console.log("Deployed Checkpointer address:", Checkpointer.address);
  } else {
    Checkpointer = await ethers.getContractAt("Checkpointer", checkpointerAddress);
  }

  var last_latest_block_number = (await ethers.provider.getBlockNumber()) - 101;
  while (1) {
    var latest_block_number = (await ethers.provider.getBlockNumber()) - 100;
    if (last_latest_block_number == latest_block_number) { await sleep(5000); continue; }

    var cntBehind = latest_block_number-last_latest_block_number;
    for (var i = last_latest_block_number+1; i <= latest_block_number; i++) {
      const submit_block = await ethers.provider.getBlock(i);
      console.log(cntBehind, "behind, attesting to", submit_block.number, "with hash", submit_block.hash);
      await Checkpointer.attest(submit_block.number, submit_block.hash);
    }
    last_latest_block_number = latest_block_number;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

