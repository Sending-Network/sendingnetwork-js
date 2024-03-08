const workCode = () => {
    self.onmessage = function (e) {
      let workerResult = {
        result: e.data.data,
        type: e.data.type
      };
      self.postMessage({ eventName: e.data.eventName, result: workerResult });
    };
};

let code = workCode.toString();
code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));

const blob = new Blob([code], { type: "application/javascript" });
const worker_script = URL.createObjectURL(blob);

export default worker_script;