const workCode = () => {
    const Events = {
      getPushActions: function (event) {
        console.log(event)
        return 'event.pushActions';
      }
    }
    self.onmessage = function ({data: {eventName, type, data}}) {
      const result = Events[type](data)
      self.postMessage({ eventName, result });
    };
};

let code = workCode.toString();
code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));

const blob = new Blob([code], { type: "application/javascript" });
const worker_script = URL.createObjectURL(blob);

export default worker_script;