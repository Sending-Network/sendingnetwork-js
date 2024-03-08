import sync_work_script from './syncWorker.js';
import client_worker_script from './clientWorker.js';

export class AbcWorker {
    private callbackLoop = new Map();
    private worker: Worker;
    constructor(type: 'sync' | 'client' = 'sync') {
		switch (type) {
			case 'client':
				this.worker = new Worker(client_worker_script);
				break;
		
			default:
				this.worker = new Worker(sync_work_script);
				break;
		}
		this.worker.onmessage = (e) => {
			const {eventName, result} = e.data;
			const callback = this.callbackLoop.get(eventName);
			if (callback) {
				callback(result);
				this.callbackLoop.delete(eventName);
			}
		}
    }
    public delegatedTask = async function (type: string, data: any) {
        return new Promise((resolve) => {
            const nowTime = Date.now()
			this.callbackLoop.set(nowTime, resolve);
			this.worker.postMessage({ eventName: nowTime, type, data});
        });
    }
	public terminate = function () {
		this.worker.terminate();
		this.worker.onmessage = null;
		this.worker = null;
	}
}