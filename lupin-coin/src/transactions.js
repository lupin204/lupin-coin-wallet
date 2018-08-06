const CryptoJS = require('crypto-js'),
    EC = require('elliptic').ec,
    _ = require('lodash'),
    utils = require('./utils');
    


// init EC - ECDSA (Elliptic Curve Digital Signature Algorithm) - ECC를 이용한 signature
const ec = new EC('secp256k1');

// 한번 채굴할때마다 생성되는 코인의 수량 (비트코인은 시간에 따라 채굴 수량이 절반으로 줄어듬)
// --> 코인베이스 트랜잭션 때 트랜잭션_아웃풋으로 생성되는 amount의 수량
const COINBASE_AMOUNT = 50;

/*
Transaction_Output
amount = how many coins have they.
address = where they belong to.
*/
class TxOut {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}

/*
Transaction_Input (Unspent Transaction Output)
txOutId = unspent transaction output ID -> a hash of content - for evaluating transaction.
txOutIndex -> just for finding transaction. 1, 2, 3, ...
signature -> "my" transaction -> private key  ||  public key = target bitcoin address (보내려는 상대방 비트코인 주소)
*/
class TxIn {
    // txOutId ( unspent transaction output ID )
    // txOutIndex
    // Signature
}

/*
ID = hash of TxIns and TxOuts
txIn array
txOut array
*/
class Transaction {
    // ID
    // txIn[]
    // txOut[]
}

class UTxOut {
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}


// id = txIn array + txOut array => make hash
// 트랜잭션 인풋과 아웃풋 각각 배열의 모든 원소를 문자열로 이어붙이고, 이 긴 문자열을 해싱.
/*
reduce(callbackFn, initialValue_첫번째_인수로_사용되는_값)
[25,40,13].reduce((a,b) => a+b) = 25+40+13 = 78
-> {address,amount} => [{'4646',80},{'4646',70},{'3434',50}] => ['464680','464670','343460'].reduce((a,b) => a+b, "") = "464680464670343450"
*/
const getTxId = (tx) => {
    const txInsContent = tx.txIns
        .map(txIn => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, "");

    const txOutContent = tx.txOuts
        .map(txOut => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, "");

    return CryptoJS.SHA256(txInsContent + txOutContent).toString();
}

const findUTxOut = (txOutId, txOutIndex, uTxOutList) => {
    return uTxOutList.find(uTxO => uTxO.txOutId === txOutId && uTxO.txOutIndex === txOutIndex);
}

// 트랜잭션 인풋에 사인
// txInput's signature (내 사인(표시) - 보내는사람)
// tx_in's sign <- hash(ECC-ecliptic) <- txID <- hash(SHA256-cryptoJs) <- txIn_arrays + txOuts_array <- previous tx_out + tx_out
const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
    const txIn = tx.txIns[txInIndex];
    const dataToSign = tx.id;
    // 트랜잭션 인풋을 찾으려면 Unspent tx out 을 찾아야 함. 이 Unspent tx out은 트랜잭션 아웃풋 배열에서 찾을 수 있음. 
    // 왜냐하면 트랜잭션 인풋이 트랜잭션 아웃풋을 참조(레퍼런스)하기 때문. 내가 돈이 남아있음(unspent tx out)을 증명.
    // referenced unspent transaction output - in the unspent transaction output arrays
    const referencedUTxOut = findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList);
    //쓸 돈이 없는 경우
    if (referencedUTxOut === null || referencedUTxOut === undefined) {
        console.log("Couldn't find the referenced uTxOut, not signing");
        return;
    }
    // 보내는사람의 주소가 실제로 존재하는지 validation -> 트랜잭션 인풋 address가 지갑에서 얻은 address와 같은지 체크
    const referencedAddress = referencedUTxOut.address;
    if (getPublicKey(privateKey) !== referencedAddress) {
        return false;
    }
    const key = ec.keyFromPrivate(privateKey, 'hex');
    // sign하는 포맷 방식 = EDR포맷
    const signature = utils.toHexString(key.sign(dataToSign).toDER());
    return signature;
}

