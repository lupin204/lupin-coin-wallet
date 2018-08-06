const _ = require("lodash"),
    Transactions = require("./transactions");


const { validateTx } = Transactions;

let mempool = [];

// mempool의 DEEP COPY(완전히 새로운 obj - 복사본) 리턴
const getMempool = () => _.cloneDeep(mempool);

const getTxInsInPool = (mempool) => {
    return _(mempool).map(tx => tx.txIns).flatten().value();
}

// 트랜잭션이 이미 mempool에서 사용된 인풋이 있는지 체크 - double spending 체크
const isTxValidForPool = (tx, mempool) => {

    // 일단 mempool에서 모든 인풋을 가져온다.
    const txInsInPool = getTxInsInPool(mempool);
    
    // txIns(모든인풋)에서 찾으려는 동일한 인풋(txIn)이 존재하는지 확인
    // 동일한 인풋 체크는 txOutIndex와 txOutId가 같은지로 체크
    const isTxInAlreadyInPool = (txIns, txIn) => {
        return _.find(txIns, (txInInPool) => {
            return (
                txIn.txOutIndex === txInInPool.txOutIndex && txIn.txOutId === txInInPool.txOutId
            );
        });
    }

    // mempool의 트랜잭션 인풋 리스트에서 트랜잭션_인풋을 하나씩 뒤져보면서 각각의 인풋에 대하여 전부 double spending(중복사용) 체크
    for (const txIn of tx.txIns) {
        if (isTxInAlreadyInPool(txInsInPool, txIn)) {
            return false;
        } else {
            return true;
        }
    }
}

const hasTxIn = (txIn, uTxOutList) => {
    // 동일한 ID를 갖는 아웃풋과 인덱스 찾기.
    const foundTxIn = uTxOutList.find(uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);

    // 이미 컨펌된건 삭제
    return foundTxIn !== undefined;
}

// 모든 unspent tx output
const updateMempool = (uTxOutList) => {
    // 무효한 트랜잭션 = U_TX_OUT_LIST에서 인풋을 찾을 수 없을때..
    const invalidTxs = [];

    for (const tx of mempool) {
        for (const txIn of tx.txIns) {
            // 대부분은 false지만 혹시나 true가 나오면 무효한 트랜잭션이 발견된거니까 삭제처리.
            if (!hasTxIn(txIn, uTxOutList)) {
                invalidTxs.push(tx);
                break;
            }
        }
    }

    // 이미 처리된(process) 트랜잭션 -> 삭제
    if (invalidTxs.length > 0) {
        mempool = _.without(mempool, ...invalidTxs);
    }

    return mempool;
}

const addToMempool = (tx, uTxOutList) => {
    // express서버에 요청 보내고 에러를 리턴하면.
    if (!validateTx(tx, uTxOutList)) {
        throw Error("This tx is invalid. Will not add to pool");
    } else if (!isTxValidForPool(tx, mempool)) {
        throw Error("This tx is not valid for the pool, Will not add it");
    }
    mempool.push(tx);
}

module.exports = {
    addToMempool,
    getMempool,
    updateMempool
}