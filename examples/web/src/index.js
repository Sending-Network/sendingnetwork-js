import sdk from "sendingnetwork-js-sdk";

const baseUrl = 'https://portal0101.sending.network';

const user_id = localStorage.getItem("sdn_user_id");
const access_token = localStorage.getItem("sdn_access_token");
const _client = sdk.createClient({
  baseUrl,
  userId: user_id ? user_id : undefined,
  accessToken: access_token ? access_token : undefined
})


function init() {
  // if ('serviceWorker' in navigator) {
  //   window.addEventListener('load', () => {
  //     navigator.serviceWorker.register('/sw.js').then(registration => {
  //       console.log('SW registered: ', registration);
  //     }).catch(registrationError => {
  //       console.log('SW registration failed: ', registrationError);
  //     });
  //   });
  // }
  document.getElementById("test").onclick = testReq;
  document.getElementById("login").onclick = login;
  document.getElementById("createRoom").onclick = createRoom;
}

function showJson(json, elememt) {
  if (elememt == null){
    elememt = "resp"
  }
  document.getElementById(elememt).innerHTML = JSON.stringify(json, undefined, 2);
}

export async function createRoom() {
  const loginStr = document.getElementById("resp").innerHTML
  if (!localStorage.getItem("sdn_user_id") || !localStorage.getItem("sdn_access_token")) {
    showJson({"error": "please login first"}, "room_info")
  }
  const roomName =  document.getElementById("roomName").value;
  if (roomName == null || roomName.length === 0 ){
    showJson({"error": "please input room name"}, "room_info");
    return;
  }
  _client.createRoom({
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

export async function testReq() {
  const url = document.querySelector("#url").value
  const res = await fetch(url)
  const json = await res.json();
  showJson(json);
}

export async function login() {
  if (window.ethereum) {
    try {
      const prefix = "did:pkh:eip155:1:";
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const [address] = accounts;
      let { data: [did] } = await _client.getDIDList(address);
      const preloginParams = did ? { did } : { address: `${prefix}${address}` }
      const { message: lMessage, updated, random_server } = await _client.preDiDLogin1(preloginParams);
      let sign = await window.ethereum.request({
        method: "personal_sign",
        params: [lMessage, address, ""],
      });
      let identifier = {
        did,
        address: did || `${prefix}${address}`,
        token: sign,
        message: lMessage
      };
      const deviceId = localStorage.getItem("mx_device_id") || null;
      let loginParams = {
        type: "m.login.did.identity",
        updated,
        identifier,
        random_server,
        device_id: deviceId,
        initial_device_display_name: this.defaultDeviceDisplayName,
      };
      const result = await _client.DIDLogin(loginParams);
      const { access_token, user_id } = result;

      localStorage.setItem("sdn_access_token", access_token);
      localStorage.setItem("sdn_user_id", user_id);
      localStorage.setItem("sdn_user_address", address);
      showJson(result);
    } catch (error) {
      showJson(error);
    }
  }
}

init();