/*
cf. wallet.js 에 정의되어있는 함수이고, module 불러와서 쓰면 되지만,
이렇게 하면 wallet <-> transaction 양쪽에서 서로 불러다쓰기때문에 "circular input" 문제 발생하여 동일기능 함수를 transaction.js쪽에도 생성
*/
const getPublicKey = (privateKey) => {
    return ec.keyFromPrivate(privateKey, "hex").getPublic().encode("hex");
}

/*
"U_TX_OUT_LIST" = [A(40), B, C, D, E, F, G]

A(40) --> TRANSACTION --> ZZ(10)
                      --> MM(30)

TRANSACTION에서 A가 사용되었으므로 A는 삭제함.
ZZ와 MM은 새로운 Unspent_Tx_Output(아직 트랜잭션에 사용되지 않은 아웃풋)이니까 맨 뒤에 추가함

"NEW_U_TX_OUT_LIST" = [B, C, D, E, F, G, ZZ, MM]
*/

// 트랜잭션 -> 트랜잭션 아웃풋 -> unspent 트랜잭션 아웃풋 생성
// param - uTxOutList => u_tx_out과 그 주소.
const updateUTxOuts = (newTxs, uTxOutList) => {
    // 트랜잭션 전체를 다 살펴보고, 트랜잭션 아웃풋도 다 뒤져서 새로운 u_tx_out을 생성
    const newUTxOuts = newTxs.map(tx => {
        return tx.txOuts.map((txOut, index) => {
            return new UTxOut(tx.id, index, txOut.address, txOut.amount)
        })
    })
    .reduce((a, b) => a.concat(b), []);

    // 트랜잭션 인풋으로 사용된 모든 트랜잭션 아웃풋을 가져다가 일단 비움.
    // input이 50이고 10을 보내고 싶으면, 일단 input의 50을 지움.
    const spentTxOuts = newTxs.map(tx => tx.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));
    
    // 리스트의 u_tx_output을 가져다가, 내가 사용한 트랜잭션 아웃풋을 찾아서 삭제(filter)하고, 새로운 u_tx_output을 추가(concat).
    const resultingUTxOuts = uTxOutList
        .filter(uTxO => !findUTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts))
        .concat(newUTxOuts);
        
    return resultingUTxOuts;
}


//------------------------------
// check validation of tx.
const isTxInStructureValid = (txIn) => {
    if (txIn === null) {
        console.log("The txIn appears to be null");
        return false;
    } else if (typeof txIn.signature !== 'string') {
        console.log("The txIn doesn't have a valid signature");
        return false;
    } else if (typeof txIn.txOutId !== 'string') {      // hash
        console.log("The txIn doesn't have a valid txOutId");
        return false;
    } else if (typeof txIn.txOutIndex !== 'number') {
        console.log("The txIn doesn't have a valid txOutIndex");
        return false;
    } else {
        return true;
    }
}

// address 검증 : address(public key) 길이는 130자
const isAddressValid = (address) => {
    // check address length is 130
    if (address.length !== 130) {
        console.log("The address length is not the expected one");
        return false;
    // check address is hexa-decimal(16진수)
    } else if (address.match("^[a-fA-F0-9]+$") === null) {
        console.log("The address doesn't match the hex pattern");
        return false;
    } else if (!address.startsWith('04')) {
        console.log("The address doesn't start with 04");
        return false;
    } else {
        return true;
    }
}

const isTxOutStructureValid = (txOut) => {
    if (txOut === null) {
        return false;
    } else if (typeof txOut.address !== 'string') {
        console.log("The txOut doesn't have a valid string as address");
        return false;
    } else if (!isAddressValid(txOut.address)) {
        console.log("The txOut doesn't have a valid address");
        return false;
    } else if (typeof txOut.amount !== 'number') {
        console.log("The txOut doesn't have a valid amount");
        return false;
    } else {
        return true;
    }
    
}
const isTxStructureValid = (tx) => {
    if (typeof tx.id !== 'string') {
        console.log('Tx ID is not valid');
        return false;
    } else if (!(tx.txIns instanceof Array)) {
        console.log('The TxIns are not an array');
        return false;
    // txIn_array를 map을 돌려서 각각의 txIn을 isTxInStructureValid해서 모든 결과값이 true가 나오는지 체크
    // [true, true, false].reduce((a, b) => a && b, true) = false   // false인 결과값이 1개 있음 -> 최종 리턴은 false
    // [true, true, true].reduce((a, b) => a && b, true) = true     // 모든 결과값이 true -> 최종 리턴은 true
    } else if (!tx.txIns.map(isTxInStructureValid).reduce((a, b) => a && b, true)) {
        console.log('The structure of one of the txIn is not valid');
        return false;
    } else if (!(tx.txOuts instanceof Array)) {
        console.log('The TxOuts are not an array');
        return false;
    // txOut_array를 map을 돌려서 각각의 txOut을 isTxOutStructureValid해서 모든 결과값이 true가 나오는지 체크
    } else if (!tx.txOuts.map(isTxOutStructureValid).reduce((a, b) => a && b, true)) {
        console.log('The structure of one of the txOut is not valid');
    } else {
        return true;
    }
}

