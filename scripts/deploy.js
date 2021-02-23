var Web3 = require('web3');
var w3 = new Web3("https://node.cheapeth.org/rpc");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    deployer.address
  );
  
  console.log("Account balance:", (await deployer.getBalance()).toString());

	const genesis_block = await w3.eth.getBlock("latest");

	const BridgeFactory = await ethers.getContractFactory("Bridge");
	const Bridge = await BridgeFactory.deploy(genesis_block['hash'], genesis_block['number']);

  console.log("Bridge address:", Bridge.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

