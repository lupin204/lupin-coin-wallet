const express = require('express'),
    _ = require("lodash"),
    cors = require("cors"),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    Blockchain = require('./blockchain'),
    P2P = require('./p2p'),
    Mempool = require('./mempool'),
    Wallet = require('./wallet');

const { getBlockchain, createNewBlock, getAccountBalance, sendTx, getUTxOutList } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet, getPublicFromWallet, getBalance } = Wallet;
const { getMempool } = Mempool;

const PORT = process.env.HTTP_PORT || 3000;

const app = express(); 
app.use(bodyParser.json());
app.use(cors());
app.use(morgan("combined"));


/*
{
  "index": 1,
  "hash": "9e1355ecd6e09dba8a69d0f29324df956f7dadedb6c451f74784faf42e088c4c",
  "previousHash": "AEEBAD4A796FCC2E15DC4C6061B45ED9B373F26ADFC798CA7D2D8CC58182718E",
  "timestamp": 1531189893,
  "data": [
    {
      "txIns": [
        {
          "signature": "",
          "txOutId": 1
        }
      ],
      "txOuts": [
        {
          "address": "04201fc2c89b5cf914008e33cf0428ee8dfdcba10eed380fc939a85526360f60961ce3297159355f4949eec5a72a010539cbd490be0693f339769a1cbe1eb0cebf",
          "amount": 50
        }
      ],
      "id": "c56a58413317c6738508142f317ecacfe19e4f47fefd1d53adaa5bcf90bbe9f0"
    }
  ],
  "difficulty": 0,
  "nonce": 0
}
*/
app.route("/blocks")
    .get((req, res) => {
        res.send(getBlockchain());
    })
    .post((req, res) => {
        const newBlock = createNewBlock();
        res.send(newBlock);
    });

app.post('/peers', (req, res) => {
    const { body: { peer } } = req;
    connectToPeers(peer);
    res.send();
});

app.get("/me/balance", (req, res) => {
    const balance = getAccountBalance();
    res.send({ balance });
});

app.get("/me/address", (req, res) => {
  res.send(getPublicFromWallet());
});

// 블록의 hash로 해당 블록을 찾는다
app.get("/blocks/:hash", (req, res) => {
  const { params : { hash } } = req;
  const block = _.find(getBlockchain(), { hash });
  if (block === undefined) {
    res.status(400).send("Block not found");
  } else {
    res.send(block);
  }
});

// 트랜잭션_ID로 해당 트랜잭션 정보를 얻는다
app.get("/transactions/:id", (req, res) => {
  const tx = _(getBlockchain()).map(blocks => blocks.data).flatten()
    .find({ id: req.params.id });
  
  if (tx === undefined) {
    res.status(400).send("Transaction not found");
  }
  res.send(tx);
});

app.route("/transactions") 
  .get((req, res) => {
    res.send(getMempool()); 
  }).post((req, res) => {
    try {
      // const { address, amount } = req.body;
      const { body: { address, amount } } = req;
      if (address === undefined || amount === undefined) {
        throw Error("Please specify and address and an amount");
      } else {
        var response = sendTx(address, amount);
        res.send(response);
      }
    } catch(e) {
      res.status(400).send(e.message);
    }
  });

app.get("/address/:address", (req, res) => {
  const { params : { address } } = req;
  const balance = getBalance(address, getUTxOutList());
  res.send({ balance });
});

const server = app.listen(PORT, () => 
    console.log(`LupinCoin Server running on ${PORT}`)
);

initWallet();
startP2PServer(server);