// 트랜잭션_아웃풋 은 배열[] 이며, 트랜잭션_인풋은 해당 트랜잭션_아웃풋의 id와 index를 참조하고있음
const getAmountInTxIn = (txIn, uTxOutList) => findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTxIn = (txIn, tx, uTxOutList) => {
    // 트랜잭션_인풋이 참조하고 있는 바로 이전 트랜잭션_아웃풋을 가져와야함
    const wantedTxOut = uTxOutList.find(uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
    
    // 트랜잭션_인풋이 참조하고 있는 바로 이전 트랜잭션_아웃풋이 없으면, 돈이 없다는 뜻.
    if (wantedTxOut === undefined) {
        console.log(`Didn't find the wanted uTxOut, the tx: ${tx} is invalid`);
        return false;
    } else {
        // 내 고유 private키로 사인한 signature는 내 public키(addres)로 증명할 수 있음 - 내가 생성한 트랜잭션 이라는 것을.
        // 트랜잭션_ID는 돈을 사용할 사람에 의해 사인(signature)되었음을 체크(증명)
        /*
        이 코인이 내 코인임을 증명하는 방법
        : 트랜잭션_인풋에 내가 사인(signature) --> 내 주소(public키)가 트랜잭션_ID를 가지고 내가 예전에 한 사인(signature)를 증명
        */
        const address = wantedTxOut.address;
        const key = ec.keyFromPublic(address, "hex");
        return key.verify(tx.id, txIn.signature);   // tx.id(트랜잭션_ID 는 private키로 signature한 hash)
    }
}

// Validate Tx = {id(hash), txIns[], txOuts[]}
const validateTx = (tx, uTxOutList) => {

    // check tx structure
    if (!isTxStructureValid(tx)) {
        console.log("Tx structure is invalid");
        return false;
    }

    // check Transaction_ID's hash
    if (getTxId(tx) !== tx.id) {
        console.log("Tx ID is not valid");
        return false;
    }

    // check Transaction_Input_Arrays
    const hasValidTxIns = tx.txIns.map(txIn => validateTxIn(txIn, tx, uTxOutList));

    if (!hasValidTxIns) {
        console.log(`The tx: ${tx} doesn't have valid txIns`);
        return false;
    }

    // 이 수량은 바로 이전 트랜잭션_아웃풋을 참조하고 있음
    const amountInTxIns = tx.txIns
        .map(txIn => getAmountInTxIn(txIn, uTxOutList)).
        reduce((a, b) => a + b, 0);

    // tx.txOuts --> map --> [34, 52, 76, 23] --> reduce --> 185
    const amountInTxOuts = tx.txOuts
        .map(txOut =>txOut.amount)
        .reduce((a, b) => a + b, 0);

    if (amountInTxIns !== amountInTxOuts) {
        console.log(`The tx: ${tx} doesn't have the same amount in the txOut as in the txIns`);
        return false;
    } else {
        return true;
    }
    
}

// coinbase transaction : 블록체인 --> 채굴자 에게 가는 트랜잭션 (1개의 인풋 & 1개의 아웃풋)
// 트랜잭션_아웃풋만 존재함. (트랜잭션_인풋(트랜잭션 이전 아웃풋)은 없음) - 그냥 없던 코인이 새로 만들어지는 것.
const validateCoinbaseTx = (tx, blockIndex) => {
    if (getTxId(tx) !== tx.id) {
        console.log("Invalid Coinbase tx ID");
        return false;
    // 트랜잭션_인풋 은 only one (from 블록체인)
    } else if (tx.txIns.length !== 1) {
        console.log("Coinbase TX should only have one input");
        return false;
    // 트랜잭션_인풋 은 참조할 트랜잭션_아웃풋(Unspent Tx Output = 잔액) 이 없음.
    // 그래서 트랜잭션_인풋 은 block의 index를 참조함.
    } else if (tx.txIns[0].txOutIndex !== blockIndex) {
        console.log("The txOutIndex of the Coinbase Tx should be the same as the Block Index");
        return false;
    // 트랜잭션_아웃풋 은 only one (to 채굴자 1명)
    } else if (tx.txOuts.length !== 1) {
        console.log("Coinbase TX should only have one output");
        return false;
    // 한번에 채굴되어지는 수량이 미리 정한 amount 어야 함.
    } else if (tx.txOuts[0].amount !== COINBASE_AMOUNT) {
        console.log(`Coinbase TX should have an amount of only ${COINBASE_AMOUNT} and it has ${tx.txOuts[0].amount}`);
        return false;
    } else {
        return true;
    }
}

// 코인베이스_트랜잭션 = 1개의 트랜잭션_인풋(blockIndex만을 가진) + 1개의 트랜잭션_아웃풋 + 트랜잭션_ID
const createCoinbaseTx = (address, blockIndex) => {
    const tx = new Transaction();
    const txIn = new TxIn();
    txIn.signature = "";
    txIn.txOutId = "";
    txIn.txOutIndex = blockIndex;
    tx.txIns = [txIn];
    tx.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    tx.id = getTxId(tx);
    return tx;
}

// 중복으로 지출(double spending)되는지를 체크
const hasDuplicates = (txIns) => {
    // lodash.countBy = 배열 원소를 가지고 함수를 돌려서 나온 결과를 {"결과값": 갯수} JSON 형태로 리턴
    // _.countBy([12.7, 12.2, 12.1, 3, 3, 8.1, 8.125], Math.ceil)               = {"3": 2, "9": 2, "13": 3}
    // _.countBy([12.7, 12.2, 12.1, 3, 3, 8.1, 8.125], elem => Math.ceil(elem)) = {"3": 2, "9": 2, "13": 3}
    const groups = _.countBy(txIns, txIn => txIn.txOutId + txIn.txOutIndex);

    // countBy로 그룹핑해서 모든 갯수가 1인지를 체크(아니면 중복임)하여, 중복이면(1보다크면) true를 리턴하고.
    // 결과배열에서 true가 1개라도 있으면(중복이 하나라도 확인되면) 최종적으로 hasDuplicates함수는 true 리턴
    return _(groups).map(value => {
        if (value > 1) {
            console.log("Found a duplicated txIn");
            return true;
        } else {
            return false;
        }
    }).includes(true)
}

const validateBlockTxs = (txs, uTxOutList, blockIndex) => {
    const coinbaseTx = txs[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log("Coinbase Tx is invalid");
    }

    const txIns = _(txs).map(tx => tx.txIns).flatten().value();

    // 하나의 인풋을 가지고 중복되게 사용하는지 체크
    // (ex. 50개의 코인을 인풋으로 넣어서 A와 B에게 동시에 보낼수는 없다.)
    if (hasDuplicates(txIns)) {
        console.log("Found duplicated txIns");
        return false;
    }

    // 코인베이스 트랜잭션에 대하여 체크
    const nonCoinbaseTxs = txs.slice(1);
    return nonCoinbaseTxs.map(txs => validateTx(txs, uTxOutList)).reduce((a, b) => a + b, true);
}



// (FROM) 업데이트 할 블록 인덱스 -> (TO) 업데이트 할 U_TX_OUTPUT_LIST와 
// 트랜잭션 -> 아웃풋 생성 -> (검증:validateBlockTxs) -> U_TX_OUTPUT 업데이트 -> 블록체인에 블록 추가
const processTxs = (tx, uTxOutList, blockIndex) => {
    if (!validateBlockTxs(tx, uTxOutList, blockIndex)) {
        return null;
    }
    return updateUTxOuts(tx, uTxOutList);
}


module.exports = {
    getPublicKey,
    getTxId,
    signTxIn,
    TxIn,
    Transaction,
    TxOut,
    createCoinbaseTx,
    processTxs,
    validateTx
}