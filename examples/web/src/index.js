import { randomBytes } from "crypto-browserify";
import { Wallet }  from "ethers";
import sdk from "sendingnetwork-js-sdk";

function register_in_browser(){
  window.randomBytes = randomBytes;
  window.Wallet  = Wallet;
}

function init() {
  register_in_browser();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('SW registered: ', registration);
      }).catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
    });
  }
  document.getElementById("test").onclick = hello;
  document.getElementById("login").onclick = login;
  document.getElementById("backup").onclick = backup;
  document.getElementById("createRoom").onclick = createRoom;
}

export async function createRoom() {
  const loginStr = document.getElementById("resp").innerHTML
  if (window.loginResult == null
      || window.loginResult.accessToken == null
      || window.loginResult.accessToken.length ===0){
    showJson({"error": "please login first"}, "room_info");
  }

  const roomName =  document.getElementById("roomName").value;
  if (roomName == null || roomName.length === 0 ){
    showJson({"error": "please input room name"}, "room_info");
    return;
  }

  console.log(window.loginResult);
  const client = sdk.createClient({
    baseUrl: "http://localhost",
    userId: window.loginResult.user_id,
    accessToken: window.loginResult.access_token,
  });

  client.createRoom({
    name: roomName,
    visibility: "public",
  }).then((room_info) => {
    console.log(room_info);
    showJson(room_info, "room_info")
  }).catch((err) => {
    console.log(err);
    showJson({error: err}, "room_info")
  });
}


export async function hello() {
  const url = document.querySelector("#url").value
  const res = await fetch(url)
  const json = await res.json();
  showJson(json);
}

function showJson(json, elememt) {
  if (elememt == null){
    elememt = "resp"
  }
  document.getElementById(elememt).innerHTML = JSON.stringify(json, undefined, 2);
}

async function loginViaDID(params) {
  const prepared = {
    ...params,
    nonce: randomBytes(32).toString("hex"),
    timestamp: new Date().getTime(),
    token: "",
  };
  const message = [
    prepared.salt,
    prepared.publicKey,
    prepared.nonce,
    prepared.timestamp,
  ].join("#");
  try {
    const from = prepared.publicKey;
    const msg = `0x${Buffer.from(message, "utf8").toString("hex")}`;
    let sign = await window.ethereum.request({
      method: "personal_sign",
      params: [msg, from, ""],
    });
    if (sign.startsWith("0x") || sign.startsWith("0X")) {
      sign = sign.substring(2);
      prepared.token = Buffer.from(sign, "hex")
          .toString("base64")
          .replace(/\+/g, "-") // Convert '+' to '-'
          .replace(/\//g, "_"); // Convert '/' to '_'
    }
  } catch (err) {
    console.error(err);
  }
  const identifier = {
    ...prepared,
    type: "m.id.thirdparty",
    medium: "did",
    publicKey: params.publicKey,
  };

  const loginParams = {
    identifier,
    initial_device_display_name: "wasm test",
    type: "m.login.did.identity",
    device_id: "wasm_demo",
  };
  const response = await fetch("http://localhost/_api/client/v3/login", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(loginParams)
  });
  const json = await response.json();
  console.log(json);
  return json;
}

export async function login() {
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  const account = accounts[0];
  console.log("select account: " + account);
  const result = await loginViaDID({
    publicKey: account,
    salt: "hiseas_account",
    address: `did:eth:mainnet:${account}_did`,
  })
  window.loginResult = result;
  showJson(result);
}

async function sendTransaction(transactions) {
  if (transactions) {
    if (transactions.length === 0) {
      alert("Backup successfully");
    } else {
      const [transaction] = transactions;
      const { chainId } = transaction;

      if (window.ethereum.networkVersion === chainId) {
        window.ethereum
            .request({
              method: "eth_sendTransaction",
              params: transactions,
            })
            .then((result) => {
              console.log("eth_sendTransaction", result);
            })
            .catch((error) => {
              console.log("eth_sendTransaction", error);
            });
      } else {
        try {
          await window.ethereum
              .request({
                method: "wallet_switchEthereumChain",
                params: [
                  {
                    chainId: `0x${Number(chainId).toString(
                        16
                    )}`,
                  },
                ],
              })
              .then(() => {
                window.ethereum.request({
                  method: "eth_sendTransaction",
                  params: transactions,
                });
              });
        } catch (switchError) {
          console.log("wallet_addEthereumChain");
          // This error code indicates that the chain has not been added to MetaMask.
          if (switchError.code === 4902) {
            try {
              const networkConf = {
                "137": {
                  chainName: "Polygon Mainnet",
                  rpcUrls: ["https://polygon-rpc.com/"],
                  nativeCurrency: {
                    name: "MATIC",
                    symbol: "MATIC",
                    decimals: 18,
                  },
                  blockExplorerUrls: [
                    "https://polygonscan.com",
                  ],
                },
              };

              const {
                chainName,
                rpcUrls,
                nativeCurrency,
                blockExplorerUrls,
              } = networkConf[chainId];
              await window.ethereum
                  .request({
                    method: "wallet_addEthereumChain",
                    params: [
                      {
                        chainId: `0x${Number(
                            chainId
                        ).toString(16)}`,
                        chainName,
                        rpcUrls,
                        nativeCurrency,
                        blockExplorerUrls,
                      },
                    ],
                  })
                  .then(() => {
                    window.ethereum
                        .request({
                          method: "wallet_switchEthereumChain",
                          params: [
                            {
                              chainId: `0x${Number(
                                  chainId
                              ).toString(16)}`,
                            },
                          ],
                        })
                        .then(() => {
                          window.ethereum.request({
                            method: "eth_sendTransaction",
                            params: transactions,
                          });
                        });
                  });
            } catch (addError) {
              // handle "add" error
            }
          }
          // handle other "switch" errors
        }
      }
    }
  }
}

export async function backup() {
  if (typeof window.loginResult == "undefined") {
    return;
  }
  const response = await fetch("http://localhost/_api/client/unstable/social_graph/backup_transaction", {
    method: "GET",
    headers: {
      'Authorization': 'Bearer ' + window.loginResult.access_token
    },
  });
  const json = await response.json();
  console.log(json);
  showJson(json);
  await sendTransaction(json["transactions"]);
}

init();
